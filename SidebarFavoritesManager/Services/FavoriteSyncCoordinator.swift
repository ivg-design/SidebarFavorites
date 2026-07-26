import Foundation
import AppKit
import Combine
import UniformTypeIdentifiers

/// The only service the UI talks to.
///
/// Everything that can change what the user sees - the helper bundle that
/// declares one UTI per favorite, and the rows in Finder's Favorites list -
/// funnels through one private `reconcile` pass, so an edit that changes a
/// favorite's name, icon and folder at once produces exactly one helper rebuild.
///
/// Restarting Finder is NOT part of that pass. A reconcile that changed a row
/// already on screen sets `needsFinderRestart` and stops there; `restartFinder()`
/// is the only path to `killall`, and only a user action calls it.
///
/// Only `@Published` writes and cheap config bookkeeping happen on the main
/// actor; `actool`, `codesign`, `lsregister` and every `LSSharedFileList` call run
/// on a detached task, serialized through `enqueue`.
@MainActor
final class FavoriteSyncCoordinator: ObservableObject {
    static let shared = FavoriteSyncCoordinator()

    enum Phase: Equatable {
        case idle
        case migrating
        case building
        case reconciling
        case restartingFinder
    }

    @Published private(set) var phase: Phase = .idle

    /// Problems worth telling the user about that did not stop the operation -
    /// a favorite whose folder vanished, a symbol that would not compile, a
    /// legacy bundle that could not be removed. Each names the favorite.
    @Published private(set) var warnings: [String] = []

    /// The one failure that did stop an operation, if any.
    @Published private(set) var lastError: String?

    /// Favorite id -> durable sidebar item ID, for rows the Manager believes are
    /// live. Drives the row's "In Sidebar" status.
    @Published private(set) var boundItems: [UUID: UInt32] = [:]

    /// True when Finder is drawing something the app has since changed, so it has
    /// to relaunch before the sidebar is correct.
    ///
    /// Two independent sources, because Finder caches two things. A row that was
    /// ALREADY on screen having its icon override set, changed or cleared is one.
    /// The other is the artwork itself: re-pointing a favorite at a different SVG
    /// or a different symbol leaves its OSType code alone, so no row property moves
    /// and only the rebuilt helper bundle knows anything happened.
    ///
    /// Deliberately state and not an action. A reconcile runs on launch and after
    /// any edit, and `killall Finder` in the middle of a copy aborts the copy and
    /// loses every open window, tab and in-flight rename. Nothing in this class
    /// restarts Finder on its own: the UI shows this as a banner whose button
    /// calls `restartFinder()`, which is the only path to `FinderService.restart`.
    @Published private(set) var needsFinderRestart = false

    /// The 1.0 upgrade this machine still owes, as a read-only pre-flight plan.
    ///
    /// Non-nil means the upgrade has been *offered and not yet performed*: nothing
    /// has been deleted, unregistered or rewritten, and no reconcile is allowed to
    /// run. Cleared only when the migration actually completes.
    @Published private(set) var migrationPlan: MigrationService.MigrationPlan?

    /// Whether the consent sheet is on screen. Separate from `migrationPlan` so
    /// declining can put the sheet away while leaving the upgrade outstanding.
    @Published private(set) var isShowingMigrationConsent = false

    /// How long requests pile up before a reconcile starts.
    private static let coalescingWindowNanoseconds: UInt64 = 400_000_000

    private let configManager = ConfigManager.shared

    private var hasBootstrapped = false
    private var reconcileInFlight = false
    private var pendingReconcile = false
    private var pendingForce = false

    /// Favorites whose rows have just been released by an explicit delete. The
    /// caller drops them from the config the moment `favoriteRemoved` returns, but
    /// the reconcile that follows may still observe them - and it must not
    /// re-insert a row for a favorite that is on its way out.
    private var releasedFavorites: Set<UUID> = []

    /// Warnings a reconcile does not recompute (migration teardown, path-change
    /// cleanup). Reconcile warnings are published on top of these rather than
    /// accumulated, so a problem that has been fixed stops being reported.
    private var stickyWarnings: [String] = []

    /// Tail of the serial work chain. Everything that touches the helper bundle or
    /// Finder's Favorites list goes through `enqueue`, so a delete's teardown can
    /// never interleave its snapshot/mutate cycle with a running reconcile.
    private var pipeline: Task<Void, Never>?

    private init() {}

    // MARK: - Entry points

    /// Offer the upgrade if one is owed, then reconcile. Driven from
    /// `ContentView`'s `.task`, which can fire again when the window is reopened,
    /// so it runs only once.
    ///
    /// CONTRACT: this never migrates without consent. When the pre-flight plan
    /// contains destructive work it is published for the consent sheet and
    /// bootstrap returns having changed nothing at all - not even the first
    /// reconcile, because building the new helper while the old apps are still
    /// installed is exactly the half-migrated state that must never exist.
    func bootstrap() async {
        guard !hasBootstrapped else { return }
        hasBootstrapped = true

        if MigrationService.isMigrationNeeded() {
            // Read-only scan, off the main actor: it walks a directory and reads
            // Info.plists, and it must not stall the first frame.
            let version = configManager.config.version
            let favorites = configManager.config.favorites
            let plan = await Task.detached(priority: .userInitiated) {
                MigrationService.preflight(version: version, favorites: favorites)
            }.value

            if plan.requiresConsent {
                migrationPlan = plan
                isShowingMigrationConsent = true
                return
            }

            if plan.hasWork {
                // Purely self-healing: an already-current config whose favorite is
                // missing an icon code. Deletes nothing, unregisters nothing, and
                // only ever adds an `osType` - so there is nothing to consent to.
                await runMigration(plan)
                return
            }
        }

        await requestReconcile(force: false)
    }

    /// The user authorised the plan they were shown. Runs it, then reconciles.
    func approveMigration() async {
        guard let plan = migrationPlan else { return }
        await runMigration(plan)
    }

    /// "Not Now". Puts the sheet away and leaves the machine exactly as it was.
    ///
    /// Nothing is persisted: "not yet migrated" is already the state on disk
    /// (config.json still carries the old schema version), so there is no decline
    /// flag to write and nothing to clean up. The plan is kept so the window can
    /// offer the upgrade again, and `bootstrap()` re-offers it on the next launch.
    func declineMigration() {
        guard migrationPlan != nil else { return }
        isShowingMigrationConsent = false
    }

    /// Re-open the consent sheet for an upgrade that was declined earlier.
    func presentMigrationConsent() {
        guard migrationPlan != nil else { return }
        isShowingMigrationConsent = true
    }

    private func runMigration(_ plan: MigrationService.MigrationPlan) async {
        phase = .migrating
        let outcome = await MigrationService.migrate(approving: plan)

        stickyWarnings.append(contentsOf: outcome.warnings)
        migrationPlan = nil
        isShowingMigrationConsent = false
        publishWarnings([])
        phase = .idle

        // A migrated config has never had a helper bundle built for it, so the
        // digest short-circuit must not be allowed to skip the first build.
        await requestReconcile(force: outcome.migrated)
    }

    /// GUARD: no work that builds the helper or touches Finder's sidebar may run
    /// while an upgrade is outstanding.
    ///
    /// Returns true when the caller must abandon its pass. Rather than failing
    /// silently, the consent sheet is put back on screen - the user asked for
    /// something that needs the upgrade, so asking again is the honest answer.
    private func deferForMigrationConsent() -> Bool {
        guard migrationPlan != nil else { return false }
        isShowingMigrationConsent = true
        return true
    }

    /// "Refresh". `force` rebuilds and re-registers the helper even when nothing
    /// changed, and re-probes every OSType code for third-party claimants.
    func syncAll(force: Bool = false) async {
        if force {
            releasedFavorites.removeAll()
        }
        await requestReconcile(force: force)
    }

    func favoriteAdded(_ favorite: Favorite) async {
        releasedFavorites.remove(favorite.id)
        await requestReconcile(force: false)
    }

    /// `previous` is the favorite as it was before the edit was saved.
    func favoriteUpdated(_ favorite: Favorite, previous: Favorite) async {
        releasedFavorites.remove(favorite.id)

        // A folder change orphans the row bound to the old location: reconcile
        // would find a binding pointing somewhere the favorite no longer claims
        // and correctly refuse to touch it, leaving a row the app inserted behind
        // with our icon still on it. Give that row up first, using the favorite as
        // it was - its binding is what says which row it owned.
        if previous.pathMatchCandidates != favorite.pathMatchCandidates {
            await release([previous], persistUnbinding: true)
        }

        await requestReconcile(force: false)
    }

    /// Must be awaited BEFORE `ConfigManager.removeFavorite(id:)`: the teardown
    /// needs the favorite's `osType` and sidebar binding, and both are gone once
    /// the favorite leaves the config.
    func favoriteRemoved(_ favorite: Favorite) async {
        releasedFavorites.insert(favorite.id)

        // Not routed through the coalescing window - the caller removes the
        // favorite as soon as this returns. Persisting the unbinding is pointless
        // for a favorite that is about to disappear.
        await release([favorite], persistUnbinding: false)

        // The reconcile that follows drops the declaration from the helper plist;
        // re-registering deletes the Launch Services record for that code.
        await requestReconcile(force: false)
    }

    func favoriteToggled(_ favorite: Favorite) async {
        releasedFavorites.remove(favorite.id)
        await requestReconcile(force: false)
    }

    /// Clear the icon override from every row, remove the rows the app added, and
    /// unregister and delete the helper bundle. Returns the warnings for Settings'
    /// alert.
    ///
    /// Does not restart Finder: rows that still need a redraw set
    /// `needsFinderRestart` so the UI can offer it.
    func removeAllSidebarIcons() async -> [String] {
        let favorites = configManager.config.favorites

        phase = .reconciling
        let outcome = await enqueue { SidebarReconciler.release(favorites: favorites) }

        var collected = outcome.warnings
        if let error = outcome.error {
            lastError = error
            collected.append(error)
        }
        collected += applyBindings(outcome.bindings)
        boundItems = [:]

        // The helper is unregistered and deleted. `helperDigest` is deliberately
        // left alone: the digest short-circuit also requires the bundle to exist
        // on disk, so the next reconcile rebuilds it from scratch anyway.
        phase = .building
        collected += await enqueue { IconHelperBundle.shared.teardown() }

        // Adopted rows that just lost their override still draw the old icon until
        // Finder relaunches. Removed rows need no redraw at all, so this is only
        // owed when something was actually cleared - and it is offered, never taken:
        // the user asked to remove icons, not to have Finder killed under them.
        if outcome.needsFinderRestart {
            needsFinderRestart = true
        }

        phase = .idle
        return collected
    }

    func dismissWarnings() {
        stickyWarnings.removeAll()
        warnings.removeAll()
    }

    nonisolated func revealInFinder(_ path: String) {
        FinderService.reveal(path)
    }

    /// Restart Finder because the user asked for it - the Settings action, or the
    /// button on the "needs a restart" banner.
    ///
    /// THE ONLY CALLER OF `FinderService.restart()`. Killing Finder is destructive
    /// enough (in-flight copies, open windows, unsaved renames) that it happens on
    /// an explicit click and nowhere else.
    nonisolated func restartFinder() {
        Task { @MainActor in
            await self.performFinderRestart()
        }
    }

    /// `restartFinder()` for a caller that has to know when the relaunch is done.
    ///
    /// The Add/Edit sheet's Apply button, which stays on screen across the
    /// restart and has to re-enable itself afterwards. Same single path to
    /// `FinderService.restart`, same clearing of `needsFinderRestart`, same
    /// requirement that a user explicitly asked for it - the only difference is
    /// that the caller waits instead of firing and forgetting.
    func restartFinderAndWait() async {
        await performFinderRestart()
    }

    private func performFinderRestart() async {
        // Only narrate the phase when nothing else owns it; a reconcile running
        // alongside must not be reported as finished when this returns.
        let ownsPhase = (phase == .idle)
        if ownsPhase { phase = .restartingFinder }

        // Through the pipeline: killing Finder while an LSSharedFileList mutation
        // is mid-flight is exactly the interleaving `enqueue` exists to prevent.
        await enqueue { FinderService.restart() }

        needsFinderRestart = false
        if ownsPhase, phase == .restartingFinder { phase = .idle }
    }

    // MARK: - Reconcile driver

    /// Funnel for every entry point: an in-flight flag plus a coalescing window,
    /// so concurrent requests collapse into one pass and a request that arrives
    /// mid-pass still gets a pass of its own afterwards.
    private func requestReconcile(force: Bool) async {
        guard !deferForMigrationConsent() else { return }

        pendingReconcile = true
        pendingForce = pendingForce || force

        guard !reconcileInFlight else { return }
        reconcileInFlight = true
        defer { reconcileInFlight = false }

        try? await Task.sleep(nanoseconds: Self.coalescingWindowNanoseconds)

        while pendingReconcile {
            pendingReconcile = false
            let forceThisPass = pendingForce
            pendingForce = false
            await performReconcile(force: forceThisPass)
        }
    }

    private func performReconcile(force: Bool) async {
        lastError = nil

        // 1. Every favorite needs a well-formed, unique OSType code before
        //    anything can be declared for it.
        phase = .building

        let suppressed = releasedFavorites
        var favorites = configManager.config.favorites.filter { !suppressed.contains($0.id) }
        var collected: [String] = []

        if force {
            let revalidated = releaseConflictingCodes(in: favorites)
            favorites = revalidated.favorites
            collected += revalidated.warnings
        }

        let assignment = MigrationService.assignMissingOSTypes(to: favorites)
        favorites = assignment.favorites
        collected += assignment.warnings

        // 2. Rebuild the helper bundle. An unchanged digest costs nothing.
        let declarations = favorites
            .filter { $0.enabled }
            .compactMap { favorite -> IconHelperBundle.Declaration? in
                guard let osType = favorite.osType else { return nil }
                return IconHelperBundle.Declaration(
                    osType: osType,
                    symbolName: favorite.iconValue,
                    description: favorite.name,
                    customSVGPath: favorite.iconType == .custom ? favorite.customSVGPath : nil,
                    // Reduced to the default for a system symbol, so switching a
                    // favorite from a rescaled custom icon to an SF Symbol does not
                    // leave a value in the digest that changes nothing on screen.
                    iconScale: favorite.effectiveIconScale
                )
            }

        let previousDigest = configManager.config.helperDigest
        let generation = configManager.config.helperGeneration + 1
        let signing = configManager.config.settings.signingIdentity

        let build = await enqueue {
            HelperBuilder.build(
                declarations: declarations,
                previousDigest: previousDigest,
                generation: generation,
                signing: signing,
                force: force
            )
        }

        collected += build.warnings
        if let digest = build.digest, let builtGeneration = build.generation {
            do {
                try configManager.setHelperState(digest: digest, generation: builtGeneration)
            } catch {
                collected.append("Couldn't record the icon helper state: \(error.localizedDescription)")
            }
        }

        if let error = build.error {
            // The previous bundle is still on disk and still registered. Stop here
            // rather than pointing sidebar rows at codes nothing declares; the next
            // reconcile retries the whole chain.
            lastError = error
            publishWarnings(collected)
            phase = .idle
            releasedFavorites.subtract(suppressed)
            return
        }

        // A row's OverrideIcon.OSType is not the only thing Finder caches: it also
        // caches the artwork that code resolves to. Changing a favorite's SVG, or
        // picking a different symbol for it, keeps the same 4-character code, so no
        // row property moves and step 4 below sees nothing to report - but the
        // Assets.car behind that code is new, and Finder goes on drawing the old
        // icon until it relaunches. Whether the helper's content actually changed is
        // the only signal that covers those edits, so it is taken here rather than
        // inferred from the rows.
        if build.contentChanged {
            needsFinderRestart = true
        }

        // 3. Reconcile the rows against one live snapshot. Bound to a `let` first:
        //    a `var` captured by a concurrently-executing closure is a Swift 6 error.
        let reconciled = favorites
        phase = .reconciling
        let rows = await enqueue { SidebarReconciler.reconcile(favorites: reconciled) }

        collected += rows.warnings
        if let error = rows.error {
            lastError = error
        }
        collected += applyBindings(rows.bindings)
        boundItems = rows.boundItems

        // 4. Never restart Finder as a side effect of a reconcile - a reconcile can
        //    be triggered by launching the window or saving an unrelated edit, and
        //    the user may be halfway through a copy. Record that a restart is owed
        //    and let the UI offer it; the flag is sticky until `restartFinder()`
        //    actually runs, so a restart owed by an earlier pass is not forgotten.
        if rows.needsFinderRestart {
            needsFinderRestart = true
        }

        // 5. Publish.
        publishWarnings(collected)
        phase = .idle
        releasedFavorites.subtract(suppressed)
    }

    /// Give up the sidebar rows a set of favorites owns, without reconciling.
    /// Used by delete and by a folder change, both of which need the teardown to
    /// have happened by the time they return.
    private func release(_ favorites: [Favorite], persistUnbinding: Bool) async {
        guard !favorites.isEmpty else { return }
        guard !deferForMigrationConsent() else { return }

        phase = .reconciling
        let outcome = await enqueue { SidebarReconciler.release(favorites: favorites) }

        var collected = outcome.warnings
        if let error = outcome.error {
            lastError = error
        }
        if persistUnbinding {
            collected += applyBindings(outcome.bindings)
        }
        for binding in outcome.bindings {
            boundItems.removeValue(forKey: binding.id)
        }
        if outcome.needsFinderRestart {
            needsFinderRestart = true
        }

        stickyWarnings.append(contentsOf: collected)
        publishWarnings([])
        phase = .idle
    }

    // MARK: - Bookkeeping

    private func applyBindings(_ bindings: [BindingUpdate]) -> [String] {
        var warnings: [String] = []

        for binding in bindings {
            do {
                try configManager.bindSidebarItem(
                    id: binding.id,
                    itemID: binding.itemID,
                    provenance: binding.provenance
                )
            } catch {
                warnings.append("Couldn't save the sidebar link for '\(binding.name)': \(error.localizedDescription)")
            }
        }

        return warnings
    }

    private func publishWarnings(_ reconcileWarnings: [String]) {
        var seen = Set<String>()
        warnings = (stickyWarnings + reconcileWarnings).filter { seen.insert($0).inserted }
    }

    /// Release any code a third-party app has declared since we allocated it.
    ///
    /// Only run on an explicit refresh: the allocation-time probe cannot see the
    /// future, but re-probing on every reconcile would cost a Launch Services
    /// lookup per favorite for a case that is close to unreachable. The freed code
    /// is re-minted by `assignMissingOSTypes`, whose own probe skips the claimed one.
    private func releaseConflictingCodes(in favorites: [Favorite]) -> (favorites: [Favorite], warnings: [String]) {
        var result = favorites
        var warnings: [String] = []

        for index in result.indices {
            guard let code = result[index].osType,
                  let claimant = Self.foreignClaimant(of: code) else {
                continue
            }
            warnings.append("'\(result[index].name)' used icon code \(code), which is now claimed by \(claimant). A new code was assigned.")
            result[index].osType = nil
        }

        return (result, warnings)
    }

    /// The identifier of a UTI someone other than our helper declares for this
    /// OSType, if any.
    private nonisolated static func foreignClaimant(of code: String) -> String? {
        guard let type = UTType(
            tag: code,
            tagClass: UTTagClass(rawValue: "com.apple.ostype"),
            conformingTo: nil
        ), type.isDeclared,
              !type.identifier.lowercased().hasPrefix(OSTypeAllocator.ourUTIPrefix) else {
            return nil
        }
        return type.identifier
    }

    /// Append a unit of blocking work to the serial chain and wait for it.
    ///
    /// The chain matters: `SidebarItemManager` takes one live snapshot, decides
    /// against it and mutates, so two operations interleaving their snapshot and
    /// mutate steps would act on stale rows.
    @discardableResult
    private func enqueue<T: Sendable>(_ work: @escaping @Sendable () -> T) async -> T {
        let previous = pipeline

        let task = Task.detached(priority: .userInitiated) { () -> T in
            await previous?.value
            return work()
        }

        // Kept as a value-less task so the next caller can wait on it whatever
        // this one's result type is.
        pipeline = Task { _ = await task.value }

        return await task.value
    }
}

// MARK: - Off-the-main-actor work
//
// Everything below runs on a detached task. It reads immutable snapshots and
// returns a description of what it did; applying that to `@Published` state and
// to config.json is the coordinator's job, back on the main actor.

/// What one helper rebuild produced.
private struct BuildOutcome: Sendable {
    var digest: String?
    var generation: Int?
    /// True when the rebuilt bundle declares something other than what Finder has
    /// already cached - see `IconHelperBundle.BuildResult.contentChanged`.
    var contentChanged = false
    var warnings: [String] = []
    /// Non-nil when the build failed and the rows must not be touched.
    var error: String?
}

/// What one pass over Finder's Favorites list did.
private struct RowOutcome: Sendable {
    var bindings: [BindingUpdate] = []
    var warnings: [String] = []
    var boundItems: [UUID: UInt32] = [:]
    var needsFinderRestart = false
    /// Non-nil when the list itself could not be read.
    var error: String?
}

/// A binding the coordinator must persist through `ConfigManager`.
private struct BindingUpdate: Sendable {
    let id: UUID
    let name: String
    let itemID: UInt32?
    let provenance: Favorite.SidebarProvenance

    init(_ favorite: Favorite, itemID: UInt32?, provenance: Favorite.SidebarProvenance) {
        self.id = favorite.id
        self.name = favorite.name
        self.itemID = itemID
        self.provenance = provenance
    }
}

private enum HelperBuilder {
    static func build(
        declarations: [IconHelperBundle.Declaration],
        previousDigest: String?,
        generation: Int,
        signing: SigningIdentity,
        force: Bool
    ) -> BuildOutcome {
        do {
            let result = try IconHelperBundle.shared.rebuild(
                declarations: declarations,
                previousDigest: previousDigest,
                generation: generation,
                signing: signing,
                force: force
            )
            return BuildOutcome(
                digest: result.digest,
                generation: result.generation,
                contentChanged: result.contentChanged,
                warnings: result.warnings
            )
        } catch {
            return BuildOutcome(error: error.localizedDescription)
        }
    }
}

/// The row half of the reconcile: matching favorites to rows, and the four
/// transitions that follow from `enabled` plus the recorded provenance.
private enum SidebarReconciler {
    // MARK: Passes

    /// Bring every row in line with the favorites, from one live snapshot.
    static func reconcile(favorites: [Favorite]) -> RowOutcome {
        var outcome = RowOutcome()

        guard var rows = snapshot(into: &outcome) else { return outcome }

        for favorite in favorites {
            let match = match(favorite, in: rows)
            if let warning = match.warning {
                outcome.warnings.append(warning)
            }

            // A favorite whose code could not be allocated has already been warned
            // about; it is left exactly as it is rather than half-applied.
            if favorite.enabled, let osType = favorite.osType {
                apply(favorite: favorite, osType: osType, match: match, rows: &rows, outcome: &outcome)
            } else if !favorite.enabled {
                withdraw(favorite: favorite, row: match.row, rows: &rows, outcome: &outcome)
            }
        }

        return outcome
    }

    /// Give up the rows these favorites own, whatever their enabled state.
    static func release(favorites: [Favorite]) -> RowOutcome {
        var outcome = RowOutcome()

        guard var rows = snapshot(into: &outcome) else { return outcome }

        for favorite in favorites {
            // The match warning is noise here: the row is being given up either way.
            let match = match(favorite, in: rows)
            withdraw(favorite: favorite, row: match.row, rows: &rows, outcome: &outcome)
        }

        return outcome
    }

    private static func snapshot(into outcome: inout RowOutcome) -> [SidebarItem]? {
        do {
            return try SidebarItemManager.shared.snapshot()
        } catch {
            outcome.error = "Couldn't read Finder's sidebar: \(error.localizedDescription)"
            return nil
        }
    }

    // MARK: Transitions

    private static func apply(
        favorite: Favorite,
        osType: String,
        match: RowMatch,
        rows: inout [SidebarItem],
        outcome: inout RowOutcome
    ) {
        let manager = SidebarItemManager.shared

        guard let row = match.row else {
            guard !match.bindingWentStale else {
                // The binding pointed at a row that has moved on and nothing else
                // matches. Inserting here is how a moved folder ends up with two
                // rows: clear the binding and let the next pass start clean.
                outcome.bindings.append(BindingUpdate(favorite, itemID: nil, provenance: .unbound))
                return
            }

            guard folderExists(at: favorite.expandedFolderPath) else {
                outcome.warnings.append("\(favorite.name): folder no longer exists at \(favorite.folderPath)")
                if favorite.sidebarItemID != nil || favorite.sidebarProvenance != .unbound {
                    outcome.bindings.append(BindingUpdate(favorite, itemID: nil, provenance: .unbound))
                }
                return
            }

            do {
                let inserted = try manager.upsert(
                    url: favorite.folderURL,
                    displayName: favorite.name,
                    osType: osType
                )

                // BASE CASE of the ownership induction. Finder's Favorites list
                // de-duplicates by URL, so this call is an insert only when the row
                // it produced was not in the list a moment ago. If it WAS, path
                // matching missed a row the user already had (a spelling the
                // equivalence check does not cover) and the write landed on theirs -
                // which is emphatically not a row we may ever delete.
                let preexisting = rows.first { $0.itemID == inserted.itemID }
                store(inserted, in: &rows)

                guard let preexisting else {
                    outcome.bindings.append(BindingUpdate(favorite, itemID: inserted.itemID, provenance: .managed))
                    outcome.boundItems[favorite.id] = inserted.itemID
                    // Deliberately no Finder restart: a row inserted with the
                    // override already set draws with its custom icon immediately.
                    return
                }

                adoptExisting(
                    favorite: favorite,
                    osType: osType,
                    row: inserted,
                    restoringDisplayName: preexisting.displayName,
                    rows: &rows,
                    outcome: &outcome
                )

                // The override went onto a row that was already on screen, so unlike
                // a genuine insert this one does need Finder to redraw.
                if preexisting.osType != osType {
                    outcome.needsFinderRestart = true
                }
            } catch {
                outcome.warnings.append("Couldn't add '\(favorite.name)' to Finder's sidebar: \(error.localizedDescription)")
            }
            return
        }

        // OWNERSHIP GATE. `.managed` means "this app inserted THIS row", and the
        // only thing that can still say so is the persisted binding naming this
        // exact item ID. A `.managed` favorite matched to some OTHER row - because
        // macOS pruned ours while an unmounted volume was away, or the user removed
        // it and dragged the folder back in themselves - is looking at the user's
        // row, and `match` (which falls back to a path match) cannot tell the
        // difference. Treating it as managed would rename it now and, once the
        // binding was rewritten to point at it, delete it later. So it drops to the
        // adopt path instead: icon only, never renamed, never removed.
        //
        // INDUCTIVE STEP of the ownership proof: `.managed` is carried forward only
        // onto a row that was already proven ours; the base case is the insert above.
        let ownsRow = favorite.sidebarProvenance == .managed && favorite.sidebarItemID == row.itemID

        guard ownsRow else {
            if favorite.sidebarProvenance == .managed {
                outcome.warnings.append("'\(favorite.name)' is now linked to a sidebar row this app didn't add, so only its icon is applied - the row's name is left as it is and it won't be removed.")
            }
            // The folder is already in the user's sidebar - adopt that row. Only the
            // icon override is set; the name the user gave it is never touched, and a
            // later delete restores the icon rather than removing the row.
            adoptExisting(favorite: favorite, osType: osType, row: row, rows: &rows, outcome: &outcome)
            return
        }

        var current = row

        if row.osType != osType {
            do {
                try manager.setOSType(osType, itemID: row.itemID)
                outcome.needsFinderRestart = true
            } catch {
                outcome.warnings.append("Couldn't update the icon for '\(favorite.name)': \(error.localizedDescription)")
            }
        }

        if row.displayName != favorite.name {
            // Renaming is reachable ONLY from here, i.e. only for a row whose ID the
            // binding still names. A row the user labelled themselves is never
            // relabelled - the guard above sent it to `adoptExisting` instead.
            //
            // In-place upsert: inserting a URL the list already holds keeps the row's
            // position and persistent ID and just rewrites its label. The row's own
            // path is used, not the favorite's - the two can be different spellings of
            // the same folder, and inserting the other spelling is the one way to end
            // up with a duplicate row.
            if let path = row.path {
                do {
                    let patched = try manager.upsert(
                        url: URL(fileURLWithPath: path),
                        displayName: favorite.name,
                        osType: osType
                    )
                    store(patched, in: &rows)

                    guard patched.itemID == row.itemID else {
                        // The in-place upsert is documented (and measured) to keep the
                        // row's ID. A different one means the list held a second row
                        // for this location and the write landed on that one, whose
                        // ownership is not established - bind to it as adopted so it
                        // can never be deleted, and say what happened.
                        outcome.warnings.append("The sidebar row for '\(favorite.name)' was replaced by another row for the same folder; it is now treated as one you added and won't be removed.")
                        outcome.bindings.append(BindingUpdate(favorite, itemID: patched.itemID, provenance: .adopted))
                        outcome.boundItems[favorite.id] = patched.itemID
                        return
                    }
                    current = patched
                } catch {
                    outcome.warnings.append("Couldn't rename the sidebar row for '\(favorite.name)': \(error.localizedDescription)")
                }
            } else {
                outcome.warnings.append("Couldn't rename the sidebar row for '\(favorite.name)': its location could not be resolved.")
            }
        }

        outcome.bindings.append(BindingUpdate(favorite, itemID: current.itemID, provenance: .managed))
        outcome.boundItems[favorite.id] = current.itemID
    }

    /// Put our icon on a row we did not create, and record it as `.adopted`.
    ///
    /// The single place `.adopted` is written, and the destination of every path
    /// that cannot prove the row is ours. Nothing here removes a row, and the
    /// label is only ever written to put back one the caller says we overwrote.
    private static func adoptExisting(
        favorite: Favorite,
        osType: String,
        row: SidebarItem,
        restoringDisplayName: String? = nil,
        rows: inout [SidebarItem],
        outcome: inout RowOutcome
    ) {
        let manager = SidebarItemManager.shared
        var current = row

        // An empty name is never restored: `SFLBridge` rejects it, and writing one
        // would reset the row's label to the folder's file-system name.
        if let restoringDisplayName, !restoringDisplayName.isEmpty, restoringDisplayName != row.displayName {
            // We reached this row through an insert that turned out to be an in-place
            // update of the user's own row, so its label is currently ours. Put theirs
            // back - the same URL hits the same row, which is what the ID match that
            // sent us here proved.
            do {
                let restored = try manager.upsert(
                    url: favorite.folderURL,
                    displayName: restoringDisplayName,
                    osType: osType
                )
                store(restored, in: &rows)
                current = restored
            } catch {
                outcome.warnings.append("'\(favorite.name)' was already in Finder's sidebar as '\(restoringDisplayName)'. Its name could not be put back: \(error.localizedDescription)")
            }
        }

        if current.osType != osType {
            do {
                try manager.setOSType(osType, itemID: current.itemID)
                // The row was already on screen, so Finder has to relaunch to redraw it.
                outcome.needsFinderRestart = true
            } catch {
                outcome.warnings.append("Couldn't apply the icon for '\(favorite.name)' to its sidebar row: \(error.localizedDescription)")
            }
        }

        outcome.bindings.append(BindingUpdate(favorite, itemID: current.itemID, provenance: .adopted))
        outcome.boundItems[favorite.id] = current.itemID
    }

    /// The disabled / deleted / re-pathed branch: give the row up.
    private static func withdraw(
        favorite: Favorite,
        row: SidebarItem?,
        rows: inout [SidebarItem],
        outcome: inout RowOutcome
    ) {
        // A row this favorite never claimed is not ours to touch.
        guard favorite.sidebarProvenance != .unbound else { return }

        guard let row else {
            outcome.bindings.append(BindingUpdate(favorite, itemID: nil, provenance: .unbound))
            return
        }

        // Re-read the row from the live list before touching it. `rows` was taken at
        // the top of the pass and has been mutated since; Finder and the user can
        // both have changed the list in between. Every branch below either deletes a
        // row or rewrites one, so the decision is made against what is there NOW.
        let live: SidebarItem?
        do {
            live = try SidebarItemManager.shared.item(withID: row.itemID)
        } catch {
            // Cannot see the list: change nothing, keep the binding, let the next
            // pass retry. Withdrawing the binding here would forfeit the only proof
            // that a row we did insert is ours.
            outcome.warnings.append("Couldn't check the sidebar row for '\(favorite.name)', so it was left alone: \(error.localizedDescription)")
            return
        }

        guard let live else {
            // Already gone - somebody removed it first. Nothing to delete, and
            // nothing to restore: `clearOSType` goes through an insert, so calling
            // it for a row that is no longer in the list would ADD one back.
            rows.removeAll { $0.itemID == row.itemID }
            outcome.bindings.append(BindingUpdate(favorite, itemID: nil, provenance: .unbound))
            return
        }

        // SAFETY INVARIANT: a row is deleted only when this app inserted it.
        //
        // That is proved rather than assumed. `.managed` is written in exactly two
        // places, both in `apply`: onto a row whose item ID was NOT in the list
        // immediately before we inserted it (base case), and onto a row whose ID the
        // binding already names (inductive step). A row the user created can
        // therefore never acquire `.managed` - which is what the second clause here
        // rests on, and why `apply`'s ownership gate is load-bearing rather than
        // cosmetic. The third clause is checked against the row as it is right now,
        // not against the snapshot the pass began with.
        //
        // Anything else degrades to restoring the icon and leaving the row alone.
        let ownedByUs = favorite.sidebarProvenance == .managed
            && favorite.sidebarItemID == live.itemID
            && live.matches(anyOf: favorite.pathMatchCandidates)

        if ownedByUs {
            do {
                try SidebarItemManager.shared.remove(itemID: live.itemID)
                rows.removeAll { $0.itemID == live.itemID }
                // Removing a row needs no redraw of anything that is still visible.
            } catch {
                outcome.warnings.append("Couldn't remove the sidebar row for '\(favorite.name)': \(error.localizedDescription)")
            }
            outcome.bindings.append(BindingUpdate(favorite, itemID: nil, provenance: .unbound))
            return
        }

        if favorite.sidebarProvenance == .managed {
            outcome.warnings.append("The sidebar row for '\(favorite.name)' is not the one the app added, so it was left in place with its normal icon restored.")
        }

        outcome.bindings.append(BindingUpdate(favorite, itemID: nil, provenance: .unbound))

        guard let currentCode = live.osType else { return }

        // Only ever clear an override this app could have written. Our codes are
        // `OSTypeAllocator`-shaped ("S" plus three characters of its alphabet);
        // anything else was set by whoever owns that row, and stripping it would be
        // destroying someone else's customisation. The equality test covers a code
        // that predates a re-allocation.
        guard currentCode == favorite.osType || OSTypeAllocator.isWellFormed(currentCode) else {
            outcome.warnings.append("The sidebar row for '\(favorite.name)' carries an icon this app didn't set, so it was left untouched.")
            return
        }

        guard let path = live.path else {
            outcome.warnings.append("Couldn't restore the icon on the sidebar row for '\(favorite.name)': its location could not be resolved.")
            return
        }

        do {
            // Clearing goes through the upsert's propertiesToClear - passing NULL
            // to LSSharedFileListItemSetProperty crashes. The row's current name
            // has to be passed back in or the label resets to the folder's own name.
            try SidebarItemManager.shared.clearOSType(
                url: URL(fileURLWithPath: path),
                displayName: live.displayName
            )
            store(
                SidebarItem(itemID: live.itemID, displayName: live.displayName, path: live.path, osType: nil),
                in: &rows
            )
            outcome.needsFinderRestart = true
        } catch {
            outcome.warnings.append("Couldn't restore the icon on the sidebar row for '\(favorite.name)': \(error.localizedDescription)")
        }
    }

    // MARK: Matching

    /// Bind by the persisted item ID first, by path second.
    ///
    /// The ID is stable across processes, but a sidebar row follows its bookmark
    /// when the folder moves while `folderPath` does not, and IDs can be recycled -
    /// so an ID match that resolves somewhere this favorite does not claim is
    /// discarded rather than mutated.
    private static func match(_ favorite: Favorite, in rows: [SidebarItem]) -> RowMatch {
        let candidates = favorite.pathMatchCandidates
        let byPath = rows.first { $0.matches(anyOf: candidates) }

        guard let itemID = favorite.sidebarItemID,
              let bound = rows.first(where: { $0.itemID == itemID }) else {
            // No binding, or the row is simply gone - macOS prunes rows whose
            // folder was deleted. Path matching decides.
            return RowMatch(row: byPath, bindingWentStale: false, warning: nil)
        }

        if bound.matches(anyOf: candidates) {
            return RowMatch(row: bound, bindingWentStale: false, warning: nil)
        }

        let elsewhere = bound.path ?? "an unknown location"

        if let byPath {
            return RowMatch(
                row: byPath,
                bindingWentStale: false,
                warning: "'\(favorite.name)' was linked to a sidebar row that now points at \(elsewhere); it was re-linked to the row for \(byPath.path ?? favorite.folderPath)."
            )
        }

        return RowMatch(
            row: nil,
            bindingWentStale: true,
            warning: "'\(favorite.name)' was linked to a sidebar row that now points at \(elsewhere). The link was cleared - refresh to add a row for \(favorite.folderPath)."
        )
    }

    private static func folderExists(at path: String) -> Bool {
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory)
        return exists && isDirectory.boolValue
    }

    /// Keep the local snapshot in step with what was just written, so a later
    /// favorite in the same pass matches against reality.
    private static func store(_ item: SidebarItem, in rows: inout [SidebarItem]) {
        if let index = rows.firstIndex(where: { $0.itemID == item.itemID }) {
            rows[index] = item
        } else {
            rows.append(item)
        }
    }
}

private struct RowMatch {
    let row: SidebarItem?
    /// True when the persisted binding pointed at a row that is no longer this
    /// favorite's and nothing else matched. No row may be inserted in that pass.
    let bindingWentStale: Bool
    let warning: String?
}

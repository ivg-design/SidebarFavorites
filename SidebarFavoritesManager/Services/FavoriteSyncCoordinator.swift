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

    /// The task draining `pendingReconcile`, while one is running.
    ///
    /// A handle rather than a flag because callers depend on `requestReconcile`
    /// having done the work when it returns - the Add/Edit sheet's Apply restarts
    /// Finder on the next line - so a request that arrives mid-pass waits for the
    /// pass that will service it instead of returning early.
    private var reconcileDriver: Task<Void, Never>?
    private var pendingReconcile = false
    private var pendingForce = false

    /// How many "Remove All Sidebar Icons" runs currently own the pipeline.
    ///
    /// Everything a teardown undoes would be re-applied by a reconcile that ran
    /// alongside it, so while this is non-zero no pass may start and a pass already
    /// suspended mid-flight abandons. A count rather than a flag so two runs - the
    /// Settings button is clickable again the moment the confirmation is dismissed -
    /// cannot have the first to finish clear the second's claim.
    private var activeTeardowns = 0
    private var teardownInFlight: Bool { activeTeardowns > 0 }

    /// Bumped by each teardown. A pass captures it before suspending and compares
    /// afterwards: a different value means a teardown took the pipeline over while
    /// the helper was building, and this pass's conclusions are all stale.
    private var teardownEpoch = 0

    /// Favorites whose rows have just been released by an explicit delete. The
    /// caller drops them from the config the moment `favoriteRemoved` returns, but
    /// the reconcile that follows may still observe them - and it must not
    /// re-insert a row for a favorite that is on its way out.
    private var releasedFavorites: Set<UUID> = []

    /// Ids owned by a `favoriteRemoved` that has not returned yet. The favorite is
    /// still in the config until it does, so its suppression has to survive a
    /// forced refresh - dropping it re-inserts the row the delete just released.
    private var releasesInFlight: Set<UUID> = []

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
            // Drop stale suppressions - one leaked by a `release` that bailed at the
            // migration gate, say - but never one whose delete is still running:
            // that favorite is still in the config (the caller removes it only once
            // `favoriteRemoved` returns), so un-suppressing it here re-inserts the
            // row the delete has just taken away.
            releasedFavorites.formIntersection(releasesInFlight)
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

        // Owned until this returns, which is exactly the window in which the
        // favorite is still in the config - see `releasesInFlight`. The `defer`
        // runs on the main actor immediately before the caller's `removeFavorite`.
        releasesInFlight.insert(favorite.id)
        defer { releasesInFlight.remove(favorite.id) }

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
        // The same gate the other two mutating entry points use. Without it a
        // pre-1.0 config - every favorite still `.unbound`, the legacy apps still
        // installed - reports "All sidebar icons were removed" having done nothing.
        guard !deferForMigrationConsent() else {
            return ["The upgrade to version 1.0 hasn't finished, so nothing was removed. Finish the upgrade, then try again."]
        }

        // Claim the pipeline. A reconcile running alongside this would re-insert and
        // re-override every row the release just gave up, and would do it AFTER the
        // helper bundle had been unregistered and deleted - so the destructive
        // action the user confirmed would silently undo itself and leave the rows
        // pointing at Launch Services records that no longer exist.
        activeTeardowns += 1
        teardownEpoch += 1
        // A queued pass must not start after the teardown either.
        pendingReconcile = false
        pendingForce = false
        defer { activeTeardowns -= 1 }

        let favorites = configManager.config.favorites

        phase = .reconciling
        // Release and teardown as ONE unit of pipeline work: nothing can be
        // enqueued between them.
        let (outcome, teardownWarnings) = await enqueue { () -> (RowOutcome, [String]) in
            let released = SidebarReconciler.release(favorites: favorites)
            // The helper is unregistered and deleted. `helperDigest` is deliberately
            // left alone: the digest short-circuit also requires the bundle to exist
            // on disk, so the next reconcile rebuilds it from scratch anyway.
            return (released, IconHelperBundle.shared.teardown())
        }

        var collected = outcome.warnings
        if let error = outcome.error {
            lastError = error
            collected.append(error)
        }
        collected += applyBindings(outcome.bindings)
        boundItems = [:]
        collected += teardownWarnings

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

    /// Funnel for every entry point: one driver task plus a coalescing window, so
    /// concurrent requests collapse into one pass and a request that arrives
    /// mid-pass still gets a pass of its own afterwards.
    ///
    /// Returns only once a pass that INCLUDED this request has finished, whether
    /// this call drove it or somebody else did. Callers depend on that: the sheet's
    /// Apply awaits this and then restarts Finder, and a Finder that relaunches
    /// before the edit has been applied redraws the old artwork and greys the
    /// button out with no way to retry.
    private func requestReconcile(force: Bool) async {
        guard !deferForMigrationConsent() else { return }
        // A teardown owns the pipeline; anything this pass did would be undone by
        // it, or worse, would outlive it.
        guard !teardownInFlight else { return }

        pendingReconcile = true
        pendingForce = pendingForce || force

        // Somebody else owns the loop. It cannot exit while `pendingReconcile` is
        // set, so waiting on it waits for a pass that services this request too.
        if let driver = reconcileDriver {
            await driver.value
            return
        }

        let driver = Task { @MainActor in
            try? await Task.sleep(nanoseconds: Self.coalescingWindowNanoseconds)

            while self.pendingReconcile && !self.teardownInFlight {
                self.pendingReconcile = false
                let forceThisPass = self.pendingForce
                self.pendingForce = false
                await self.performReconcile(force: forceThisPass)
            }

            // Cleared in the same synchronous step as the loop's final check, so a
            // request arriving between the two can never be dropped: it either sets
            // `pendingReconcile` before the check and is served by this loop, or it
            // finds no driver and starts one.
            self.reconcileDriver = nil
        }
        reconcileDriver = driver
        await driver.value
    }

    private func performReconcile(force: Bool) async {
        // Captured before the first suspension - see the check after the build.
        let epoch = teardownEpoch
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

        guard epoch == teardownEpoch else {
            // "Remove All Sidebar Icons" took the pipeline over while the helper was
            // building. Touch no rows and publish nothing - not `phase`, not
            // `boundItems`, not `lastError`: they belong to the teardown now, and
            // every row this pass was about to write has just been given up on the
            // user's explicit instruction. The bundle this build produced is deleted
            // by the teardown's own step, and `helperDigest` is deliberately not
            // recorded for it.
            retireSuppressions(suppressed)
            return
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
            retireSuppressions(suppressed)
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
        //
        //    `favorites` was snapshotted before the build, and the build suspends
        //    this actor for seconds - long enough for `favoriteRemoved` or
        //    `favoriteUpdated` to run on it, release a row and rewrite config.json
        //    underneath us. Re-derive against what is true NOW: a favorite deleted
        //    mid-build must not have its row re-inserted (nothing could ever remove
        //    it again - it is gone from the config, so no later pass and not even
        //    "Remove All Sidebar Icons" will revisit it), and one whose folder moved
        //    must be reconciled against its new path. The staged `osType` is carried
        //    over because that is the code the helper was just built with.
        //
        //    Iterating the staged array rather than the live config means a favorite
        //    ADDED during the build is still skipped here - correct, since the helper
        //    does not declare it yet, and `favoriteAdded` has already set
        //    `pendingReconcile`, so the driver gives it a pass of its own.
        let live = Dictionary(
            configManager.config.favorites.map { ($0.id, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        let reconciled: [Favorite] = favorites.compactMap { staged in
            guard !releasedFavorites.contains(staged.id),
                  var current = live[staged.id] else { return nil }
            current.osType = staged.osType
            return current
        }

        phase = .reconciling
        let rows = await enqueue {
            // A forced pass is the user asking for repair (Refresh, or the first
            // pass after launch). Rows whose stored state already looks right are
            // rewritten anyway, because Finder can be drawing something else.
            SidebarReconciler.reconcile(
                favorites: reconciled,
                restamp: force ? .forced : .none
            ) { update in
                // Checkpoint: a binding for a row we have just inserted reaches
                // config.json before the next favorite is touched, so an interrupted
                // pass cannot strand an app-created row as one we may never remove.
                // `ConfigManager` hops to the main thread itself; this pass runs on
                // the pipeline's detached task, with the main actor suspended at the
                // `await` above.
                try? ConfigManager.shared.bindSidebarItem(
                    id: update.id,
                    itemID: update.itemID,
                    provenance: update.provenance
                )
            }
        }

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

        // 5. Publish. The phase is left alone when a teardown that started mid-pass
        //    now owns the pipeline - reporting "Ready" while it is still unregistering
        //    the helper would be the same clobber the epoch check above prevents.
        publishWarnings(collected)
        if !teardownInFlight { phase = .idle }
        retireSuppressions(suppressed)
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

    /// Retire the suppressions a finished pass honoured.
    ///
    /// All of them except any whose `favoriteRemoved` has not returned yet: until
    /// it does, the favorite is still in config.json, so dropping its suppression
    /// here lets the very next pass re-insert the row the delete just released -
    /// an orphan no later pass could remove, because by then the favorite is gone.
    private func retireSuppressions(_ suppressed: Set<UUID>) {
        releasedFavorites.subtract(suppressed.subtracting(releasesInFlight))
    }

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
    ///
    /// `checkpoint` is called with each binding the moment it is decided, so the
    /// caller can persist it before the pass moves on; the same bindings are also
    /// returned in `outcome` for the caller's own idempotent write at the end.
    /// Rewrite every bound row's icon even when it already carries the right code.
    ///
    /// Finder can stop drawing a row's override while the property itself is
    /// still on the row: measured on macOS 26, any metadata change on a target
    /// that has an icon of its own (a folder with a custom Finder icon, a volume
    /// with `.VolumeIcon.icns`) makes Finder repaint that target's own icon over
    /// ours. Nothing about the stored state changed, so an ordinary reconcile
    /// sees nothing to do and the user's Refresh appears to do nothing.
    ///
    /// Rewriting the row - not the property - is what makes Finder redraw it.
    struct RestampPolicy: Sendable {
        static let none = RestampPolicy(isForced: false)
        static let forced = RestampPolicy(isForced: true)
        let isForced: Bool
    }

    static func reconcile(
        favorites: [Favorite],
        restamp: RestampPolicy = .none,
        checkpoint: @Sendable (BindingUpdate) -> Void = { _ in }
    ) -> RowOutcome {
        var outcome = RowOutcome()

        guard var rows = snapshot(into: &outcome) else { return outcome }

        // Finder's Favorites list de-duplicates by URL, so two favorites pointing at
        // the same folder resolve to ONE row - while `assignMissingOSTypes`
        // guarantees they hold DIFFERENT codes. Letting both write their override
        // makes every pass a fight: the row flips artwork on each Finder relaunch and
        // `needsFinderRestart` is re-armed for ever, so the banner can never be
        // dismissed. First favorite in config order wins the row; the rest are
        // reported and left alone. Config order is stable, so the same one wins every
        // pass, and this also heals a config that already contains such a pair.
        var claimedRows: Set<UInt32> = []

        reportOwnIcons(favorites, outcome: &outcome)

        for favorite in favorites {
            let match = match(favorite, in: rows)
            if let warning = match.warning {
                outcome.warnings.append(warning)
            }

            if favorite.locationsOnly {
                applyLocationsOnly(favorite, match: match, rows: &rows, outcome: &outcome)
                continue
            }

            // A favorite whose code could not be allocated has already been warned
            // about; it is left exactly as it is rather than half-applied.
            if favorite.enabled, let osType = favorite.osType {
                if let row = match.row, claimedRows.contains(row.itemID) {
                    outcome.warnings.append("'\(favorite.name)' points at the same folder as another favorite, which already owns that sidebar row. Only one icon can be shown there, so this favorite's icon was not applied.")
                    // Unbound rather than left pointing at the winner's row: a later
                    // delete of this favorite must not strip the winner's override.
                    if favorite.sidebarItemID != nil || favorite.sidebarProvenance != .unbound {
                        outcome.bindings.append(BindingUpdate(favorite, itemID: nil, provenance: .unbound))
                    }
                    continue
                }

                apply(favorite: favorite, osType: osType, match: match, restamp: restamp, rows: &rows, outcome: &outcome, checkpoint: checkpoint)

                // Covers the insert path too, where `apply` lands on a row that was
                // not in `match`. Every branch that touches a row records it here.
                if let bound = outcome.boundItems[favorite.id] {
                    claimedRows.insert(bound)
                }
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

            // A Locations-only favorite has no row to withdraw, so its override
            // has to be cleared from Finder's row explicitly.
            if favorite.locationsOnly {
                mirrorToLocations(osType: nil,
                                  path: favorite.expandedFolderPath,
                                  favoriteName: favorite.name,
                                  outcome: &outcome)
            }
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
        restamp: RestampPolicy = .none,
        rows: inout [SidebarItem],
        outcome: inout RowOutcome,
        checkpoint: @Sendable (BindingUpdate) -> Void = { _ in }
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
                let result = try manager.upsert(
                    url: favorite.folderURL,
                    displayName: favorite.name,
                    osType: osType
                )
                let inserted = result.row

                // BASE CASE of the ownership induction. Finder's Favorites list
                // de-duplicates by URL, so this call is an insert only when the row
                // it produced was not in the list a moment ago. If it WAS, either
                // path matching missed a row the user already had (a spelling the
                // equivalence check does not cover) or they added one WHILE this
                // pass was running - and the write landed on theirs, which is
                // emphatically not a row we may ever rename or delete.
                //
                // Asked of the insert's OWN snapshot, taken microseconds before it
                // anchored, rather than of `rows`: that was read at the top of the
                // pass and every upsert since is two XPC round-trips to
                // sharedfilelistd, so a row dragged in mid-pass is missing from it.
                // `withdraw` re-reads live for the same reason. The stale snapshot
                // stays as a backstop, so nothing this used to catch is lost.
                let preexisting = result.preexisting ?? rows.first { $0.itemID == inserted.itemID }
                store(inserted, in: &rows)

                guard let preexisting else {
                    let update = BindingUpdate(favorite, itemID: inserted.itemID, provenance: .managed)
                    // On disk before the next favorite is touched: this is the one
                    // binding whose loss cannot be recovered from. Without it, a pass
                    // interrupted after the insert leaves a row the app created that
                    // the next launch can only adopt - and an adopted row is never
                    // removed, so it would stay in the sidebar for good, under a name
                    // the user never chose.
                    checkpoint(update)
                    outcome.bindings.append(update)
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
                    restamp: restamp,
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
            adoptExisting(favorite: favorite, osType: osType, row: row, restamp: restamp, rows: &rows, outcome: &outcome)
            return
        }

        var current = row

        if row.osType != osType {
            do {
                try manager.setOSType(osType, itemID: row.itemID)
                // Keep the snapshot honest about what was just written, so a later
                // favorite in this pass does not read the code as it was at the top.
                current = SidebarItem(itemID: row.itemID, displayName: row.displayName, path: row.path, osType: osType)
                store(current, in: &rows)
                outcome.needsFinderRestart = true
            } catch {
                outcome.warnings.append("Couldn't update the icon for '\(favorite.name)': \(error.localizedDescription)")
            }
        } else if restamp.isForced {
            current = repaint(row: row, osType: osType, favoriteName: favorite.name, rows: &rows, outcome: &outcome)
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
                    ).row
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

        mirrorToLocations(osType: osType, path: current.path, favoriteName: favorite.name, outcome: &outcome)

        outcome.bindings.append(BindingUpdate(favorite, itemID: current.itemID, provenance: .managed))
        outcome.boundItems[favorite.id] = current.itemID
    }

    /// A favorite that styles Finder's Locations row and owns no row of its own.
    ///
    /// Finder lists every mounted volume under Locations already, so this mode
    /// exists to icon that row instead of adding a second one under Favorites.
    /// Nothing is inserted, nothing is removed: the row is patched while the
    /// favorite is enabled and handed back untouched when it is not.
    private static func applyLocationsOnly(
        _ favorite: Favorite,
        match: RowMatch,
        rows: inout [SidebarItem],
        outcome: inout RowOutcome
    ) {
        // Switching an existing favorite into this mode gives up the Favorites row
        // it used to own, so the drive stops appearing twice.
        if match.row != nil || favorite.sidebarItemID != nil {
            withdraw(favorite: favorite, row: match.row, rows: &rows, outcome: &outcome)
        }

        let path = favorite.expandedFolderPath
        guard isVolumeRoot(path) else {
            outcome.warnings.append("'\(favorite.name)' is set to appear in Locations only, but Finder only lists mounted disks and servers there. Turn that option off to give it a row under Favorites.")
            return
        }

        guard favorite.enabled, let osType = favorite.osType else {
            mirrorToLocations(osType: nil, path: path, favoriteName: favorite.name, outcome: &outcome)
            return
        }

        mirrorToLocations(osType: osType, path: path, favoriteName: favorite.name, outcome: &outcome)

        // Finder owns the row, so there is no durable item ID to bind to. The
        // sentinel only tells the UI this favorite is live on screen; nothing
        // reads it as a row ID, and no binding is written for it.
        outcome.boundItems[favorite.id] = Self.locationsRowSentinel
    }

    /// Stands in for "live, but in a row Finder owns". Never used as an item ID.
    static let locationsRowSentinel: UInt32 = .max

    /// Report favorites whose target carries an icon of its own.
    ///
    /// The Add/Edit sheet says this when a folder is chosen, but a favorite added
    /// before this release - or a folder given an icon afterwards - never passes
    /// through it, and the symptom (an icon that keeps reverting) gives the user
    /// nothing to search for. Surfaced on every pass so it reaches the banner.
    private static func reportOwnIcons(_ favorites: [Favorite], outcome: inout RowOutcome) {
        for favorite in favorites where favorite.enabled {
            guard let detection = IconAuthority.detect(atPath: favorite.expandedFolderPath) else { continue }
            let subject = detection.isVolume ? "disk" : "folder"
            outcome.warnings.append(
                "'\(favorite.name)' keeps losing its sidebar icon because the \(subject) has a custom icon of its own. Open the favorite and choose Remove Its Icon to fix it permanently."
            )
        }
    }

    /// True when this path is the root of a mounted volume.
    ///
    /// Cheap and answered from the file system rather than the path's shape:
    /// `/Volumes/…` is a convention, not a rule, and the boot volume is `/`.
    private static func isVolumeRoot(_ path: String) -> Bool {
        (try? URL(fileURLWithPath: path).resourceValues(forKeys: [.isVolumeKey]).isVolume) == true
    }

    /// Mirror a favorite's icon onto the Locations row for the same volume.
    ///
    /// Finder lists every mounted volume under Locations whether or not it is a
    /// favorite, so a volume favorite is on screen twice; without this the two
    /// rows disagree. Failure is a warning, never fatal - the Favorites row, which
    /// is the one the user asked for, is already correct by the time this runs.
    private static func mirrorToLocations(
        osType: String?,
        path: String?,
        favoriteName: String,
        outcome: inout RowOutcome
    ) {
        guard let path, isVolumeRoot(path) else { return }

        do {
            try SidebarItemManager.shared.setVolumeOSType(osType, path: path)
        } catch {
            outcome.warnings.append("Couldn't update the Locations icon for '\(favoriteName)': \(error.localizedDescription)")
        }
    }

    /// Rewrite a row that already carries the right code, so Finder redraws it.
    ///
    /// The write has to be the in-place upsert: setting the property to the value
    /// it already holds is accepted (it returns success) but does not always make
    /// Finder repaint, while re-inserting the row does. The row's OWN path and its
    /// CURRENT name are used, never the favorite's - this is a repair, and it must
    /// not rename anything or move a row to a different spelling of its folder.
    ///
    /// Returns the row as it stands afterwards, or the row untouched when the
    /// repair could not be attempted; failure here is never fatal, since the row
    /// still carries the correct code either way.
    private static func repaint(
        row: SidebarItem,
        osType: String,
        favoriteName: String,
        rows: inout [SidebarItem],
        outcome: inout RowOutcome
    ) -> SidebarItem {
        guard let path = row.path, !row.displayName.isEmpty else { return row }

        // Only targets that can actually lose their drawing are rewritten. A plain
        // folder - including every cloud folder - never does, so re-inserting its
        // row on each Refresh would be churn for nothing, and some of those rows
        // cannot be re-inserted at all: a `~/Library/CloudStorage` path is a
        // virtual FileProvider mount and the insert is refused, which surfaced as
        // a repair failure on a favorite that was perfectly healthy.
        guard needsRepainting(path: path) else { return row }

        do {
            let patched = try SidebarItemManager.shared.upsert(
                url: URL(fileURLWithPath: path),
                displayName: row.displayName,
                osType: osType
            ).row
            store(patched, in: &rows)

            guard patched.itemID == row.itemID else {
                // The in-place upsert keeps the row's ID; a different one means the
                // write landed on another row for the same location. Say so rather
                // than silently re-binding from inside a repair.
                outcome.warnings.append("Repairing the sidebar icon for '\(favoriteName)' landed on a different row for the same folder.")
                return patched
            }
            return patched
        } catch {
            // A repair that could not run leaves the row exactly as it was, still
            // carrying the right code. Rewriting the property is the weaker second
            // attempt; if that fails too there is nothing to tell the user, because
            // nothing is broken that they could act on.
            try? SidebarItemManager.shared.setOSType(osType, itemID: row.itemID)
            NSLog("SidebarFavorites: could not repaint '\(favoriteName)': \(error.localizedDescription)")
            return row
        }
    }

    /// Whether this target is one whose sidebar drawing macOS can discard.
    ///
    /// Measured on macOS 26: only a target with an icon of its own loses the
    /// override when its metadata changes - a folder with a custom Finder icon, or
    /// a mounted volume. Everything else keeps it indefinitely.
    private static func needsRepainting(path: String) -> Bool {
        isVolumeRoot(path) || IconAuthority.detect(atPath: path) != nil
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
        restamp: RestampPolicy = .none,
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
                ).row
                store(restored, in: &rows)
                current = restored
            } catch {
                outcome.warnings.append("'\(favorite.name)' was already in Finder's sidebar as '\(restoringDisplayName)'. Its name could not be put back: \(error.localizedDescription)")
            }
        }

        if current.osType != osType {
            do {
                try manager.setOSType(osType, itemID: current.itemID)
                current = SidebarItem(itemID: current.itemID, displayName: current.displayName, path: current.path, osType: osType)
                store(current, in: &rows)
                // The row was already on screen, so Finder has to relaunch to redraw it.
                outcome.needsFinderRestart = true
            } catch {
                outcome.warnings.append("Couldn't apply the icon for '\(favorite.name)' to its sidebar row: \(error.localizedDescription)")
            }
        } else if restamp.isForced {
            current = repaint(row: current, osType: osType, favoriteName: favorite.name, rows: &rows, outcome: &outcome)
        }

        mirrorToLocations(osType: osType, path: current.path, favoriteName: favorite.name, outcome: &outcome)

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

        // Give up the Locations row first. It is Finder's row, not ours, so it is
        // cleared rather than removed - and it has to happen even when the
        // Favorites row below turns out to carry an override we may not touch,
        // otherwise a deleted favorite leaves its icon on screen under Locations.
        mirrorToLocations(osType: nil, path: live.path, favoriteName: favorite.name, outcome: &outcome)

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

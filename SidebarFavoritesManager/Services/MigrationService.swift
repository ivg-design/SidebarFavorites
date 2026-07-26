import Foundation
import AppKit

/// One-shot, consent-gated upgrade from the pre-1.0 world (one generated app per
/// favorite, each hosting a FinderSync extension the user had to enable by hand)
/// to 1.0's single helper bundle plus direct management of Finder's Favorites list.
///
/// The service is deliberately split into two halves that must stay split:
///
///  * `preflight(version:favorites:)` only READS. It enumerates exactly what a
///    migration would touch and hands it back as a `MigrationPlan`, so the consent
///    sheet can name every bundle by the name it actually has on disk before
///    anything happens.
///  * `migrate(approving:)` acts, and acts only on the plan the user approved.
///    Every guard the pre-flight applied is re-run immediately before each delete,
///    because the plan may be minutes old by the time consent arrives.
///
/// `FavoriteSyncCoordinator.bootstrap()` never calls the second half on its own
/// when the plan contains destructive work - see `MigrationPlan.requiresConsent`.
///
/// Every destructive step is best-effort: failures become warning strings, never
/// exceptions, and never abort the steps that follow. The schema version is
/// committed even on partial failure, so a machine with a permission problem under
/// `Apps/` cannot loop the migration forever.
enum MigrationService {
    struct Outcome {
        let migrated: Bool
        let warnings: [String]
        /// Where config.json was copied before the first mutation, when there was
        /// a config.json to copy.
        let backupURL: URL?
    }

    // MARK: - Plan

    /// One generated app under `Apps/` that passed every safety guard.
    ///
    /// `url` is the symlink-resolved location that was *proven* to be a direct
    /// child of `Apps/`; it is the only path the teardown ever deletes.
    struct LegacyApp: Identifiable, Hashable, Sendable {
        let url: URL
        /// `Downloads.app` -> `Downloads`.
        let displayName: String
        let bundleIdentifier: String
        /// Identifier of the embedded `IconAppSync.appex`, exactly as it was read.
        /// `nil` means the extension has to be switched off by hand.
        ///
        /// Recorded unvalidated on purpose, so the teardown can name it in a warning
        /// when it refuses to act on it; whether it may actually be handed to
        /// `pluginkit` is decided by `isOwnedExtensionIdentifier`, not by being here.
        let extensionIdentifier: String?

        var id: String { url.path }
    }

    /// Exactly what a migration would touch, as data. Produced by `preflight()`,
    /// which does not modify anything.
    struct MigrationPlan: Sendable, Equatable {
        /// Bundles that would be terminated, unregistered and deleted. Empty unless
        /// this plan upgrades the schema - see the gate in `preflight()`.
        let legacyApps: [LegacyApp]
        /// Human-readable reasons for everything found under `Apps/` that a guard
        /// refused to touch. Shown in the consent sheet's details.
        let entriesLeftInPlace: [String]
        /// How many favorites carry over. Migration never adds or drops one.
        let favoritesCarriedOver: Int
        /// How many favorites still need an icon code minted for them.
        let codesToAssign: Int
        let fromVersion: Int
        let toVersion: Int
        let configURL: URL
        let configBackupURL: URL
        let configExists: Bool

        /// The extensions that would be unregistered with `pluginkit -e ignore`.
        ///
        /// Filtered by the same namespace check the teardown applies, so the consent
        /// sheet lists exactly the identifiers that will actually be switched off -
        /// never one the teardown is going to refuse.
        var extensionIdentifiers: [String] {
            legacyApps
                .compactMap(\.extensionIdentifier)
                .filter(MigrationService.isOwnedExtensionIdentifier)
        }

        var upgradesSchema: Bool { fromVersion < toVersion }

        var willRewriteConfig: Bool { upgradesSchema || codesToAssign > 0 }

        /// Whether running the migration would do anything at all.
        var hasWork: Bool { !legacyApps.isEmpty || willRewriteConfig }

        /// Whether the user has to authorise this plan first.
        ///
        /// Consent gates destruction and schema changes. It is deliberately NOT
        /// required for the purely self-healing case - an already-current config
        /// whose favorite is simply missing an icon code - because that path
        /// deletes nothing, and popping a teardown dialog for it would train the
        /// user to click through the one dialog that matters.
        var requiresConsent: Bool { !legacyApps.isEmpty || upgradesSchema }

        /// Migration never removes a row from Finder's sidebar. Stated as data so
        /// the consent sheet can promise it from the plan rather than from prose.
        /// Row management belongs to reconcile, which adopts rows the user made.
        var sidebarRowsRemoved: Int { 0 }

        /// Migration never touches imported artwork.
        var iconFilesRemoved: Int { 0 }
    }

    // MARK: - Safety constants

    /// Bundle identifier prefix shared by every pre-1.0 generated icon app.
    ///
    /// This guard is the only thing standing between the teardown and
    /// force-terminating or deleting something unrelated, so it stays exactly as
    /// strict as the code it replaces. Note the trailing dot: the Manager itself
    /// (`com.ivg-design.SidebarFavoritesManager`) does not match.
    private static let legacyBundleIdentifierPrefix = "com.ivg-design.SidebarFavorites."

    /// Where the pre-1.0 build embedded the Finder Sync extension in each app.
    private static let legacyExtensionRelativePath = "Contents/PlugIns/IconAppSync.appex"

    /// How long a legacy icon app gets to exit before it is force terminated.
    private static let terminationTimeout: TimeInterval = 2

    /// The only directory this service may delete from, expressed as the two path
    /// components it has to end with. Verified at runtime in
    /// `resolvedLegacyAppsRoot()`, so a future change to
    /// `ConfigManager.legacyAppsDirectoryURL` cannot silently aim the teardown at
    /// `Icons/`, at the Application Support root, or anywhere else.
    private static let requiredRootParent = "SidebarFavorites"
    private static let requiredRootDirectory = "Apps"

    /// Whether an identifier read out of a nested `IconAppSync.appex` is one of
    /// ours, and may therefore be handed to `pluginkit -e ignore`.
    ///
    /// `pluginkit -e ignore` is the only step in this service that reaches outside
    /// our own files: it switches an extension off system-wide, in System Settings,
    /// with no undo path in this app. The identifier it is given comes from a plist
    /// read through symlinks inside a bundle, so a collapsed or restored nested
    /// bundle can perfectly well name a third-party - or Apple's own - Finder
    /// extension. It gets the same namespace check the outer bundle had to pass.
    /// 0.6.0 minted the appex identifier under this prefix, so every legitimate
    /// bundle still qualifies.
    private static func isOwnedExtensionIdentifier(_ identifier: String) -> Bool {
        identifier.hasPrefix(legacyBundleIdentifierPrefix)
    }

    // MARK: - Detection

    /// Whether `config.json` still describes a pre-1.0 world, OR simply needs an
    /// icon code minted.
    ///
    /// The second clause makes the migration self-healing: a config that was
    /// version-bumped but left a favorite without a code still gets fixed, and a
    /// hand-edited or garbled code is re-issued.
    ///
    /// That clause is NOT a licence to tear anything down, and `preflight()` does
    /// not treat it as one. It is satisfied by an entirely ordinary state - a
    /// favorite added moments ago, whose code the coalesced reconcile has not
    /// persisted yet - so anything destructive hanging off it would re-arm itself
    /// long after 1.0 was installed. Only `version < Config.currentVersion` arms the
    /// legacy teardown.
    ///
    /// Exposed separately so the coordinator can decide whether to run a pre-flight
    /// at all, rather than scanning the disk on every launch.
    @MainActor
    static func isMigrationNeeded() -> Bool {
        let config = ConfigManager.shared.config

        if config.version < Config.currentVersion {
            return true
        }

        return config.favorites.contains { favorite in
            guard let code = favorite.osType else { return true }
            return !OSTypeAllocator.isWellFormed(code)
        }
    }

    // MARK: - Pre-flight (read-only)

    /// Enumerate exactly what a migration would touch. Modifies nothing.
    ///
    /// Convenience entry point that reads the live config. It performs disk I/O, so
    /// prefer `preflight(version:favorites:)` off the main actor when a config
    /// snapshot is already to hand.
    @MainActor
    static func preflight() -> MigrationPlan {
        let config = ConfigManager.shared.config
        return preflight(version: config.version, favorites: config.favorites)
    }

    /// Enumerate exactly what a migration would touch, from a config snapshot.
    ///
    /// READ-ONLY. Nothing here terminates a process, runs a subprocess, writes a
    /// file or deletes anything - the whole point is that the consent sheet can be
    /// built from real disk contents without having committed to anything.
    static func preflight(version: Int, favorites: [Favorite]) -> MigrationPlan {
        let configManager = ConfigManager.shared
        let configURL = configManager.configFileURL

        // GATE - the legacy teardown is armed by the SCHEMA VERSION and by nothing
        // else, so a plan built from an already-current config carries no bundles
        // and `Apps/` is not even scanned.
        //
        // `isMigrationNeeded()`'s self-healing clause must never reach this far: it
        // fires for a favorite that is merely missing an icon code, which is the
        // normal state between `addFavorite` and the reconcile that persists the
        // code (and the permanent state after a failed `setOSType` write). Hanging
        // deletion off it would let a version-3 config re-run the full teardown on a
        // launch that had nothing to do with migrating - destroying bundles the user
        // had restored from a backup, or a 0.6.0 install they deliberately kept.
        // A config at `Config.currentVersion` was offered this teardown once; it is
        // never offered again.
        let scan: (apps: [LegacyApp], leftInPlace: [String])
        if version < Config.currentVersion {
            scan = scanLegacyApps()
        } else {
            scan = ([], [])
        }

        return MigrationPlan(
            legacyApps: scan.apps,
            entriesLeftInPlace: scan.leftInPlace,
            favoritesCarriedOver: favorites.count,
            codesToAssign: countCodesToAssign(in: favorites),
            fromVersion: version,
            toVersion: Config.currentVersion,
            configURL: configURL,
            configBackupURL: configManager.migrationBackupURL,
            configExists: FileManager.default.fileExists(atPath: configURL.path)
        )
    }

    /// How many favorites `assignMissingOSTypes` would mint a code for. Mirrors its
    /// two passes exactly (missing, malformed, or duplicating an earlier code).
    private static func countCodesToAssign(in favorites: [Favorite]) -> Int {
        var assigned = Set<String>()
        var count = 0

        for favorite in favorites {
            guard let code = favorite.osType,
                  OSTypeAllocator.isWellFormed(code),
                  assigned.insert(code).inserted else {
                count += 1
                continue
            }
        }

        return count
    }

    // MARK: - Migration

    /// Perform the upgrade the user approved.
    ///
    /// Acts only on `plan.legacyApps`, and only while the schema is still behind:
    /// a bundle that appeared under `Apps/` after the plan was shown was never
    /// consented to and is left for a later launch, and a config that already
    /// reports `Config.currentVersion` gets no teardown at all - only step 2's
    /// self-healing code assignment.
    ///
    /// The first reconcile is deliberately NOT part of this: the coordinator runs it
    /// with `force: true` right afterwards, which is also what classifies each
    /// favorite as adopted or managed.
    static func migrate(approving plan: MigrationPlan) async -> Outcome {
        guard plan.hasWork else {
            return Outcome(migrated: false, warnings: [], backupURL: nil)
        }

        var warnings: [String] = []

        // Step 0 - copy config.json aside BEFORE the first mutation of any kind.
        // Best-effort like everything else: the teardown never writes to
        // config.json, so a failed copy costs the safety net, not the upgrade.
        var backupURL: URL?
        do {
            backupURL = try ConfigManager.shared.backupConfigForMigration()
        } catch {
            warnings.append("Couldn't keep a copy of your settings as \(plan.configBackupURL.lastPathComponent): \(error.localizedDescription)")
        }

        // Snapshot what has to survive, so step 3 can check it did, and re-read the
        // schema version step 1 is gated on.
        let (favoritesBefore, liveVersion) = await MainActor.run { () -> ([Favorite], Int) in
            let config = ConfigManager.shared.config
            return (config.favorites, config.version)
        }

        // Step 1 - tear down the approved bundles, and only those. Subprocesses and
        // termination polling, so never on the main thread.
        //
        // GATE - repeated from `preflight()` against the LIVE version, because the
        // plan may be minutes old by the time consent arrives and because a plan is
        // just data a future caller could hand us. A config that already reports the
        // current version has been through this once: whatever is under `Apps/` now
        // was put there afterwards, and is not ours to delete.
        let approved = (plan.upgradesSchema && liveVersion < Config.currentVersion) ? plan.legacyApps : []
        if approved.isEmpty {
            if !plan.legacyApps.isEmpty {
                NSLog("MigrationService: settings are already at version \(liveVersion); skipping the legacy teardown of \(plan.legacyApps.count) bundle(s).")
            }
        } else {
            warnings += await Task.detached(priority: .userInitiated) {
                tearDown(approved: approved)
            }.value
        }

        // Step 2 - mint an OSType code for every favorite that lacks a valid one.
        // Allocation walks from index 0 and the assigned set grows as it goes, so
        // favorites get S000, S001, S002 ... in config order: deterministic and
        // debuggable.
        warnings += await MainActor.run {
            assignMissingOSTypes(to: ConfigManager.shared.config.favorites).warnings
        }

        // Step 3 - GUARD. Step 2 is the only step allowed to write to config.json
        // and the only field it may write is `osType`. Prove it.
        warnings += await MainActor.run {
            verifyFavoritesSurvived(favoritesBefore, after: ConfigManager.shared.config.favorites)
        }

        // Step 4 - provenance is left UNRESOLVED on purpose. Only a comparison
        // against a live sidebar snapshot can tell a row the user already created
        // (adopt it: keep its place and its name, add only the icon override) from a
        // favorite that was never dragged in (insert a row we own). That information
        // does not exist yet, so the first reconcile decides. No sidebar row is
        // read, written or removed anywhere in this function.

        // Step 5 - commit. Bumped even on partial failure so the migration cannot
        // loop; the accumulated warnings are surfaced once instead.
        do {
            try await MainActor.run {
                try ConfigManager.shared.setConfigVersion(Config.currentVersion)
            }
        } catch {
            warnings.append("Couldn't record that the upgrade finished: \(error.localizedDescription)")
        }

        return Outcome(migrated: true, warnings: warnings, backupURL: backupURL)
    }

    /// GUARD - migration may add an `osType` and nothing else.
    ///
    /// Every favorite's identity (id, name, folder, icon choice, enabled state) is
    /// compared before and after. A divergence is reported rather than accepted
    /// silently, and the report names the backup so the user can get the old file.
    private static func verifyFavoritesSurvived(_ before: [Favorite], after: [Favorite]) -> [String] {
        let backupName = ConfigManager.shared.migrationBackupURL.lastPathComponent

        guard before.count == after.count else {
            return ["The upgrade finished with \(after.count) favorites instead of \(before.count). Your previous settings are still in \(backupName)."]
        }

        var warnings: [String] = []
        for (old, new) in zip(before, after) where fingerprint(old) != fingerprint(new) {
            warnings.append("'\(old.name)' changed unexpectedly during the upgrade. Your previous settings are still in \(backupName).")
        }
        return warnings
    }

    /// Everything about a favorite that migration must leave alone. `osType`,
    /// `sidebarItemID` and `sidebarProvenance` are excluded: those are exactly the
    /// bookkeeping fields the upgrade exists to populate.
    private static func fingerprint(_ favorite: Favorite) -> String {
        [
            favorite.id.uuidString,
            favorite.name,
            favorite.folderPath,
            favorite.iconType.rawValue,
            favorite.iconValue,
            favorite.customSVGPath ?? "",
            favorite.enabled ? "1" : "0"
        ].joined(separator: "\u{1}")
    }

    /// Allocate and persist an OSType code for every favorite that has none, whose
    /// persisted code is malformed, or whose code duplicates one an earlier favorite
    /// already owns.
    ///
    /// Returns the favorites as they now stand, so the caller does not have to
    /// re-read the config, plus any warnings. Shared by migration step 2 and by the
    /// coordinator's reconcile, which has to do the same work for favorites created
    /// after the migration ran.
    @MainActor
    @discardableResult
    static func assignMissingOSTypes(to favorites: [Favorite]) -> (favorites: [Favorite], warnings: [String]) {
        var result = favorites
        var warnings: [String] = []
        var assigned = Set<String>()

        // Pass 1: keep the codes that are well formed and unique; drop the rest so
        // pass 2 re-issues them. A hand-edited or partially-migrated config heals
        // itself this way instead of silently rendering a generic icon.
        for index in result.indices {
            guard let code = result[index].osType else { continue }
            if OSTypeAllocator.isWellFormed(code), assigned.insert(code).inserted {
                continue
            }
            result[index].osType = nil
        }

        // Pass 2: mint what is missing, persisting each code immediately.
        for index in result.indices where result[index].osType == nil {
            let favorite = result[index]
            do {
                let code = try OSTypeAllocator.allocate(avoiding: assigned)
                assigned.insert(code)
                result[index].osType = code

                do {
                    try ConfigManager.shared.setOSType(code, for: favorite.id)
                } catch {
                    // Allocation is deterministic (lowest free index, same config),
                    // so a failed write costs a re-allocation next launch, not a
                    // different code. Use it for this pass regardless.
                    warnings.append("Couldn't save the icon code for '\(favorite.name)': \(error.localizedDescription)")
                }
            } catch {
                warnings.append("Couldn't assign an icon code to '\(favorite.name)': \(error.localizedDescription)")
            }
        }

        return (result, warnings)
    }

    // MARK: - Legacy teardown

    /// Stop, deregister and delete the legacy icon apps the user approved - and only
    /// those.
    ///
    /// The `pluginkit -e ignore` below is the only surviving `pluginkit` call in the
    /// codebase. Never throws: every step is independent, a failure becomes a
    /// warning, and the next bundle is still processed.
    static func tearDown(approved apps: [LegacyApp]) -> [String] {
        var warnings: [String] = []

        func warn(_ message: String) {
            NSLog("MigrationService: \(message)")
            warnings.append(message)
        }

        guard !apps.isEmpty else { return warnings }

        let fileManager = FileManager.default
        let root: URL
        switch resolvedLegacyAppsRoot(fileManager: fileManager) {
        case .usable(let url):
            root = url
        case .absent:
            return warnings
        case .refused(let reason):
            warn(reason)
            return warnings
        }

        for app in apps {
            // Re-run every guard against what is on disk NOW. Consent was given for
            // these exact bundles; if what sits at that path changed since the plan
            // was shown, it is not what was approved and is left alone.
            switch screen(app.url, resolvedRoot: root, fileManager: fileManager) {
            case .leftInPlace(let reason):
                warn(reason)
            case .eligible(let current) where current.bundleIdentifier != app.bundleIdentifier:
                warn("\(app.displayName) now reports the identifier \(current.bundleIdentifier) instead of \(app.bundleIdentifier), so it was left in place.")
            case .eligible(let current):
                warnings += tearDown(one: current, fileManager: fileManager)
            }
        }

        retireAppsDirectoryIfEmpty(root, fileManager: fileManager)
        return warnings
    }

    private static func tearDown(one app: LegacyApp, fileManager: FileManager) -> [String] {
        var warnings: [String] = []

        func warn(_ message: String) {
            NSLog("MigrationService: \(message)")
            warnings.append(message)
        }

        // Terminate first - deleting a live bundle leaves the process running.
        terminateLegacyApp(bundleIdentifier: app.bundleIdentifier)

        // Ask pluginkit to forget the embedded Finder Sync extension, so no stale
        // row lingers in System Settings.
        //
        // GUARD - only ever for an identifier inside our own namespace. See
        // `isOwnedExtensionIdentifier`: this is the one call that can change
        // something outside this app's files, and the identifier is read from a
        // plist, through symlinks, so it is not trustworthy on its face.
        switch app.extensionIdentifier {
        case .some(let extensionID) where isOwnedExtensionIdentifier(extensionID):
            if let failure = ProcessRunner.failureDescription(
                "/usr/bin/pluginkit",
                ["-e", "ignore", "-i", extensionID]
            ) {
                warn("Couldn't switch off the Finder extension '\(extensionID)': \(failure)")
            }
        case .some(let extensionID):
            warn("The extension inside \(app.displayName) identifies itself as '\(extensionID)', which wasn't created by Sidebar Favorites, so it was left switched on.")
        case .none:
            warn("Couldn't read the extension identifier inside \(app.displayName); you may need to switch it off in System Settings.")
        }

        if let failure = ProcessRunner.failureDescription(
            ProcessRunner.lsregisterPath,
            ["-u", app.url.path]
        ) {
            warn("Couldn't unregister \(app.displayName) from Launch Services: \(failure)")
        }

        do {
            try fileManager.removeItem(at: app.url)
        } catch {
            warn("Couldn't remove \(app.displayName): \(error.localizedDescription)")
        }

        return warnings
    }

    /// Retire `Apps/` once nothing of ours is left in it. A leftover `.DS_Store`
    /// does not count as content; anything else does, so an entry a guard refused
    /// keeps the directory - and the user's file - alive.
    private static func retireAppsDirectoryIfEmpty(_ root: URL, fileManager: FileManager) {
        guard let remaining = try? fileManager.contentsOfDirectory(atPath: root.path),
              remaining.allSatisfy({ $0 == ".DS_Store" }) else {
            return
        }
        try? fileManager.removeItem(at: root)
    }

    /// Terminate every running copy of a legacy icon app, escalating to
    /// `forceTerminate()` once `terminationTimeout` has elapsed.
    ///
    /// The prefix guard is repeated here on purpose: `forceTerminate()` is a SIGKILL
    /// equivalent and must never reach a process that is not ours.
    private static func terminateLegacyApp(bundleIdentifier: String) {
        guard bundleIdentifier.hasPrefix(legacyBundleIdentifierPrefix) else { return }

        let running = NSRunningApplication.runningApplications(withBundleIdentifier: bundleIdentifier)
        guard !running.isEmpty else { return }

        for app in running {
            app.terminate()
        }

        let deadline = Date().addingTimeInterval(terminationTimeout)
        while Date() < deadline,
              !NSRunningApplication.runningApplications(withBundleIdentifier: bundleIdentifier).isEmpty {
            Thread.sleep(forTimeInterval: 0.1)
        }

        for app in NSRunningApplication.runningApplications(withBundleIdentifier: bundleIdentifier) {
            NSLog("MigrationService: force-terminating '\(bundleIdentifier)' after \(terminationTimeout)s")
            app.forceTerminate()
        }
    }

    // MARK: - Scanning and screening

    private enum RootScan {
        case usable(URL)
        /// Nothing from the old world was ever installed here.
        case absent
        /// The directory exists but is not somewhere we are willing to delete from.
        case refused(String)
    }

    private enum Screening {
        case eligible(LegacyApp)
        /// A guard refused this entry. Carries the reason, in the user's language.
        case leftInPlace(String)
    }

    /// Enumerate `Apps/`, screening every entry. Read-only.
    private static func scanLegacyApps() -> (apps: [LegacyApp], leftInPlace: [String]) {
        let fileManager = FileManager.default

        let root: URL
        switch resolvedLegacyAppsRoot(fileManager: fileManager) {
        case .usable(let url):
            root = url
        case .absent:
            return ([], [])
        case .refused(let reason):
            return ([], [reason])
        }

        guard let entries = try? fileManager.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.isSymbolicLinkKey],
            options: [.skipsHiddenFiles]
        ) else {
            return ([], ["Couldn't read \(root.path); the old icon apps may still be installed."])
        }

        var apps: [LegacyApp] = []
        var leftInPlace: [String] = []

        for entry in entries.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            switch screen(entry, resolvedRoot: root, fileManager: fileManager) {
            case .eligible(let app):
                apps.append(app)
            case .leftInPlace(let reason):
                leftInPlace.append(reason)
            }
        }

        return (apps, leftInPlace)
    }

    /// The one directory the teardown may operate in, symlink-resolved.
    ///
    /// GUARDS:
    ///  * the path must end in `SidebarFavorites/Apps`, so a future change to
    ///    `legacyAppsDirectoryURL` cannot aim this at `Icons/` or at the
    ///    Application Support root;
    ///  * it must already exist and be a directory - its absence simply means there
    ///    is nothing pre-1.0 to clean up;
    ///  * `Apps` itself must not be a link out of `SidebarFavorites/`. Parent
    ///    components are allowed to be links (they routinely are on managed Macs);
    ///    they are resolved on both sides so the comparison cancels them out.
    private static func resolvedLegacyAppsRoot(fileManager: FileManager) -> RootScan {
        let root = ConfigManager.shared.legacyAppsDirectoryURL

        guard root.lastPathComponent == requiredRootDirectory,
              root.deletingLastPathComponent().lastPathComponent == requiredRootParent else {
            return .refused("Refusing to clean up \(root.path): it is not the expected \(requiredRootParent)/\(requiredRootDirectory) folder.")
        }

        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: root.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            return .absent
        }

        let resolvedRoot = root.resolvingSymlinksInPath().standardizedFileURL
        let expectedRoot = root.deletingLastPathComponent()
            .resolvingSymlinksInPath()
            .standardizedFileURL
            .appendingPathComponent(requiredRootDirectory)
            .standardizedFileURL

        guard resolvedRoot.path == expectedRoot.path else {
            return .refused("Refusing to clean up \(root.path): it is a link to \(resolvedRoot.path), outside \(expectedRoot.deletingLastPathComponent().path).")
        }

        return .usable(resolvedRoot)
    }

    /// Decide whether one entry under `Apps/` may be torn down.
    ///
    /// Deletion requires ALL of the following. Any failure leaves the entry exactly
    /// where it is, with a reason the consent sheet and the warnings banner can both
    /// show:
    ///
    ///  1. the entry is not itself a symbolic link. Deleting a link's target would
    ///     leave a dangling link behind, and deleting the link would leave the
    ///     bundle - neither is what the user was shown, so refuse both;
    ///  2. its name ends in `.app`;
    ///  3. its symlink-resolved path is a DIRECT CHILD of the resolved `Apps/`
    ///     directory, so no link and no `..` can walk a delete out of the sandbox;
    ///  4. the resolved path is a directory - a plain file, socket or device is
    ///     never an app bundle;
    ///  5. its `CFBundleIdentifier` starts with `com.ivg-design.SidebarFavorites.`.
    ///     Never by filename: an app called `Downloads.app` that somebody else put
    ///     there is not ours to delete.
    private static func screen(_ entry: URL, resolvedRoot: URL, fileManager: FileManager) -> Screening {
        let name = entry.lastPathComponent

        // 1 - symbolic links are never followed into a delete.
        if let values = try? entry.resourceValues(forKeys: [.isSymbolicLinkKey]),
           values.isSymbolicLink == true {
            return .leftInPlace("\(name) is a symbolic link, so it was left alone.")
        }

        // 2 - only .app bundles.
        guard entry.pathExtension.caseInsensitiveCompare("app") == .orderedSame else {
            return .leftInPlace("\(name) is not an .app bundle, so it was left alone.")
        }

        // 3 - resolve, then prove the result is still a direct child of Apps/.
        let resolved = entry.resolvingSymlinksInPath().standardizedFileURL
        guard resolved.deletingLastPathComponent().standardizedFileURL.path == resolvedRoot.path else {
            return .leftInPlace("\(name) resolves to \(resolved.path), which is outside \(resolvedRoot.path), so it was left alone.")
        }

        // 4 - must be a real directory.
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: resolved.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            return .leftInPlace("\(name) is not a folder, so it was left alone.")
        }

        // 5 - must identify itself as one of ours.
        guard let bundleID = bundleIdentifier(ofBundleAt: resolved) else {
            return .leftInPlace("Couldn't read the identifier of \(name), so it was left alone.")
        }
        guard bundleID.hasPrefix(legacyBundleIdentifierPrefix) else {
            return .leftInPlace("\(name) (\(bundleID)) wasn't created by Sidebar Favorites, so it was left alone.")
        }

        return .eligible(LegacyApp(
            url: resolved,
            displayName: resolved.deletingPathExtension().lastPathComponent,
            bundleIdentifier: bundleID,
            extensionIdentifier: bundleIdentifier(
                ofBundleAt: resolved.appendingPathComponent(legacyExtensionRelativePath)
            )
        ))
    }

    /// Read `CFBundleIdentifier` out of a bundle's Info.plist.
    private static func bundleIdentifier(ofBundleAt bundleURL: URL) -> String? {
        let plistURL = bundleURL.appendingPathComponent("Contents/Info.plist")
        guard let plist = NSDictionary(contentsOf: plistURL) as? [String: Any] else {
            return nil
        }
        return plist["CFBundleIdentifier"] as? String
    }
}

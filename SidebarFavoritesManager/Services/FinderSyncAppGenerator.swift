import Foundation
import AppKit

/// Generates, installs, and removes the per-favorite Finder Sync helper that
/// implements advanced ("both icons") mode.
///
/// One host app + one embedded appex per advanced favorite:
/// * The host exists to carry `CFBundleIcons → CFBundlePrimaryIcon →
///   CFBundleSymbolName` - the glyph Finder draws on the monitored root's
///   sidebar row - and to register the appex with PlugInKit by being launched
///   once. The template host auto-exits ~8 s after launch; the glyph persists
///   (measured), so nothing of ours stays resident but the ~6 MB appex.
/// * The appex monitors exactly one root (`Resources/Roots.txt`) and re-asserts
///   its claim on volume mount/unmount/rename (remount healing, measured).
///
/// Identity vs display (measured collision hazard): `Favorite.name` is the
/// folder's leaf name and is NOT unique, so everything load-bearing - the
/// bundle directory and both bundle identifiers - is keyed on `favorite.id`.
/// Only the display name (`CFBundleName`/`CFBundleDisplayName`) is
/// "SBF-<Name>", which is what System Settings › Login Items & Extensions
/// shows, next to the app icon this installs (hard product requirement).
///
/// Everything here runs off the main thread (`sync` hops onto a detached task):
/// `SymbolCatalogBuilder` drives the asset engine, which refuses the main
/// thread and needs the main runloop free.
final class FinderSyncAppGenerator {
    static let shared = FinderSyncAppGenerator()

    private let fileManager = FileManager.default
    private let configManager = ConfigManager.shared

    /// Serializes install/remove work: `sync` may be called from overlapping
    /// coordinator entry points.
    private let lock = NSLock()

    private init() {}

    // MARK: - Naming

    private static let bundleIDPrefix = "com.ivg-design.SidebarFavorites.adv"
    private static let templateDirectoryName = "FinderSyncTemplate"

    /// "SBF-<Name>" - the System Settings display identity.
    static func displayName(for favorite: Favorite) -> String {
        "SBF-" + favorite.name
    }

    private static func shortID(_ id: UUID) -> String {
        String(id.uuidString.replacingOccurrences(of: "-", with: "").prefix(8)).lowercased()
    }

    private static func bundleDirectoryName(for favorite: Favorite) -> String {
        let safeName = favorite.name.components(separatedBy: CharacterSet.alphanumerics.inverted).joined()
        return "SBF-\(safeName.isEmpty ? "Favorite" : safeName)-\(shortID(favorite.id)).app"
    }

    static func hostBundleID(for favorite: Favorite) -> String {
        "\(bundleIDPrefix).\(shortID(favorite.id))"
    }

    static func extensionBundleID(for favorite: Favorite) -> String {
        hostBundleID(for: favorite) + ".Sync"
    }

    func hostBundleURL(for favorite: Favorite) -> URL {
        configManager.advancedAppsDirectoryURL
            .appendingPathComponent(Self.bundleDirectoryName(for: favorite))
    }

    // MARK: - Sync

    /// Bring installed helpers in line with the config: install/refresh one per
    /// enabled `.advanced` favorite, remove everything else in `AdvancedApps/`.
    /// Returns user-facing warnings.
    func sync(favorites: [Favorite]) async -> [String] {
        await Task.detached(priority: .userInitiated) { [self] in
            syncBlocking(favorites: favorites)
        }.value
    }

    private func syncBlocking(favorites: [Favorite]) -> [String] {
        lock.lock()
        defer { lock.unlock() }

        var warnings: [String] = []
        let wanted = favorites.filter { $0.mode == .advanced && $0.enabled }
        let wantedDirs = Set(wanted.map { Self.bundleDirectoryName(for: $0) })

        // Remove helpers no advanced favorite claims (mode switched off, favorite
        // deleted, folder renamed - the id-keyed suffix keeps rename removals
        // reliable even though the leaf-name half changed).
        let root = configManager.advancedAppsDirectoryURL
        if let installed = try? fileManager.contentsOfDirectory(atPath: root.path) {
            for entry in installed where entry.hasSuffix(".app") && !wantedDirs.contains(entry) {
                removeBundle(at: root.appendingPathComponent(entry), warnings: &warnings)
            }
        }

        for favorite in wanted {
            if needsInstall(favorite) {
                warnings += install(favorite)
            }
        }
        return warnings
    }

    /// Marker the install writes so an unchanged favorite is not regenerated on
    /// every pass. Captures everything the generated bundle depends on.
    private func stateFingerprint(for favorite: Favorite) -> String {
        [
            "v1",
            favorite.expandedFolderPath,
            favorite.name,
            favorite.iconType.rawValue,
            favorite.iconValue,
            favorite.customSVGPath ?? "",
            String(format: "%.3f", favorite.effectiveIconScale),
        ].joined(separator: "\u{1F}")
    }

    private func stateFileURL(for favorite: Favorite) -> URL {
        hostBundleURL(for: favorite).appendingPathComponent("Contents/Resources/SBFState.txt")
    }

    private func needsInstall(_ favorite: Favorite) -> Bool {
        guard let existing = try? String(contentsOf: stateFileURL(for: favorite), encoding: .utf8) else {
            return true
        }
        return existing != stateFingerprint(for: favorite)
    }

    // MARK: - Install

    private func install(_ favorite: Favorite) -> [String] {
        var warnings: [String] = []
        let hostURL = hostBundleURL(for: favorite)
        let displayName = Self.displayName(for: favorite)

        guard let template = templateDirectoryURL() else {
            return ["Couldn't set up \"\(displayName)\": the Finder Sync template is missing from this build. The favorite still works in regular mode."]
        }

        do {
            try fileManager.createDirectory(
                at: configManager.advancedAppsDirectoryURL, withIntermediateDirectories: true)

            // Fresh skeleton every install: the bundle is small and cheap, and a
            // partially updated one must never be left signed-but-stale.
            if fileManager.fileExists(atPath: hostURL.path) {
                try fileManager.removeItem(at: hostURL)
            }

            let executableName = hostURL.deletingPathExtension().lastPathComponent
            let extURL = hostURL.appendingPathComponent("Contents/PlugIns/\(executableName)Sync.appex")
            let hostMacOS = hostURL.appendingPathComponent("Contents/MacOS")
            let hostResources = hostURL.appendingPathComponent("Contents/Resources")
            let extMacOS = extURL.appendingPathComponent("Contents/MacOS")
            let extResources = extURL.appendingPathComponent("Contents/Resources")
            for dir in [hostMacOS, hostResources, extMacOS, extResources] {
                try fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
            }

            try fileManager.copyItem(
                at: template.appendingPathComponent("host-bin"),
                to: hostMacOS.appendingPathComponent(executableName))
            try fileManager.copyItem(
                at: template.appendingPathComponent("appex-bin"),
                to: extMacOS.appendingPathComponent("\(executableName)Sync"))

            // Artwork: the SAME synthesis chain the shared helper uses, so the
            // glyph is identical in both modes. SF Symbols are referenced by
            // name; custom SVGs are parsed, re-wrapped at the favorite's optical
            // scale, and compiled into the HOST's own Assets.car.
            let symbolName: String
            switch favorite.iconType {
            case .sfSymbol:
                symbolName = favorite.iconValue
            case .custom:
                guard let relativePath = favorite.customSVGPath else {
                    return ["Couldn't set up \"\(displayName)\": the favorite has no stored icon file."]
                }
                symbolName = SymbolTemplateSynthesizer.uniqueSymbolName(
                    (relativePath as NSString).lastPathComponent,
                    avoiding: [])
                let compiled = try SymbolCatalogBuilder.synchronize(
                    symbols: [SymbolCatalogBuilder.Symbol(
                        name: symbolName,
                        svgURL: configManager.customIconURL(relativePath: relativePath),
                        iconScale: CGFloat(favorite.effectiveIconScale))],
                    inBundleAt: hostURL)
                guard compiled.contains(symbolName) else {
                    return ["Couldn't set up \"\(displayName)\": its icon didn't compile. The favorite still works in regular mode."]
                }
            }

            // The Settings-row icon. Codesign rejects the resource-fork /
            // FinderInfo metadata the repo copy carries, so it is stripped.
            if let appIcon = Bundle.main.url(forResource: "AppIcon", withExtension: "icns") {
                let installed = hostResources.appendingPathComponent("AppIcon.icns")
                try? fileManager.copyItem(at: appIcon, to: installed)
                _ = ProcessRunner.run("/usr/bin/xattr", ["-c", installed.path])
            }

            let orphanNote = "SidebarFavorites helper for “\(favorite.name)” — safe to disable or delete if SidebarFavorites is no longer installed."
            try writePlist([
                "CFBundleExecutable": executableName,
                "CFBundleIdentifier": Self.hostBundleID(for: favorite),
                "CFBundleName": displayName,
                "CFBundleDisplayName": displayName,
                "CFBundleIconFile": "AppIcon",
                "CFBundlePackageType": "APPL",
                "CFBundleShortVersionString": "1.2",
                "CFBundleVersion": "1",
                "LSBackgroundOnly": true,
                "LSMinimumSystemVersion": "13.0",
                "NSHumanReadableCopyright": orphanNote,
                "CFBundleIcons": [
                    "CFBundlePrimaryIcon": ["CFBundleSymbolName": symbolName]
                ],
            ], to: hostURL.appendingPathComponent("Contents/Info.plist"))

            try writePlist([
                "CFBundleExecutable": "\(executableName)Sync",
                "CFBundleIdentifier": Self.extensionBundleID(for: favorite),
                "CFBundleName": displayName,
                "CFBundleDisplayName": displayName,
                "CFBundlePackageType": "XPC!",
                "CFBundleShortVersionString": "1.2",
                "CFBundleVersion": "1",
                "LSMinimumSystemVersion": "13.0",
                "NSHumanReadableCopyright": orphanNote,
                "NSExtension": [
                    "NSExtensionAttributes": [String: Any](),
                    "NSExtensionPointIdentifier": "com.apple.FinderSync",
                    "NSExtensionPrincipalClass": "SBFAdvSync.FinderSyncExt",
                ],
            ], to: extURL.appendingPathComponent("Contents/Info.plist"))

            try (favorite.expandedFolderPath + "\n")
                .write(to: extResources.appendingPathComponent("Roots.txt"),
                       atomically: true, encoding: .utf8)

            // Sandbox is mandatory - PlugInKit silently refuses unsandboxed
            // appexes - and the read exception is scoped to this favorite's root
            // only (measured sufficient; never "/").
            let entitlements = hostResources.deletingLastPathComponent()
                .deletingLastPathComponent().deletingLastPathComponent()
                .appendingPathComponent("sbf-adv-\(Self.shortID(favorite.id)).entitlements")
            try writePlist([
                "com.apple.security.app-sandbox": true,
                "com.apple.security.files.user-selected.read-only": true,
                "com.apple.security.temporary-exception.files.absolute-path.read-only":
                    [favorite.expandedFolderPath + "/"],
            ], to: entitlements)
            defer { try? fileManager.removeItem(at: entitlements) }

            // Appex first, then host; ad-hoc carries no secure timestamp. The
            // generated bundles contain real executable logic, so unlike the
            // passive helper bundle these are signed with the hardened runtime
            // and entitlements - CodeSigner's bare call is not enough here.
            for (target, extraArgs) in [
                (extURL, ["--entitlements", entitlements.path]),
                (hostURL, []),
            ] {
                if let failure = ProcessRunner.failureDescription(
                    "/usr/bin/codesign",
                    ["--force", "--options", "runtime", "--sign", "-"] + extraArgs + [target.path],
                    timeout: ProcessRunner.keychainTimeout
                ) {
                    return ["Couldn't sign \"\(displayName)\": \(failure)"]
                }
            }

            if let failure = ProcessRunner.failureDescription(
                lsregisterPath, ["-f", "-R", "-trusted", hostURL.path]
            ) {
                warnings.append("\"\(displayName)\" installed, but Launch Services registration failed: \(failure)")
            }

            // Launching the host once is what registers the appex with PlugInKit;
            // the host exits itself ~8 s later.
            let configuration = NSWorkspace.OpenConfiguration()
            configuration.activates = false
            NSWorkspace.shared.openApplication(at: hostURL, configuration: configuration) { _, error in
                if let error {
                    NSLog("FinderSyncAppGenerator: host launch failed: \(error.localizedDescription)")
                }
            }

            let extID = Self.extensionBundleID(for: favorite)
            var registered = false
            for _ in 0..<10 {
                Thread.sleep(forTimeInterval: 1)
                if ProcessRunner.run("/usr/bin/pluginkit", ["-m", "-i", extID]).succeeded {
                    registered = true
                    break
                }
            }
            if registered {
                _ = ProcessRunner.run("/usr/bin/pluginkit", ["-e", "use", "-i", extID])
                Thread.sleep(forTimeInterval: 2)
                let state = ProcessRunner.run("/usr/bin/pluginkit", ["-m", "-i", extID]).output
                if !state.hasPrefix("+") {
                    warnings.append("\"\(displayName)\" is installed but not enabled yet. Enable it under System Settings › General › Login Items & Extensions.")
                }
            } else {
                warnings.append("\"\(displayName)\" did not register with the extension system. Its row keeps the regular sidebar icon for now.")
            }

            try stateFingerprint(for: favorite)
                .write(to: stateFileURL(for: favorite), atomically: true, encoding: .utf8)
            NSLog("FinderSyncAppGenerator: installed \(displayName) (\(extID))")
        } catch {
            warnings.append("Couldn't set up \"\(displayName)\": \(error.localizedDescription)")
        }
        return warnings
    }

    // MARK: - Remove

    /// Remove one favorite's helper (mode switched back, or favorite deleted).
    func remove(for favorite: Favorite) async {
        await Task.detached(priority: .userInitiated) { [self] in
            lock.lock()
            defer { lock.unlock() }
            var warnings: [String] = []
            removeBundle(at: hostBundleURL(for: favorite), warnings: &warnings)
            for warning in warnings { NSLog("FinderSyncAppGenerator: \(warning)") }
        }.value
    }

    /// Remove every installed helper - the Settings "remove all" teardown.
    func removeAll() async -> [String] {
        await Task.detached(priority: .userInitiated) { [self] in
            lock.lock()
            defer { lock.unlock() }
            var warnings: [String] = []
            let root = configManager.advancedAppsDirectoryURL
            guard let entries = try? fileManager.contentsOfDirectory(atPath: root.path) else {
                return warnings
            }
            for entry in entries where entry.hasSuffix(".app") {
                removeBundle(at: root.appendingPathComponent(entry), warnings: &warnings)
            }
            try? fileManager.removeItem(at: root)
            return warnings
        }.value
    }

    private func removeBundle(at hostURL: URL, warnings: inout [String]) {
        // Screen before deleting anything: only bundles whose appex identifier
        // carries our advanced prefix are ours to remove.
        guard let extID = installedExtensionID(at: hostURL),
              extID.hasPrefix(Self.bundleIDPrefix + ".") else {
            warnings.append("Left \(hostURL.lastPathComponent) alone: it doesn't look like a SidebarFavorites helper.")
            return
        }
        _ = ProcessRunner.run("/usr/bin/pluginkit", ["-e", "ignore", "-i", extID])
        _ = ProcessRunner.run(lsregisterPath, ["-u", hostURL.path])
        do {
            try fileManager.removeItem(at: hostURL)
            NSLog("FinderSyncAppGenerator: removed \(hostURL.lastPathComponent) (\(extID))")
        } catch {
            warnings.append("Couldn't delete \(hostURL.lastPathComponent): \(error.localizedDescription)")
        }
    }

    private func installedExtensionID(at hostURL: URL) -> String? {
        guard let plugIns = try? fileManager.contentsOfDirectory(
            atPath: hostURL.appendingPathComponent("Contents/PlugIns").path),
            let appex = plugIns.first(where: { $0.hasSuffix(".appex") }),
            let data = try? Data(contentsOf: hostURL.appendingPathComponent(
                "Contents/PlugIns/\(appex)/Contents/Info.plist")),
            let plist = try? PropertyListSerialization.propertyList(from: data, format: nil),
            let dictionary = plist as? [String: Any]
        else { return nil }
        return dictionary["CFBundleIdentifier"] as? String
    }

    // MARK: - Status (Settings panel)

    /// What System Settings would say about one favorite's helper, asked from
    /// PlugInKit directly so the panel never guesses.
    enum HelperStatus {
        /// Registered and enabled - the glyph is the helper's.
        case enabled
        /// Registered but switched off - the row draws the regular OSType glyph.
        case disabled
        /// PlugInKit has never seen it (not yet installed, or install failed).
        case notRegistered
    }

    func helperStatuses(for favorites: [Favorite]) async -> [UUID: HelperStatus] {
        let advanced = favorites.filter { $0.mode == .advanced }
        guard !advanced.isEmpty else { return [:] }
        return await Task.detached(priority: .utility) {
            var statuses: [UUID: HelperStatus] = [:]
            for favorite in advanced {
                let extID = Self.extensionBundleID(for: favorite)
                let result = ProcessRunner.run("/usr/bin/pluginkit", ["-m", "-i", extID])
                let line = result.output.trimmingCharacters(in: .whitespacesAndNewlines)
                if !result.succeeded || line.isEmpty {
                    statuses[favorite.id] = .notRegistered
                } else if line.hasPrefix("+") {
                    statuses[favorite.id] = .enabled
                } else {
                    statuses[favorite.id] = .disabled
                }
            }
            return statuses
        }.value
    }

    /// The System Settings pane where the helpers are listed and can be toggled.
    static func openExtensionsSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.LoginItems-Settings.extension") {
            NSWorkspace.shared.open(url)
        }
    }

    // MARK: - Plumbing

    private var lsregisterPath: String {
        "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
    }

    private func templateDirectoryURL() -> URL? {
        if let url = Bundle.main.resourceURL?.appendingPathComponent(Self.templateDirectoryName),
           fileManager.fileExists(atPath: url.appendingPathComponent("host-bin").path) {
            return url
        }
        return nil
    }

    private func writePlist(_ dictionary: [String: Any], to url: URL) throws {
        let data = try PropertyListSerialization.data(
            fromPropertyList: dictionary, format: .xml, options: 0)
        try data.write(to: url, options: .atomic)
    }
}

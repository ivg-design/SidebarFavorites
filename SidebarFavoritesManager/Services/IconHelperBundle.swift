import Foundation
import CryptoKit

/// Builds, signs and registers the single code-free helper app bundle whose
/// exported UTIs bind our private 4-character OSType codes to SF Symbols.
///
/// Finder resolves a sidebar row's `com.apple.LSSharedFileList.OverrideIcon.OSType`
/// property through Launch Services, so one registered declaration per favorite is
/// all that is needed to override that row's icon - identically for local folders,
/// iCloud and `~/Library/CloudStorage`, with no user-enabled extension anywhere.
///
/// One bundle carries every declaration: they resolve independently, so this means
/// one `lsregister` per change instead of one per favorite, one signing operation,
/// and no per-favorite process at all.
///
/// The helper is never launched. `CFBundleExecutable` only has to point at an
/// existing executable for an `APPL` bundle to register cleanly, so the executable
/// is a 17-byte `#!/bin/sh` no-op.
final class IconHelperBundle {
    static let shared = IconHelperBundle()

    static let bundleIdentifier = "com.ivg-design.SidebarFavorites.Icons"
    static let executableName = "SidebarFavoritesIcons"
    static let utiPrefix = "com.ivg-design.SidebarFavorites.icon."

    /// The helper's entire executable - see the type comment. Exactly 17 bytes.
    private static let executableScript = "#!/bin/sh\nexit 0\n"

    private static let bundleDisplayName = "SidebarFavorites Icons"

    /// One line, shown by Finder's Get Info and by bundle inspectors.
    private static let purposeDescription =
        "Registers custom Finder sidebar icons for SidebarFavorites. Not meant to be launched."

    /// The bundle's own icon, copied from the Manager. Named unlike anything the
    /// symbol pipeline produces so the two can never be confused for each other -
    /// `removeSymbolICNS` deletes per-symbol artwork by exclusion from this name.
    private static let appIconFileName = "HelperIcon"

    /// One declaration in the helper's `UTExportedTypeDeclarations`.
    struct Declaration: Hashable {
        /// Private 4-character OSType, e.g. "S003".
        /// Case-sensitive (`BLT1` != `blt1`): written verbatim, never normalized.
        let osType: String
        /// The favorite's `iconValue`. For a system icon this is the SF Symbol
        /// name and is used verbatim; for a custom icon it is only part of the
        /// digest - the asset name is derived from `customSVGPath` at build time.
        let symbolName: String
        /// The favorite's name, used for `UTTypeDescription`.
        let description: String
        /// Relative path inside the Icons/ directory; nil for system SF Symbols.
        let customSVGPath: String?
        /// The favorite's optical size correction, already reduced to the default
        /// for a system SF Symbol (see `Favorite.effectiveIconScale`) so a stale
        /// value cannot perturb the digest for an icon it does not affect.
        let iconScale: Double

        init(osType: String,
             symbolName: String,
             description: String,
             customSVGPath: String?,
             iconScale: Double = Favorite.defaultIconScale) {
            self.osType = osType
            self.symbolName = symbolName
            self.description = description
            self.customSVGPath = customSVGPath
            self.iconScale = Favorite.clampedIconScale(iconScale)
        }
    }

    /// What one compiled symbolset is: a stored file *and* the scale it is
    /// compiled at.
    ///
    /// Two favorites pointing at the same SVG share one symbolset only when they
    /// also agree on the scale. Keying by file alone would let the first template
    /// staged win and silently hand the second favorite the other one's size -
    /// the same class of bug as two favorites sharing a name.
    private struct ArtworkKey: Hashable {
        let relativePath: String
        let iconScale: Double

        /// Total order for the name assignment, so which of two colliding names
        /// gets the numeric suffix never depends on how the user ordered their
        /// favorites. A config where nothing is rescaled orders exactly as the
        /// plain sorted-paths pass it replaces did, so no existing symbol is
        /// renamed by this key growing a second component.
        static func precedes(_ lhs: ArtworkKey, _ rhs: ArtworkKey) -> Bool {
            lhs.relativePath == rhs.relativePath
                ? lhs.iconScale < rhs.iconScale
                : lhs.relativePath < rhs.relativePath
        }
    }

    struct BuildResult {
        let digest: String
        let generation: Int
        let registered: Bool
        /// True when this build changed what Finder resolves for our OSType codes:
        /// the declarations, or the pipeline that turns them into artwork, differ
        /// from the ones the installed bundle was built from.
        ///
        /// The signal a Finder restart is owed. False for the digest-unchanged skip
        /// and false for a forced rebuild of identical content - re-registering
        /// byte-identical artwork gives Finder nothing new to draw.
        let contentChanged: Bool
        let warnings: [String]
    }

    private let fileManager = FileManager.default
    private let configManager = ConfigManager.shared

    /// Serializes the whole of `rebuild`/`teardown`: both are called from detached
    /// tasks, and two interleaved builds would race on the same bundle on disk.
    private let lock = NSLock()

    private init() {}

    /// Bumped whenever the *way* declarations become a bundle changes, so an
    /// upgrade rebuilds once even though the declarations themselves are
    /// unchanged. Without it the digest shortcut below would keep serving a bundle
    /// built by the previous pipeline.
    ///
    /// * 1 - up to 1.0: raw SVGs copied into the symbolsets, asset names read from
    ///   the file's `descriptive-name`.
    /// * 2 - templates synthesized from parsed geometry, asset names in the
    ///   `custom.` namespace.
    /// * 3 - artwork fitted to the cap band rather than a cap-height square; no
    ///   `.icns` fallback art shipped or declared; the bundle carries its own icon
    ///   and a description of what it is for.
    private static let pipelineVersion = "3"

    /// SHA-256 over the canonical declaration payload.
    /// Sorting by OSType makes the digest independent of favorite ordering, so
    /// reordering the list alone never triggers a rebuild.
    func digest(for declarations: [Declaration]) -> String {
        let records = declarations
            .sorted { $0.osType < $1.osType }
            .map { declaration in
                var fields = [
                    declaration.osType,
                    declaration.symbolName,
                    declaration.description,
                    declaration.customSVGPath ?? ""
                ]
                // Appended only when it is doing something, so a config in which
                // nothing has been rescaled hashes to exactly what it hashed to
                // before this field existed. That is what makes upgrading to a
                // build that has the slider a no-op: no rebuild, no re-register,
                // and no restart banner offered for artwork that is byte-identical.
                //
                // A scale that IS set changes the payload, which is the whole point
                // - Finder caches the compiled artwork behind an OSType code, and
                // that code does not move when only the size does. The digest is
                // the only thing that can see the difference.
                if let token = Self.scaleToken(declaration.iconScale) {
                    fields.append("scale=\(token)")
                }
                return fields.joined(separator: "\u{1F}")   // unit separator
            }
        let payload = ([Self.pipelineVersion] + records)
            .joined(separator: "\u{1E}")        // record separator

        return SHA256.hash(data: Data(payload.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    /// Canonical text for a scale that is not the default, or nil at the default.
    ///
    /// Three decimals is finer than the slider can produce and far finer than
    /// anything that moves a pixel at sidebar size, so the token is stable across
    /// the float arithmetic a value makes on its way through JSON and back.
    private static func scaleToken(_ scale: Double) -> String? {
        let clamped = Favorite.clampedIconScale(scale)
        guard abs(clamped - Favorite.defaultIconScale) >= 0.0005 else { return nil }
        return String(format: "%.3f", clamped)
    }

    /// Regenerate the helper bundle and re-register it with Launch Services.
    ///
    /// Returns `registered: false` when the declarations are byte-identical to the
    /// last build and the bundle is still on disk - the plist write, `actool`,
    /// `codesign` and `lsregister` are all skipped in that case - and
    /// `contentChanged: true` when the artwork Finder has cached is no longer what
    /// this bundle declares.
    func rebuild(
        declarations: [Declaration],
        previousDigest: String?,
        generation: Int,
        signing: SigningIdentity,
        force: Bool
    ) throws -> BuildResult {
        lock.lock()
        defer { lock.unlock() }

        let bundleURL = configManager.helperAppURL
        let payloadDigest = digest(for: declarations)

        // What the sidebar draws changed if, and only if, the payload the bundle is
        // built from changed - the artwork behind an OSType code is part of that
        // payload by way of `customSVGPath` and `pipelineVersion`, which is exactly
        // what a row property comparison cannot see.
        //
        // Two deliberate asymmetries. A helper that declares nothing has nothing
        // Finder can be caching for us, so a first run on a machine with no
        // favorites is not a change. And the description text is in the digest
        // although nothing draws it, so a bare rename reports changed content and
        // offers a restart that is not strictly needed - the conservative direction,
        // since the failure being fixed here is a changed icon that offers nothing.
        let contentChanged = payloadDigest != previousDigest && !declarations.isEmpty

        // 1. Nothing changed and the bundle is intact: this is the common path on
        //    launch, and it must cost nothing.
        if !force,
           let previousDigest,
           payloadDigest == previousDigest,
           fileManager.fileExists(atPath: bundleURL.path) {
            return BuildResult(
                digest: payloadDigest,
                // Report what is actually installed, so a skipped build cannot
                // drift the persisted generation away from the bundle's version.
                generation: installedGeneration(at: bundleURL) ?? generation,
                registered: false,
                contentChanged: false,
                warnings: []
            )
        }

        var warnings: [String] = []

        // 2. Skeleton plus the no-op executable. Nothing is deleted first: a
        //    partially failed rebuild must leave the previously registered bundle
        //    contents in place.
        let contentsURL = bundleURL.appendingPathComponent("Contents")
        let macOSURL = contentsURL.appendingPathComponent("MacOS")
        let resourcesURL = contentsURL.appendingPathComponent("Resources")
        try fileManager.createDirectory(at: macOSURL, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: resourcesURL, withIntermediateDirectories: true)
        try installExecutable(at: macOSURL.appendingPathComponent(Self.executableName))
        let hasAppIcon = installAppIcon(in: resourcesURL)

        // 3. Name each custom icon's asset.
        //
        //    The name is derived from the stored file in `Icons/`, folded through
        //    `SymbolTemplateSynthesizer` into the `custom.` namespace - so a
        //    migrated `diamond-mark.svg` becomes `custom.diamond.mark`. It is not
        //    read out of the file: an ordinary SVG has no `descriptive-name`
        //    element to read, and the name actool compiles the asset under is the
        //    `.symbolset` directory's anyway.
        //
        //    The stored path *and the scale it is drawn at*, not
        //    `Favorite.iconValue`, are the identity: two favorites sharing one file
        //    at one size share one symbolset, two files that fold to the same name
        //    must not, and neither must two favorites that point at the same file
        //    but ask for different sizes.
        //
        //    Names are assigned over the *sorted* distinct keys, never in
        //    declaration order. Two files that collide (`My Logo.svg` and
        //    `my-logo.svg` both fold to `custom.my.logo`) are separated by a
        //    numeric suffix, and which of them gets it must not depend on how the
        //    user happens to have ordered their favorites - otherwise reordering
        //    the list would swap two rows' icons at the next rebuild.
        var symbolNamesByArtwork: [ArtworkKey: String] = [:]
        var requestedSymbolNames: Set<String> = []
        let artworkKeys = Set(declarations.compactMap(Self.artworkKey))
            .sorted(by: ArtworkKey.precedes)
        for key in artworkKeys {
            let name = SymbolTemplateSynthesizer.uniqueSymbolName(
                (key.relativePath as NSString).lastPathComponent,
                avoiding: requestedSymbolNames
            )
            symbolNamesByArtwork[key] = name
            requestedSymbolNames.insert(name)
        }

        var entries: [(declaration: Declaration, symbolName: String)] = []
        var symbols: [SymbolCatalogBuilder.Symbol] = []
        var stagedSymbolNames: Set<String> = []

        for declaration in declarations {
            guard let key = Self.artworkKey(for: declaration),
                  let symbolName = symbolNamesByArtwork[key] else {
                entries.append((declaration, declaration.symbolName))
                continue
            }

            entries.append((declaration, symbolName))
            if stagedSymbolNames.insert(symbolName).inserted {
                symbols.append(SymbolCatalogBuilder.Symbol(
                    name: symbolName,
                    svgURL: configManager.customIconURL(relativePath: key.relativePath),
                    iconScale: CGFloat(key.iconScale)
                ))
            }
        }

        // 4. One Assets.car for every custom symbol. actool ships with Xcode / the
        //    Command Line Tools, so its absence degrades this favorite to the
        //    folder icon rather than aborting the rebuild for all the others.
        var compiledSymbols: Set<String> = []
        do {
            compiledSymbols = try SymbolCatalogBuilder.synchronize(symbols: symbols, inBundleAt: bundleURL)
        } catch {
            warnings.append(error.localizedDescription)
        }

        // 5. Nothing else is shipped as artwork.
        //
        //    Up to 1.0 each symbol also got a rasterized `.icns` and a declaration
        //    naming it through `UTTypeIconFile` / `_UTTypeTemplateIconFile`. Those
        //    keys do nothing useful for a sidebar row - an icns-only declaration
        //    renders as a plain folder - and they do active harm: Finder draws the
        //    raster the moment the bundle registers and only switches to the vector
        //    symbol once it re-reads its registrations, so a new custom icon showed
        //    up as an opaque black silhouette until Finder was restarted. Removing
        //    them means the row keeps its previous icon until the restart the banner
        //    asks for, which is strictly better than showing the wrong artwork.
        removeSymbolICNS(in: resourcesURL)

        for name in requestedSymbolNames.subtracting(compiledSymbols).sorted() {
            warnings.append("Custom icon '\(name)' could not be compiled; that favorite falls back to the folder icon.")
        }

        // 6. Info.plist.
        var typeDeclarations: [[String: Any]] = []
        for entry in entries.sorted(by: { $0.declaration.osType < $1.declaration.osType }) {
            var typeDeclaration: [String: Any] = [
                // LaunchServices lowercases UTI identifiers on ingest anyway.
                "UTTypeIdentifier": Self.utiPrefix + entry.declaration.osType.lowercased(),
                "UTTypeDescription": "\(entry.declaration.description) sidebar icon",
                // public.folder, not public.data: if icon resolution ever fails the
                // row falls back to a folder icon rather than a blank page.
                "UTTypeConformsTo": ["public.folder"],
                // Verbatim, uppercase and all - OSType tags are case-sensitive.
                "UTTypeTagSpecification": ["com.apple.ostype": [entry.declaration.osType]]
            ]

            // The nested UTTypeIcons dictionary is required - top-level icon keys
            // are ignored by the sidebar - and the symbol name is the only thing in
            // it. A custom symbol that did not make it into Assets.car is not a
            // symbol any more: naming it would point Launch Services at nothing, so
            // the key is dropped entirely and the public.folder conformance supplies
            // the icon.
            let isCustom = entry.declaration.customSVGPath?.isEmpty == false
            if !isCustom || compiledSymbols.contains(entry.symbolName) {
                typeDeclaration["UTTypeIcons"] = ["UTTypeSymbolName": entry.symbolName]
            }

            typeDeclarations.append(typeDeclaration)
        }

        // Settings links the user straight to this bundle, so someone WILL open it
        // in an inspector. Everything that is not load-bearing for the UTI mechanism
        // is here to make it read as something deliberate rather than as an
        // unexplained signed app sitting in Application Support.
        var plist: [String: Any] = [
            "CFBundleExecutable": Self.executableName,
            "CFBundleIdentifier": Self.bundleIdentifier,
            "CFBundleName": Self.bundleDisplayName,
            "CFBundlePackageType": "APPL",
            "CFBundleShortVersionString": managerVersion,
            // Bumped on every rebuild so Launch Services never serves a cached record.
            "CFBundleVersion": String(generation),
            "CFBundleGetInfoString": Self.purposeDescription,
            "LSMinimumSystemVersion": "13.0",
            "LSUIElement": true,
            "LSBackgroundOnly": true,
            "UTExportedTypeDeclarations": typeDeclarations
        ]

        // Only claimed when the file is actually there: a CFBundleIconFile pointing
        // at nothing is worse than the generic placeholder it replaces. This names
        // the *bundle's* icon and is deliberately not one of the `UTTypeIcons` -
        // those carry a symbol name and nothing else.
        if hasAppIcon {
            plist["CFBundleIconFile"] = Self.appIconFileName
        }

        do {
            let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
            // .atomic writes a temp file alongside and renames it into place, so a
            // failure here can never leave a half-written plist behind.
            try data.write(to: contentsURL.appendingPathComponent("Info.plist"), options: [.atomic])
        } catch {
            throw HelperError.plistWriteFailed(error.localizedDescription)
        }

        // 7. Signing is best-effort: an unsigned helper registers and renders icons
        //    correctly, so a failure here is a warning, never an error.
        if let failure = CodeSigner.shared.signBundle(at: bundleURL, using: signing) {
            warnings.append(failure)
        }

        // 8. Registration is the one step that must succeed - without it no
        //    declaration resolves and every managed row loses its icon.
        if let failure = ProcessRunner.failureDescription(
            ProcessRunner.lsregisterPath,
            ["-f", "-R", "-trusted", bundleURL.path]
        ) {
            throw HelperError.lsregisterFailed(failure)
        }

        NSLog("IconHelperBundle: registered \(typeDeclarations.count) declaration(s), generation \(generation)")

        return BuildResult(
            digest: payloadDigest,
            generation: generation,
            registered: true,
            contentChanged: contentChanged,
            warnings: warnings
        )
    }

    /// Unregister and delete the helper bundle. Never throws - the caller is
    /// usually already tearing everything else down.
    @discardableResult
    func teardown() -> [String] {
        lock.lock()
        defer { lock.unlock() }

        var warnings: [String] = []
        let bundleURL = configManager.helperAppURL

        guard fileManager.fileExists(atPath: bundleURL.path) else {
            return warnings
        }

        func warn(_ message: String) {
            NSLog("IconHelperBundle: \(message)")
            warnings.append(message)
        }

        if let failure = ProcessRunner.failureDescription(
            ProcessRunner.lsregisterPath,
            ["-u", bundleURL.path]
        ) {
            warn("Could not unregister the icon helper from Launch Services: \(failure)")
        }

        do {
            try fileManager.removeItem(at: bundleURL)
        } catch {
            warn("Could not remove the icon helper bundle: \(error.localizedDescription)")
        }

        return warnings
    }

    /// The symbolset a declaration needs compiled, or nil when it names a system
    /// SF Symbol and needs none.
    private static func artworkKey(for declaration: Declaration) -> ArtworkKey? {
        guard let relativePath = declaration.customSVGPath, !relativePath.isEmpty else {
            return nil
        }
        return ArtworkKey(
            relativePath: relativePath,
            iconScale: Favorite.clampedIconScale(declaration.iconScale)
        )
    }

    // MARK: - Bundle plumbing

    /// The Manager's own marketing version, mirrored into the helper so the two
    /// are recognizably a pair in `lsregister -dump`.
    private var managerVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    private func installExecutable(at url: URL) throws {
        if !fileManager.fileExists(atPath: url.path) {
            try Data(Self.executableScript.utf8).write(to: url, options: [.atomic])
        }

        // Re-assert the mode on every build: an APPL bundle only registers cleanly
        // when CFBundleExecutable points at something executable, and a bundle
        // restored from a backup can easily have lost the bit.
        try? fileManager.setAttributes([.posixPermissions: 0o755], ofItemAtPath: url.path)
    }

    /// `CFBundleVersion` of the bundle currently on disk, if it is readable.
    private func installedGeneration(at bundleURL: URL) -> Int? {
        let plistURL = bundleURL.appendingPathComponent("Contents/Info.plist")
        guard let plist = NSDictionary(contentsOf: plistURL) as? [String: Any],
              let version = plist["CFBundleVersion"] as? String else {
            return nil
        }
        return Int(version)
    }

    /// Copy the Manager's own icon in as the helper's, so the bundle does not show
    /// a blank placeholder. Returns false when the Manager has no icon to give.
    ///
    /// Inert for icon resolution: `CFBundleIconFile` describes the bundle, not the
    /// types it exports.
    private func installAppIcon(in resourcesURL: URL) -> Bool {
        let destination = resourcesURL.appendingPathComponent("\(Self.appIconFileName).icns")

        // HelperIcon is the app icon with a "?" badge, so the helper is visually
        // identifiable as the auxiliary bundle rather than a copy of the app.
        guard let source = Bundle.main.url(forResource: "HelperIcon", withExtension: "icns") else {
            // Nothing to copy. Any icon a previous build installed is left alone -
            // it is still a valid icon, and the plist only claims one when the file
            // is present.
            return fileManager.fileExists(atPath: destination.path)
        }

        do {
            // The bytes, not the file. `copyItem` brings the source's extended
            // attributes with it, and an `.icns` that has ever been near Finder
            // carries `com.apple.FinderInfo` and `com.apple.ResourceFork` - which
            // makes `codesign` refuse the whole bundle with "resource fork, Finder
            // information, or similar detritus not allowed".
            try Data(contentsOf: source).write(to: destination, options: [.atomic])
            return true
        } catch {
            NSLog("IconHelperBundle: could not install the helper's icon: \(error.localizedDescription)")
            return fileManager.fileExists(atPath: destination.path)
        }
    }

    /// Delete the per-symbol `.icns` files in the helper's Resources.
    ///
    /// Nothing declares one any more, so any that are there were installed by an
    /// earlier version - and they are exactly the artwork Finder would draw in
    /// preference to the compiled symbol. A rebuild never deletes the bundle, so
    /// without this an upgrade would leave them in place. The bundle's own icon is
    /// the one `.icns` that stays.
    private func removeSymbolICNS(in resourcesURL: URL) {
        guard let entries = try? fileManager.contentsOfDirectory(
            at: resourcesURL,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else {
            return
        }

        let keep = "\(Self.appIconFileName).icns"
        for url in entries where url.pathExtension == "icns" && url.lastPathComponent != keep {
            try? fileManager.removeItem(at: url)
        }
    }

    enum HelperError: LocalizedError {
        case plistWriteFailed(String)
        case lsregisterFailed(String)

        var errorDescription: String? {
            switch self {
            case .plistWriteFailed(let detail):
                return "Failed to write the icon helper's Info.plist: \(detail)"
            case .lsregisterFailed(let detail):
                return "Failed to register the icon helper with Launch Services: \(detail)"
            }
        }
    }
}

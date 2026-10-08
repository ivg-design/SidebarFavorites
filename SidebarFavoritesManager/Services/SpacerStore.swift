import AppKit
import UniformTypeIdentifiers

/// The files behind spacer favorites (#23).
///
/// A Finder sidebar row has to point at something, and what it points at decides
/// both its label and what a click does - each measured on macOS 26.6:
///
/// - a **folder** navigates and takes the selection;
/// - an **app** launches and leaves Finder where it was, but is labelled with its
///   file name - `⠀.app` whenever "Show all filename extensions" is on, and an app
///   bundle without the extension is not an app to LaunchServices at all;
/// - a **file** opens in its default app and is labelled with its name, which can
///   be a single blank character with no extension to show.
///
/// So a spacer is an empty file named U+2800 BRAILLE PATTERN BLANK (draws nothing,
/// is not whitespace, so nothing trims it) whose classic type code is `SBFs`. That
/// code maps to a private type, `com.ivg-design.sidebarfavorites.spacer`, which one
/// helper app - `SidebarFavorites Spacer.app`, shared by every spacer - declares
/// and owns, and which no other app on the system claims. The helper is a
/// background-only `return 0`: clicking a spacer starts it, it quits at once, and
/// with the row's icon set to the blank glyph even Finder's open zoom has nothing
/// to draw (verified by eye: blank row, no visible reaction).
///
/// Everything lives under `Spacers.noindex/` - `.noindex` keeps Spotlight out -
/// with one `<id>/` directory per spacer, because Finder's list de-duplicates
/// rows by URL. LaunchServices only binds documents to an app outside temporary
/// directories (measured: the same helper in `/tmp` was never offered), which
/// Application Support satisfies.
///
/// The glyph is an ordinary custom icon run through the normal pipeline: two
/// specks at opposite corners of a 100-unit square. The fit scales the square to
/// the cap band, which leaves each speck at about 0.03 px at sidebar size -
/// nothing renders - while the artwork is still real geometry, so it validates and
/// compiles like any other icon. An empty or zero-size path cannot be used: it
/// fails validation, and a symbol that fails to compile falls back to a folder.
///
/// A blank row also gives Finder nothing to show while it is dragged, so spacers
/// are positioned from the app's list instead (`FavoriteSyncCoordinator.moveInSidebar`).
enum SpacerStore {
    static let blankName = "\u{2800}"
    static let artworkFileName = "sidebarfavorites-spacer-blank.svg"

    static let typeCode: OSType = 0x5342_4673 // 'SBFs'
    static let typeIdentifier = "com.ivg-design.sidebarfavorites.spacer"
    static let openerName = "SidebarFavorites Spacer.app"
    static let openerBundleIdentifier = "com.ivg-design.SidebarFavorites.Spacer"

    enum SpacerError: LocalizedError {
        case executableMissing

        var errorDescription: String? {
            "This copy of SidebarFavorites is missing the spacer helper. Reinstall the app to add spacers."
        }
    }

    static let artwork = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <path d="M0 0h0.2v0.2h-0.2z M99.8 99.8h0.2v0.2h-0.2z"/>
        </svg>

        """

    static var rootURL: URL {
        ConfigManager.shared.appSupportURL.appendingPathComponent("Spacers.noindex", isDirectory: true)
    }

    static var openerURL: URL {
        rootURL.appendingPathComponent(openerName, isDirectory: true)
    }

    /// A new spacer favorite, with its file, the helper and the artwork on disk.
    ///
    /// Runs `codesign` and `lsregister` the first time, so call it off the main thread.
    static func makeSpacer() throws -> Favorite {
        try ensureOpener()
        let id = UUID()
        try ensureFile(for: id)
        try ensureArtwork()
        return Favorite(
            id: id,
            name: blankName,
            folderPath: (fileURL(for: id).path as NSString).abbreviatingWithTildeInPath,
            iconType: .custom,
            iconValue: (artworkFileName as NSString).deletingPathExtension,
            customSVGPath: artworkFileName,
            kind: .spacer
        )
    }

    /// Put back whatever spacers need that has gone missing: their files (a
    /// favorite whose target is gone is skipped, and the row with it), the helper
    /// or its registration (a click would end in "no application can open this"),
    /// or the artwork (the helper bundle would compile it as a plain folder).
    /// A few existence checks and one LaunchServices lookup when nothing is
    /// missing; a no-op when there are no spacers.
    static func repair(_ favorites: [Favorite]) {
        let spacers = favorites.filter { $0.isSpacer && $0.enabled }
        guard !spacers.isEmpty else { return }
        do {
            try ensureArtwork()
            try ensureOpener()
        } catch {
            NSLog("SidebarFavorites: couldn't repair spacers: \(error.localizedDescription)")
        }
        for spacer in spacers where isOurs(spacer) {
            do {
                try ensureFile(for: spacer.id)
            } catch {
                NSLog("SidebarFavorites: couldn't restore spacer \(spacer.folderPath): \(error.localizedDescription)")
            }
        }
    }

    /// Delete a removed spacer's files - only ever `Spacers.noindex/<its id>/`,
    /// and only once its sidebar row is gone. The last spacer out takes the
    /// helper with it.
    static func removeFiles(for favorite: Favorite) {
        guard favorite.isSpacer, isOurs(favorite) else { return }

        // A row whose removal failed must keep something to point at; the next
        // removal attempt can take the files with it. An unreadable list counts
        // as "still there".
        let stillListed: Bool
        do {
            stillListed = try SidebarItemManager.shared.item(matching: favorite.pathMatchCandidates) != nil
        } catch {
            stillListed = true
        }
        guard !stillListed else {
            NSLog("SidebarFavorites: left spacer \(favorite.folderURL.path) in place - its sidebar row is still there")
            return
        }

        let fileManager = FileManager.default
        try? fileManager.removeItem(at: favorite.folderURL.deletingLastPathComponent())

        let others = ((try? fileManager.contentsOfDirectory(atPath: rootURL.path)) ?? [])
            .filter { $0 != openerName && $0 != ".DS_Store" }
        if others.isEmpty {
            _ = ProcessRunner.failureDescription(ProcessRunner.lsregisterPath, ["-u", openerURL.path])
            try? fileManager.removeItem(at: rootURL)
        }
    }

    // MARK: - Private

    private static func fileURL(for id: UUID) -> URL {
        rootURL
            .appendingPathComponent(id.uuidString, isDirectory: true)
            .appendingPathComponent(blankName, isDirectory: false)
    }

    /// The favorite's target is exactly the file this store made for it.
    private static func isOurs(_ favorite: Favorite) -> Bool {
        favorite.folderURL.standardizedFileURL.path == fileURL(for: favorite.id).standardizedFileURL.path
    }

    /// The empty spacer file, carrying the type code that routes it to the helper.
    private static func ensureFile(for id: UUID) throws {
        let fileManager = FileManager.default
        let url = fileURL(for: id)
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if !fileManager.fileExists(atPath: url.path) {
            guard fileManager.createFile(atPath: url.path, contents: Data()) else {
                throw CocoaError(.fileWriteUnknown, userInfo: [NSFilePathErrorKey: url.path])
            }
        }
        let code = NSNumber(value: typeCode)
        try fileManager.setAttributes([.hfsTypeCode: code, .hfsCreatorCode: code], ofItemAtPath: url.path)
    }

    /// The shared helper: the no-op executable built alongside the Finder Sync
    /// helpers, an Info.plist that declares the spacer type and owns it, an ad-hoc
    /// signature (enough to launch a bundle that never leaves this Mac), and a
    /// LaunchServices registration - re-done whenever the type has lost its handler.
    private static func ensureOpener() throws {
        let fileManager = FileManager.default
        let opener = openerURL
        let executable = opener.appendingPathComponent("Contents/MacOS/spacer")

        if fileManager.isExecutableFile(atPath: executable.path) {
            if !openerIsHandler() {
                register()
            }
            return
        }

        guard let template = Bundle.main.resourceURL?.appendingPathComponent("FinderSyncTemplate/spacer-bin"),
              fileManager.isExecutableFile(atPath: template.path) else {
            throw SpacerError.executableMissing
        }

        try? fileManager.removeItem(at: opener)
        try fileManager.createDirectory(at: executable.deletingLastPathComponent(), withIntermediateDirectories: true)
        try fileManager.copyItem(at: template, to: executable)
        try fileManager.setAttributes([.posixPermissions: 0o755], ofItemAtPath: executable.path)

        let info: [String: Any] = [
            "CFBundleExecutable": "spacer",
            "CFBundleIdentifier": openerBundleIdentifier,
            "CFBundleName": "SidebarFavorites Spacer",
            "CFBundlePackageType": "APPL",
            "CFBundleVersion": "1",
            "CFBundleShortVersionString": "1.0",
            "LSBackgroundOnly": true,
            "UTExportedTypeDeclarations": [[
                "UTTypeIdentifier": typeIdentifier,
                "UTTypeDescription": "Sidebar spacer",
                "UTTypeConformsTo": ["public.data"],
                "UTTypeTagSpecification": ["com.apple.ostype": ["SBFs"]],
            ]],
            "CFBundleDocumentTypes": [[
                "CFBundleTypeName": "Sidebar spacer",
                "CFBundleTypeRole": "Viewer",
                "LSHandlerRank": "Owner",
                "LSItemContentTypes": [typeIdentifier],
            ]],
        ]
        let plist = try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0)
        try plist.write(to: opener.appendingPathComponent("Contents/Info.plist"), options: .atomic)

        _ = CodeSigner.shared.signBundle(at: opener, using: .adHoc)
        register()
    }

    private static func register() {
        if let failure = ProcessRunner.failureDescription(ProcessRunner.lsregisterPath, ["-f", openerURL.path]) {
            NSLog("SidebarFavorites: couldn't register the spacer helper: \(failure)")
        }
    }

    /// Whether LaunchServices still sends spacer files to our helper.
    private static func openerIsHandler() -> Bool {
        guard let type = UTType(tag: "SBFs", tagClass: UTTagClass(rawValue: "com.apple.ostype"), conformingTo: nil),
              type.identifier == typeIdentifier,
              let handler = NSWorkspace.shared.urlForApplication(toOpen: type) else {
            return false
        }
        return handler.standardizedFileURL.path == openerURL.standardizedFileURL.path
    }

    private static func ensureArtwork() throws {
        let url = ConfigManager.shared.iconsDirectoryURL.appendingPathComponent(artworkFileName)
        let data = Data(artwork.utf8)
        if (try? Data(contentsOf: url)) != data {
            try data.write(to: url, options: .atomic)
        }
    }
}

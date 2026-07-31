import Foundation

/// A custom icon the target carries **itself**, independently of this app.
///
/// Two forms exist, and they are the same mechanism wearing different names: a
/// folder keeps its icon in a hidden `Icon\r` file, a volume keeps it in
/// `.VolumeIcon.icns` at its root. Both are switched on by the same
/// `kHasCustomIcon` bit in the target's Finder info.
///
/// ## Why this matters here
///
/// A target that carries one of these is the only kind whose sidebar icon does
/// not stick. Measured on macOS 26: any metadata change on such a target - a file
/// copied in, or nothing more than a touched modification date - makes Finder
/// redraw that row from the target's own icon and discard the sidebar override,
/// while leaving the override property itself untouched. A plain folder never
/// does this, and neither does a volume with no `.VolumeIcon.icns`.
///
/// Removing the target's own icon is therefore not a cosmetic preference, it is
/// the only permanent fix. It also costs the user nothing they can see in the
/// sidebar: Finder draws its own template glyph for sidebar rows and has never
/// drawn these icons there. They are only visible on the Desktop, in Finder
/// windows and in Get Info.
enum IconAuthority {
    /// The icon file carried by a target, and how to describe it.
    struct Detection: Equatable {
        /// The target that owns the icon.
        let targetPath: String

        /// The icon file itself: `<folder>/Icon\r`, or `<volume>/.VolumeIcon.icns`.
        let iconFileURL: URL

        /// True when the target is a mounted volume rather than a folder.
        let isVolume: Bool

        /// One sentence naming what was found, for the UI.
        var summary: String {
            isVolume
                ? "This disk has a custom icon of its own."
                : "This folder has a custom icon of its own."
        }

        /// What removing it costs, and what keeping it costs.
        var explanation: String {
            let subject = isVolume ? "disk" : "folder"
            return """
            Finder never shows that icon in the sidebar - it draws its own \
            symbol there - but on macOS 26 its presence makes the sidebar icon \
            disappear again whenever anything in the \(subject) changes.

            Removing it keeps the sidebar icon working. The \(subject) then \
            shows a plain icon on the Desktop and in Finder windows. A copy is \
            kept, so it can be put back.
            """
        }
    }

    // MARK: - Detecting

    /// The custom icon carried by the target at `path`, or nil when it has none.
    ///
    /// Both halves are required: the icon file has to exist AND the target's
    /// `kHasCustomIcon` bit has to be set. A leftover file with the bit cleared
    /// draws nothing and triggers nothing, so it is not reported - removing it
    /// would be meddling with a file that costs the user nothing.
    static func detect(atPath path: String) -> Detection? {
        let url = URL(fileURLWithPath: path)
        guard hasCustomIconFlag(at: url) else { return nil }

        let isVolume = (try? url.resourceValues(forKeys: [.isVolumeKey]).isVolume) == true
        let iconFile = url.appendingPathComponent(isVolume ? volumeIconName : folderIconName)
        guard FileManager.default.fileExists(atPath: iconFile.path) else { return nil }

        return Detection(targetPath: path, iconFileURL: iconFile, isVolume: isVolume)
    }

    // MARK: - Removing

    /// Moves the target's own icon aside and clears its custom-icon bit.
    ///
    /// Returns where the icon was backed up to, so the caller can tell the user
    /// and offer it back later. The copy is made BEFORE anything is removed: a
    /// failure to back up aborts, and the target is left exactly as it was.
    ///
    /// The custom-icon bit is cleared by rewriting the Finder info directly
    /// rather than shelling out to `SetFile`, which lives inside the developer
    /// tools and is not present on most machines.
    @discardableResult
    static func remove(_ detection: Detection, backupDirectory: URL) throws -> URL {
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: backupDirectory, withIntermediateDirectories: true)

        let stamp = ISO8601DateFormatter().string(from: Date())
            .replacingOccurrences(of: ":", with: "-")
        let label = URL(fileURLWithPath: detection.targetPath).lastPathComponent
        let backupURL = backupDirectory
            .appendingPathComponent("\(label)-\(stamp)\(detection.isVolume ? ".icns" : ".Icon")")

        // Copied, not moved: the resource fork carrying the artwork rides along
        // with a copy, and the original stays in place until the copy succeeded.
        try fileManager.copyItem(at: detection.iconFileURL, to: backupURL)
        try fileManager.removeItem(at: detection.iconFileURL)
        try clearCustomIconFlag(at: URL(fileURLWithPath: detection.targetPath))

        return backupURL
    }

    // MARK: - Finder info

    private static let folderIconName = "Icon\r"
    private static let volumeIconName = ".VolumeIcon.icns"
    private static let finderInfoAttribute = "com.apple.FinderInfo"

    /// Offset of the `finderFlags` field within the 32-byte Finder info blob, and
    /// the `kHasCustomIcon` bit inside it (0x0400, i.e. bit 2 of the high byte).
    private static let flagsHighByteOffset = 8
    private static let customIconHighBit: UInt8 = 0x04

    private static func finderInfo(at url: URL) -> [UInt8]? {
        var buffer = [UInt8](repeating: 0, count: 32)
        let read = getxattr(url.path, finderInfoAttribute, &buffer, buffer.count, 0, 0)
        return read == 32 ? buffer : nil
    }

    private static func hasCustomIconFlag(at url: URL) -> Bool {
        guard let info = finderInfo(at: url) else { return false }
        return info[flagsHighByteOffset] & customIconHighBit != 0
    }

    private static func clearCustomIconFlag(at url: URL) throws {
        guard var info = finderInfo(at: url) else { return }
        info[flagsHighByteOffset] &= ~customIconHighBit

        let wrote = setxattr(url.path, finderInfoAttribute, info, info.count, 0, 0)
        guard wrote == 0 else {
            throw NSError(
                domain: NSPOSIXErrorDomain,
                code: Int(errno),
                userInfo: [NSLocalizedDescriptionKey:
                    "The custom-icon flag could not be cleared (\(String(cString: strerror(errno))))."]
            )
        }
    }
}

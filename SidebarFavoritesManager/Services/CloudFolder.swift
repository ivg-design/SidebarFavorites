import Foundation

/// Folders that live in a File Provider mount (Google Drive, Dropbox, OneDrive, ...)
/// or in iCloud Drive.
///
/// Their sidebar rows lose their drawing like a volume's do: with several Google
/// Drive accounts in the sidebar, which rows show the glyph changes from one Finder
/// launch to the next while every row still carries its code (#25). So Refresh
/// repaints them. An in-place re-insert of a folder inside a CloudStorage mount is
/// accepted and keeps the row's ID and position (measured on macOS 26.6); where one
/// is refused, `SidebarReconciler.repaint` falls back to rewriting the property.
enum CloudFolder {
    static func contains(_ path: String) -> Bool {
        let library = (NSHomeDirectory() as NSString).appendingPathComponent("Library") as NSString
        return [
            library.appendingPathComponent("CloudStorage"),
            library.appendingPathComponent("Mobile Documents"),
        ].contains { path.hasPrefix($0 + "/") }
    }

    /// True for the top folder of a File Provider domain - one account's
    /// `~/Library/CloudStorage/GoogleDrive-<account>` - which carries the domain's
    /// identifier as an extended attribute. Reported in diagnostics: Finder draws
    /// such a folder as the provider's own location, so it is the first suspect
    /// when only some cloud rows keep their glyph.
    static func isDomainRoot(_ path: String) -> Bool {
        getxattr(path, "com.apple.file-provider-domain-id", nil, 0, 0, 0) >= 0
    }
}

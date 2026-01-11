import Foundation

/// Represents a single sidebar favorite with its configuration
struct Favorite: Identifiable, Codable, Equatable {
    var id: UUID
    var name: String
    var folderPath: String
    var iconType: IconType
    var iconValue: String  // SF Symbol name or custom symbol name
    var customSVGPath: String?  // Relative path in Icons/ directory
    var enabled: Bool
    var createdAt: Date
    var updatedAt: Date

    /// The type of icon being used
    enum IconType: String, Codable {
        case sfSymbol = "sfSymbol"
        case custom = "custom"
    }

    init(
        id: UUID = UUID(),
        name: String,
        folderPath: String,
        iconType: IconType = .sfSymbol,
        iconValue: String = "folder.fill",
        customSVGPath: String? = nil,
        enabled: Bool = true
    ) {
        self.id = id
        self.name = name
        self.folderPath = folderPath
        self.iconType = iconType
        self.iconValue = iconValue
        self.customSVGPath = customSVGPath
        self.enabled = enabled
        self.createdAt = Date()
        self.updatedAt = Date()
    }

    /// Returns the expanded folder path (resolving ~)
    var expandedFolderPath: String {
        (folderPath as NSString).expandingTildeInPath
    }

    /// Returns the folder URL
    var folderURL: URL {
        URL(fileURLWithPath: expandedFolderPath)
    }

    /// Returns a sanitized name for file system use
    var sanitizedName: String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        return name
            .components(separatedBy: allowed.inverted)
            .joined(separator: "-")
            .lowercased()
    }

    /// Returns the bundle identifier for the generated icon app
    var bundleIdentifier: String {
        "com.ivg-design.SidebarFavorites.\(sanitizedName)"
    }

    /// Returns the extension bundle identifier
    var extensionBundleIdentifier: String {
        "\(bundleIdentifier).Sync"
    }

    /// Returns the app filename (human-readable)
    var appFileName: String {
        "\(sanitizedName).app"
    }

    /// Marks the favorite as updated
    mutating func markUpdated() {
        updatedAt = Date()
    }
}

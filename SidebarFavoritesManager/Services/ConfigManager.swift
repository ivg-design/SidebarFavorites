import Foundation
import Combine

/// Manages configuration persistence and provides reactive updates
final class ConfigManager: ObservableObject {
    static let shared = ConfigManager()

    @Published private(set) var config: Config

    private let fileManager = FileManager.default
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    /// Base directory for all app data
    var appSupportURL: URL {
        let url = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("SidebarFavorites")
        try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    /// Directory for generated icon apps
    var appsDirectoryURL: URL {
        let url = appSupportURL.appendingPathComponent("Apps")
        try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    /// Directory for custom icon SVGs
    var iconsDirectoryURL: URL {
        let url = appSupportURL.appendingPathComponent("Icons")
        try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    /// Path to config.json
    private var configFileURL: URL {
        appSupportURL.appendingPathComponent("config.json")
    }

    private init() {
        // Initialize with default first
        self.config = Config()

        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601

        // Load existing config if available
        if let data = try? Data(contentsOf: configFileURL),
           let loaded = try? decoder.decode(Config.self, from: data) {
            self.config = loaded
        }
    }

    /// Save current configuration to disk
    func save() throws {
        let data = try encoder.encode(config)
        try data.write(to: configFileURL)
    }

    /// Add a new favorite
    func addFavorite(_ favorite: Favorite) throws {
        config.favorites.append(favorite)
        try save()
    }

    /// Update an existing favorite
    func updateFavorite(_ favorite: Favorite) throws {
        guard let index = config.favorites.firstIndex(where: { $0.id == favorite.id }) else {
            throw ConfigError.favoriteNotFound
        }
        var updated = favorite
        updated.markUpdated()
        config.favorites[index] = updated
        try save()
    }

    /// Remove a favorite by ID
    func removeFavorite(id: UUID) throws {
        config.favorites.removeAll { $0.id == id }
        try save()
    }

    /// Get a favorite by ID
    func getFavorite(id: UUID) -> Favorite? {
        config.favorites.first { $0.id == id }
    }

    /// Update settings
    func updateSettings(_ settings: Config.Settings) throws {
        config.settings = settings
        try save()
    }

    /// Returns the app bundle path for a favorite
    func iconAppURL(for favorite: Favorite) -> URL {
        appsDirectoryURL.appendingPathComponent(favorite.appFileName)
    }

    /// Returns the full path for a custom icon SVG
    func customIconURL(relativePath: String) -> URL {
        iconsDirectoryURL.appendingPathComponent(relativePath)
    }

    enum ConfigError: LocalizedError {
        case favoriteNotFound

        var errorDescription: String? {
            switch self {
            case .favoriteNotFound:
                return "Favorite not found in configuration"
            }
        }
    }
}

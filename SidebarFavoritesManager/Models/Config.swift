import Foundation

/// Main configuration model for the app
struct Config: Codable {
    var version: Int = 1
    var favorites: [Favorite]
    var settings: Settings

    struct Settings: Codable {
        var launchAtLogin: Bool = false
        var showInMenuBar: Bool = true
    }

    init(favorites: [Favorite] = [], settings: Settings = Settings()) {
        self.favorites = favorites
        self.settings = settings
    }

    /// Returns enabled favorites only
    var enabledFavorites: [Favorite] {
        favorites.filter { $0.enabled }
    }
}

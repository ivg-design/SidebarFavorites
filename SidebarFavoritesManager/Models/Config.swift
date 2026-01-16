import Foundation

/// Main configuration model for the app
struct Config: Codable {
    var version: Int = 1
    var favorites: [Favorite]
    var settings: Settings

    struct Settings: Codable {
        var launchAtLogin: Bool = false
        var showInMenuBar: Bool = true
        var signingIdentity: SigningIdentity = .automatic

        // Custom coding keys to handle older config files without signingIdentity
        enum CodingKeys: String, CodingKey {
            case launchAtLogin
            case showInMenuBar
            case signingIdentity
        }

        init(launchAtLogin: Bool = false, showInMenuBar: Bool = true, signingIdentity: SigningIdentity = .automatic) {
            self.launchAtLogin = launchAtLogin
            self.showInMenuBar = showInMenuBar
            self.signingIdentity = signingIdentity
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            launchAtLogin = try container.decodeIfPresent(Bool.self, forKey: .launchAtLogin) ?? false
            showInMenuBar = try container.decodeIfPresent(Bool.self, forKey: .showInMenuBar) ?? true
            signingIdentity = try container.decodeIfPresent(SigningIdentity.self, forKey: .signingIdentity) ?? .automatic
        }
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

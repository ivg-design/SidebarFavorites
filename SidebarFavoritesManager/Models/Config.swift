import Foundation

/// Main configuration model for the app
struct Config: Codable {
    /// Schema version written by this build.
    /// 1 = 0.5.x/0.6.0 (generated FinderSync icon apps)
    /// 3 = 0.7.0 (single helper bundle + LSSharedFileList icon overrides)
    static let currentVersion = 3

    var version: Int = currentVersion
    var favorites: [Favorite]
    var settings: Settings

    /// SHA-256 of the canonical helper declaration payload that produced the
    /// helper bundle currently on disk. An unchanged digest short-circuits the
    /// whole plist/actool/codesign/lsregister chain.
    var helperDigest: String?

    /// Monotonic counter written as the helper bundle's `CFBundleVersion`,
    /// bumped on every rebuild so LaunchServices sees a new record.
    var helperGeneration: Int = 1

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

    enum CodingKeys: String, CodingKey {
        case version
        case favorites
        case settings
        case helperDigest
        case helperGeneration
    }

    init(
        favorites: [Favorite] = [],
        settings: Settings = Settings(),
        version: Int = Config.currentVersion,
        helperDigest: String? = nil,
        helperGeneration: Int = 1
    ) {
        self.version = version
        self.favorites = favorites
        self.settings = settings
        self.helperDigest = helperDigest
        self.helperGeneration = helperGeneration
    }

    /// Decodes tolerantly so a 0.6.0 config.json - which has no `version` when
    /// written by the earliest builds and none of the helper keys - loads
    /// without tripping the corrupt-config path. A missing `version` means
    /// "pre-0.7.0", which is what drives migration.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 1
        favorites = try container.decodeIfPresent([Favorite].self, forKey: .favorites) ?? []
        settings = try container.decodeIfPresent(Settings.self, forKey: .settings) ?? Settings()
        helperDigest = try container.decodeIfPresent(String.self, forKey: .helperDigest)
        helperGeneration = try container.decodeIfPresent(Int.self, forKey: .helperGeneration) ?? 1
    }

    /// Returns enabled favorites only
    var enabledFavorites: [Favorite] {
        favorites.filter { $0.enabled }
    }
}

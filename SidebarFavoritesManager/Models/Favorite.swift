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

    /// The private four-character OSType code bound to this favorite's icon.
    /// Written into the helper bundle's `UTTypeTagSpecification["com.apple.ostype"]`
    /// and set verbatim (case-sensitive!) as the sidebar row's
    /// `com.apple.LSSharedFileList.OverrideIcon.OSType` property.
    /// Allocated once by `OSTypeAllocator` and never changed afterwards.
    var osType: String?

    /// `LSSharedFileListItemGetID` of the sidebar row this favorite is bound to.
    /// Stable across processes, so it is safe to persist.
    var sidebarItemID: UInt32?

    /// How the bound sidebar row came to exist - decides what happens on removal.
    var sidebarProvenance: SidebarProvenance

    /// Optical size correction for this favorite's custom artwork, as a multiple
    /// of the size the synthesizer would otherwise give it.
    ///
    /// `1.0` - the default, and what every favorite written before this key
    /// existed decodes to - means the plain cap-band fit, which puts an imported
    /// SVG's ink box exactly where a system SF Symbol's sits. That is objectively
    /// right and optically approximate: Apple's symbols are hand-tuned one at a
    /// time, so a wide or dense mark reads heavier than a narrow one at the same
    /// box. Nothing about arbitrary artwork says how heavy it will look, so this
    /// is the manual correction for it.
    ///
    /// Only meaningful for `.custom` icons - see `effectiveIconScale`.
    ///
    /// Always inside `iconScaleRange`: the observer below clamps every assignment
    /// and both initializers clamp what they are handed, so no code path can store
    /// a value the rest of the pipeline would have to defend against.
    var iconScale: Double = Favorite.defaultIconScale {
        didSet { iconScale = Favorite.clampedIconScale(iconScale) }
    }

    /// No correction: the artwork is fitted the way it always was.
    static let defaultIconScale: Double = 1.0

    /// How far the correction may go in either direction.
    ///
    /// Deliberately narrow. This exists to fix "reads a little heavy", not to
    /// resize artwork - anything outside this either stops looking like a sidebar
    /// icon or disappears, and both are better fixed in the source SVG.
    static let iconScaleRange: ClosedRange<Double> = 0.5...1.5

    /// The nearest usable scale to `value`. A non-finite value - which JSON can
    /// carry and arithmetic can produce - is not clamped into range but replaced,
    /// because there is no sensible direction to clamp a NaN in.
    static func clampedIconScale(_ value: Double) -> Double {
        guard value.isFinite else { return defaultIconScale }
        return min(max(value, iconScaleRange.lowerBound), iconScaleRange.upperBound)
    }

    /// The type of icon being used
    enum IconType: String, Codable {
        case sfSymbol = "sfSymbol"
        case custom = "custom"
    }

    /// Where a bound sidebar row came from.
    /// `.managed` rows were inserted by this app and may be removed again;
    /// `.adopted` rows were created by the user, so removal only clears the
    /// icon override and never deletes the row.
    enum SidebarProvenance: String, Codable {
        case unbound
        case managed
        case adopted
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case folderPath
        case iconType
        case iconValue
        case customSVGPath
        case enabled
        case createdAt
        case updatedAt
        case osType
        case sidebarItemID
        case sidebarProvenance
        case iconScale
    }

    init(
        id: UUID = UUID(),
        name: String,
        folderPath: String,
        iconType: IconType = .sfSymbol,
        iconValue: String = "folder.fill",
        customSVGPath: String? = nil,
        enabled: Bool = true,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        osType: String? = nil,
        sidebarItemID: UInt32? = nil,
        sidebarProvenance: SidebarProvenance = .unbound,
        iconScale: Double = Favorite.defaultIconScale
    ) {
        self.id = id
        self.name = name
        self.folderPath = folderPath
        self.iconType = iconType
        self.iconValue = iconValue
        self.customSVGPath = customSVGPath
        self.enabled = enabled
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.osType = osType
        self.sidebarItemID = sidebarItemID
        self.sidebarProvenance = sidebarProvenance
        // Property observers do not run during initialization, so the invariant
        // `iconScale` carries has to be established by hand in both initializers.
        self.iconScale = Favorite.clampedIconScale(iconScale)
    }

    /// Decodes tolerantly so a 0.6.0 config.json - which has none of the
    /// sidebar-binding keys - loads without tripping the corrupt-config path.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        folderPath = try container.decode(String.self, forKey: .folderPath)
        iconType = try container.decodeIfPresent(IconType.self, forKey: .iconType) ?? .sfSymbol
        iconValue = try container.decodeIfPresent(String.self, forKey: .iconValue) ?? "folder.fill"
        customSVGPath = try container.decodeIfPresent(String.self, forKey: .customSVGPath)
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt) ?? Date()
        osType = try container.decodeIfPresent(String.self, forKey: .osType)
        sidebarItemID = try container.decodeIfPresent(UInt32.self, forKey: .sidebarItemID)
        sidebarProvenance = try container.decodeIfPresent(SidebarProvenance.self, forKey: .sidebarProvenance) ?? .unbound
        // Absent means 1.0, which is why adding this key needed no schema bump: a
        // config written before it existed describes exactly the same icons, and a
        // build that predates it simply ignores the key on the way back in.
        iconScale = Favorite.clampedIconScale(
            try container.decodeIfPresent(Double.self, forKey: .iconScale) ?? Favorite.defaultIconScale
        )
    }

    /// The scale that is actually applied to this favorite's artwork.
    ///
    /// A system SF Symbol is referenced by name and drawn by macOS from its own
    /// hand-tuned outlines - there is no artwork of ours to rescale - so the
    /// correction is inert there rather than silently half-applied. Keeping that
    /// decision in one place also keeps a stale value left behind by switching
    /// icon types out of the helper's digest.
    var effectiveIconScale: Double {
        iconType == .custom ? iconScale : Favorite.defaultIconScale
    }

    /// Returns the expanded folder path (resolving ~)
    var expandedFolderPath: String {
        (folderPath as NSString).expandingTildeInPath
    }

    /// Returns the folder URL
    var folderURL: URL {
        URL(fileURLWithPath: expandedFolderPath)
    }

    /// Paths a sidebar row may resolve to for this favorite. Contains the standardized
    /// path and, when different, the symlink-resolved path - 0.6.0 users were told to
    /// point favorites at symlinks pointing into ~/Library/CloudStorage, and those rows
    /// may resolve either way.
    var pathMatchCandidates: Set<String> {
        var candidates: Set<String> = []

        func add(_ path: String) {
            guard !path.isEmpty else { return }
            candidates.insert(path)
            // Sidebar rows are folders; a bookmark may resolve with or without
            // the trailing separator depending on how it was created.
            if path.count > 1, path.hasSuffix("/") {
                candidates.insert(String(path.dropLast()))
            }
        }

        let expanded = expandedFolderPath
        add(expanded)
        add((expanded as NSString).standardizingPath)

        let url = URL(fileURLWithPath: expanded)
        add(url.standardizedFileURL.path)
        add(url.resolvingSymlinksInPath().path)

        return candidates
    }

    /// Marks the favorite as updated
    mutating func markUpdated() {
        updatedAt = Date()
    }
}

import SwiftUI

/// Draws a stored custom icon exactly the way the compiled symbol will be drawn.
///
/// "Exactly" is the whole point: the artwork goes through
/// `SymbolValidator.glyphGeometry` and `SymbolTemplateSynthesizer.previewImage`,
/// which is the same parse and the same fit `SymbolCatalogBuilder` compiles into
/// the helper bundle. Up to 1.0 this view ran its own regex over the file looking
/// for a `Regular-S` group, so an ordinary SVG - which has no such group - drew
/// whatever the regex happened to land on, and a row could show a mark that was
/// nowhere in the file.
struct SVGThumbnailView: View {
    let url: URL
    let size: CGFloat

    /// The favorite's optical size correction, so a row in the app's own list is
    /// drawn at the size Finder will draw it and not at the uncorrected one.
    var iconScale: CGFloat = CGFloat(Favorite.defaultIconScale)

    @State private var image: NSImage?
    @State private var isLoading = true

    var body: some View {
        Group {
            if let image {
                Image(nsImage: image)
                    .resizable()
                    .renderingMode(.template) // Allow tinting via .foregroundColor
                    .aspectRatio(contentMode: .fit)
            } else if isLoading {
                ProgressView()
                    .scaleEffect(0.5)
            } else {
                // Fallback placeholder
                Image(systemName: "square.on.square")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        // Keyed on the scale as well as the file: rescaling a favorite changes what
        // this has to draw without changing which file it draws.
        .task(id: "\(url.absoluteString)|\(size)|\(iconScale)") {
            await loadThumbnail()
        }
    }

    @MainActor
    private func loadThumbnail() async {
        isLoading = true
        image = await SVGThumbnailCache.shared.thumbnail(for: url, size: size, iconScale: iconScale)
        isLoading = false
    }
}

/// Cache for SVG thumbnails to avoid regenerating them repeatedly
actor SVGThumbnailCache {
    static let shared = SVGThumbnailCache()

    private var cache: [String: NSImage] = [:]

    /// The URL stays the prefix so `invalidate(for:)` can still drop every
    /// rendering of one file by matching on it.
    private func cacheKey(url: URL, size: CGFloat, iconScale: CGFloat) -> String {
        "\(url.absoluteString)_\(Int(size))_\(String(format: "%.3f", Double(iconScale)))"
    }

    func thumbnail(
        for url: URL,
        size: CGFloat,
        iconScale: CGFloat = CGFloat(Favorite.defaultIconScale)
    ) async -> NSImage? {
        let key = cacheKey(url: url, size: size, iconScale: iconScale)

        // Check cache first
        if let cached = cache[key] {
            return cached
        }

        // Generate thumbnail
        let image = generateThumbnail(for: url, size: size, iconScale: iconScale)

        // Cache it
        if let image {
            cache[key] = image
        }

        return image
    }

    func invalidate(for url: URL) {
        // Remove all cached sizes for this URL
        let prefix = url.absoluteString
        cache = cache.filter { !$0.key.hasPrefix(prefix) }
    }

    func clearAll() {
        cache.removeAll()
    }

    /// One parse, one fit - the same two calls `SymbolCatalogBuilder` makes when
    /// it compiles this icon into the helper bundle's `Assets.car`.
    private func generateThumbnail(for url: URL, size: CGFloat, iconScale: CGFloat) -> NSImage? {
        do {
            let geometry = try SymbolValidator.glyphGeometry(at: url)
            return SymbolTemplateSynthesizer.previewImage(
                for: geometry,
                size: size,
                iconScale: iconScale
            )
        } catch {
            NSLog("SVGThumbnailCache: could not draw \(url.lastPathComponent): \(error.localizedDescription)")
            return nil
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        // Test with a sample SVG URL
        if let url = Bundle.main.url(forResource: "test", withExtension: "svg") {
            SVGThumbnailView(url: url, size: 48)
                .foregroundColor(.accentColor)
        }

        Text("SVG Thumbnail Preview")
            .font(.caption)
    }
    .padding()
}

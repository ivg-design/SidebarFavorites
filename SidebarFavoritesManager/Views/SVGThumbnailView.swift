import SwiftUI

/// A SwiftUI view that renders an SF Symbol SVG file
/// Extracts the Regular-S symbol variant and renders it using NSImage
struct SVGThumbnailView: View {
    let url: URL
    let size: CGFloat

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
        .task(id: url) {
            await loadThumbnail()
        }
    }

    @MainActor
    private func loadThumbnail() async {
        isLoading = true
        image = await SVGThumbnailCache.shared.thumbnail(for: url, size: size)
        isLoading = false
    }
}

/// Cache for SVG thumbnails to avoid regenerating them repeatedly
actor SVGThumbnailCache {
    static let shared = SVGThumbnailCache()

    private var cache: [String: NSImage] = [:]

    private func cacheKey(url: URL, size: CGFloat) -> String {
        "\(url.absoluteString)_\(Int(size))"
    }

    func thumbnail(for url: URL, size: CGFloat) async -> NSImage? {
        let key = cacheKey(url: url, size: size)

        // Check cache first
        if let cached = cache[key] {
            return cached
        }

        // Generate thumbnail
        let image = await generateThumbnail(for: url, size: size)

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

    private func generateThumbnail(for url: URL, size: CGFloat) async -> NSImage? {
        // Extract the Regular-S symbol region from the SF Symbol template SVG
        guard let extractedSVG = extractSymbolSVG(from: url) else {
            NSLog("SVGThumbnailCache: Failed to extract symbol from \(url.lastPathComponent)")
            return nil
        }

        // Render using NSImage (supports SVG natively)
        return renderSVGWithNSImage(svg: extractedSVG, size: size)
    }

    /// Extract just the Regular-S symbol variant from an SF Symbol template SVG
    /// Creates a standalone SVG with proper viewBox for rendering
    private func extractSymbolSVG(from url: URL) -> String? {
        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            return nil
        }

        // Find the Regular-S group boundaries from the Guides section
        // Standard SF Symbol template coordinates for Regular-S (Small scale)
        var baselineY: CGFloat = 696
        var caplineY: CGFloat = 625.541
        var leftMargin: CGFloat = 1394.79  // Default for Regular-S
        var rightMargin: CGFloat = 1504.9  // Default for Regular-S

        // Helper to extract number from attribute
        func extractNumber(from text: String, attribute: String) -> CGFloat? {
            let pattern = "\(attribute)=\"([0-9.]+)\""
            guard let regex = try? NSRegularExpression(pattern: pattern),
                  let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
                  let numRange = Range(match.range(at: 1), in: text) else {
                return nil
            }
            return CGFloat(Double(text[numRange]) ?? 0)
        }

        // Parse Baseline-S (y coordinate)
        if let range = content.range(of: "<line[^>]*id=\"Baseline-S\"[^>]*>", options: .regularExpression) {
            let line = String(content[range])
            if let y = extractNumber(from: line, attribute: "y1") {
                baselineY = y
            }
        }

        // Parse Capline-S (y coordinate)
        if let range = content.range(of: "<line[^>]*id=\"Capline-S\"[^>]*>", options: .regularExpression) {
            let line = String(content[range])
            if let y = extractNumber(from: line, attribute: "y1") {
                caplineY = y
            }
        }

        // Parse left-margin-Regular-S (x coordinate)
        if let range = content.range(of: "<line[^>]*id=\"left-margin-Regular-S\"[^>]*>", options: .regularExpression) {
            let line = String(content[range])
            if let x = extractNumber(from: line, attribute: "x1") {
                leftMargin = x
            }
        }

        // Parse right-margin-Regular-S (x coordinate)
        if let range = content.range(of: "<line[^>]*id=\"right-margin-Regular-S\"[^>]*>", options: .regularExpression) {
            let line = String(content[range])
            if let x = extractNumber(from: line, attribute: "x1") {
                rightMargin = x
            }
        }

        // Calculate viewBox with padding
        let padding: CGFloat = 5
        let viewX = leftMargin - padding
        let viewY = caplineY - padding
        let viewWidth = (rightMargin - leftMargin) + (padding * 2)
        let viewHeight = (baselineY - caplineY) + (padding * 2)

        NSLog("SVGThumbnailCache: viewBox = \(viewX) \(viewY) \(viewWidth) \(viewHeight)")

        // Extract the Regular-S group content
        guard let regularSStart = content.range(of: "<g id=\"Regular-S\">"),
              let regularSEnd = content.range(of: "</g>", range: regularSStart.upperBound..<content.endIndex) else {
            NSLog("SVGThumbnailCache: Regular-S group not found")
            // Fallback: try to find any path in Symbols group
            guard let symbolsStart = content.range(of: "<g id=\"Symbols\">"),
                  let symbolsEnd = content.range(of: "</g>", options: [], range: symbolsStart.upperBound..<content.endIndex) else {
                return nil
            }
            let symbolsContent = String(content[symbolsStart.upperBound..<symbolsEnd.lowerBound])
            return createStandaloneSVG(content: symbolsContent, viewBox: (viewX, viewY, viewWidth, viewHeight))
        }

        // Include the closing </g> tag
        let groupContent = String(content[regularSStart.lowerBound...regularSEnd.upperBound])
        NSLog("SVGThumbnailCache: Extracted Regular-S content, length: \(groupContent.count)")

        return createStandaloneSVG(content: groupContent, viewBox: (viewX, viewY, viewWidth, viewHeight))
    }

    /// Create a standalone SVG string with the extracted symbol content
    private func createStandaloneSVG(content: String, viewBox: (CGFloat, CGFloat, CGFloat, CGFloat)) -> String {
        let (x, y, width, height) = viewBox
        return """
        <?xml version="1.0" encoding="UTF-8"?>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="\(x) \(y) \(width) \(height)" width="\(width)" height="\(height)">
            <style>
                path, rect, circle, ellipse, polygon { fill: black; }
            </style>
            \(content)
        </svg>
        """
    }

    /// Render SVG string to NSImage
    private func renderSVGWithNSImage(svg: String, size: CGFloat) -> NSImage? {
        guard let svgData = svg.data(using: .utf8) else {
            NSLog("SVGThumbnailCache: Failed to convert SVG to data")
            return nil
        }

        guard let svgImage = NSImage(data: svgData) else {
            NSLog("SVGThumbnailCache: NSImage failed to load SVG data")
            return nil
        }

        // Create a new image at the target size
        let targetSize = NSSize(width: size, height: size)
        let scaledImage = NSImage(size: targetSize, flipped: false) { rect in
            // Calculate aspect-fit rect
            let svgSize = svgImage.size
            let scale = min(rect.width / svgSize.width, rect.height / svgSize.height)
            let scaledWidth = svgSize.width * scale
            let scaledHeight = svgSize.height * scale
            let x = (rect.width - scaledWidth) / 2
            let y = (rect.height - scaledHeight) / 2

            svgImage.draw(in: NSRect(x: x, y: y, width: scaledWidth, height: scaledHeight))
            return true
        }

        scaledImage.isTemplate = true
        return scaledImage
    }
}

// MARK: - SymbolValidator extension for SVG rendering

extension SymbolValidator {
    /// Render a preview using NSImage (accurate SVG rendering)
    /// This replaces the custom path parser with native SVG support
    static func renderPreviewQL(from url: URL, size: CGFloat = 24) async -> NSImage? {
        return await SVGThumbnailCache.shared.thumbnail(for: url, size: size)
    }

    /// Synchronous wrapper for places that can't use async
    /// Uses a completion handler pattern
    static func renderPreviewQL(from url: URL, size: CGFloat = 24, completion: @escaping (NSImage?) -> Void) {
        Task {
            let image = await SVGThumbnailCache.shared.thumbnail(for: url, size: size)
            await MainActor.run {
                completion(image)
            }
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

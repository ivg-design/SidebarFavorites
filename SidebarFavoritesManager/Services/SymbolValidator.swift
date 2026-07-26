import CoreGraphics
import Foundation

/// Entry point for turning a user-supplied SVG into a sidebar icon.
///
/// Sidebar icons are SF Symbol *templates*: macOS renders them as a single flat
/// silhouette in whatever colour the sidebar is currently using. The app
/// synthesizes the entire SF Symbols template scaffold around the user's artwork
/// (`SVGGeometryParser` + `SymbolTemplateSynthesizer`), so an imported file no
/// longer has to *be* a template - it only has to contain vector geometry.
///
/// This type therefore answers exactly two questions:
///
///  1. Can the file be read and parsed as SVG?
///  2. Does it contain vector geometry we can turn into a silhouette?
///
/// Everything else - colour, gradients, embedded photos, live text, artwork that
/// is too fine to read at 16 pt - is reported as a *warning*, because the
/// pipeline drops or flattens it rather than failing on it. A well-formed SF
/// Symbols template still imports fine; it simply takes the same path as any
/// other SVG.
struct SymbolValidator {

    // MARK: - Artwork

    /// Vector artwork extracted from an SVG, ready to preview and synthesize.
    ///
    /// `@unchecked Sendable` is safe here: `path` is snapshotted with `copy()` on
    /// construction, so the value this type hands out can never be mutated.
    struct Artwork: @unchecked Sendable {
        /// Combined geometry of every drawable element, in SVG (y-down) space.
        let path: CGPath

        /// Fill rule the source artwork was drawn with.
        let fillRule: CGPathFillRule

        /// The source carried raster image data (`<image>`, an embedded PNG/JPEG).
        /// Raster content compiles without error but renders *empty* inside an SF
        /// Symbol, so it is dropped - the user needs to be told.
        let droppedRaster: Bool

        /// How well this silhouette is expected to read at sidebar size.
        let legibility: Legibility

        init(path: CGPath, fillRule: CGPathFillRule, droppedRaster: Bool, legibility: Legibility) {
            self.path = path.copy() ?? path
            self.fillRule = fillRule
            self.droppedRaster = droppedRaster
            self.legibility = legibility
        }
    }

    /// A verdict on whether the silhouette will actually be readable in a 16 pt
    /// sidebar row. Purely advisory - every case still imports.
    enum Legibility: Equatable {
        /// Reads fine at sidebar size.
        case good
        /// Almost no ink at 16 pt: hairline strokes, or a small mark on a big canvas.
        case sparse
        /// Fills its box almost completely, so it reads as a solid block.
        case dense
        /// Thin strokes or fine detail: most of the ink lands on half-lit pixels.
        case busy

        var warning: String? {
            switch self {
            case .good:
                return nil
            case .sparse:
                return "Almost nothing survives at 16 pt - the artwork is very thin, very small, or floating on a much bigger canvas. Thicker shapes or a tighter crop read better."
            case .dense:
                return "This fills its box almost completely, so it will read as a solid block rather than as an icon."
            case .busy:
                return "Thin strokes and fine detail blur into grey at 16 pt. A bolder, simpler shape reads better."
            }
        }
    }

    // MARK: - Validation

    struct ValidationResult {
        var isValid: Bool
        var errors: [ValidationError]
        var warnings: [String]

        /// The parsed artwork. Present whenever `isValid` is `true`, so callers can
        /// preview the silhouette without parsing the file a second time.
        var artwork: Artwork?

        init(
            isValid: Bool,
            errors: [ValidationError] = [],
            warnings: [String] = [],
            artwork: Artwork? = nil
        ) {
            self.isValid = isValid
            self.errors = errors
            self.warnings = warnings
            self.artwork = artwork
        }
    }

    /// The only ways an import can genuinely fail. Everything structural about SF
    /// Symbols templates - `Symbols` / `Guides` layers, weight variants, the
    /// template-version marker, `descriptive-name` - is synthesized by the app and
    /// is deliberately *not* checked here.
    enum ValidationError: LocalizedError, Equatable {
        /// The file could not be opened at all.
        case fileNotReadable
        /// Parsed, but it is not an SVG document.
        case notAnSVG(rootElement: String?)
        /// The XML itself is broken.
        case malformedSVG(detail: String)
        /// Valid SVG, but nothing in it can become vector geometry.
        /// `rasterOnly` is the common case: an SVG that just wraps a bitmap.
        case noDrawableGeometry(rasterOnly: Bool)
        /// Geometry came back, but it is degenerate - it would fill to nothing.
        case geometryNotUsable

        var errorDescription: String? {
            switch self {
            case .fileNotReadable:
                return "Couldn't read this file."
            case .notAnSVG:
                return "This isn't an SVG file."
            case .malformedSVG:
                return "Couldn't read this SVG."
            case .noDrawableGeometry(let rasterOnly):
                return rasterOnly
                    ? "This SVG just wraps an image."
                    : "This SVG has no shapes we can use."
            case .geometryNotUsable:
                return "We couldn't turn this SVG into a shape."
            }
        }

        var recoverySuggestion: String? {
            switch self {
            case .fileNotReadable:
                return "It may have been moved, or you may not have permission to open it."
            case .notAnSVG(let rootElement):
                if let rootElement, !rootElement.isEmpty {
                    return "It parsed as XML, but its root element is <\(rootElement)> rather than <svg>."
                }
                return "Export it again as SVG from your drawing app."
            case .malformedSVG(let detail):
                return detail.isEmpty
                    ? "Its XML is malformed. Try exporting it again from your drawing app."
                    : "Its XML is malformed: \(detail)"
            case .noDrawableGeometry(let rasterOnly):
                return rasterOnly
                    ? "macOS draws sidebar icons from vector outlines, so an embedded photo or PNG can't be used. Export the artwork as paths, or trace it first."
                    : "Sidebar icons are built from vector shapes - paths, rectangles, circles. There are none in this file."
            case .geometryNotUsable:
                return "The shapes in it came out empty. Live text and stroke-only artwork usually need to be converted to outlines in your drawing app first."
            }
        }
    }

    /// Validate an SVG the user picked, and extract its artwork.
    ///
    /// This is the single front door for imports: `importSymbol(from:named:)` runs
    /// it, and the import sheet runs it again on the stored copy to build its
    /// preview.
    static func validate(at url: URL) -> ValidationResult {
        guard let data = try? Data(contentsOf: url), !data.isEmpty else {
            return ValidationResult(isValid: false, errors: [.fileNotReadable])
        }

        // Pass 1: the source document itself. The geometry parser reports what it
        // could draw; this pass is what tells us about the things it quietly
        // flattens or leaves behind, which is what the user needs warning about.
        let scan = SVGScan(data: data)

        // Pass 2: the real geometry. `SVGGeometryParser` owns the hard questions -
        // well-formedness, whether it is an SVG at all, and whether anything in it
        // can become an outline - so its verdict is the one that decides.
        let geometry: SVGGeometry
        do {
            geometry = try glyphGeometry(at: url)
        } catch {
            return ValidationResult(isValid: false, errors: [validationError(for: error, scan: scan)])
        }

        guard isUsable(geometry.path) else {
            return ValidationResult(isValid: false, errors: [.geometryNotUsable])
        }

        let artwork = Artwork(
            path: geometry.path,
            fillRule: geometry.fillRule,
            droppedRaster: geometry.droppedRasterContent || scan.hasRaster,
            legibility: legibility(of: geometry.path, fillRule: geometry.fillRule)
        )

        var warnings: [String] = []
        if artwork.droppedRaster {
            warnings.append("The embedded image was dropped - a sidebar icon can't contain a photo or a PNG, only vector shapes.")
        }
        if scan.hasLiveText {
            warnings.append("Live text isn't converted to shapes. If lettering is missing from the preview, outline it in your drawing app and import again.")
        }
        if let dropped = droppedElementsWarning(for: geometry) {
            warnings.append(dropped)
        }
        if scan.hasGradient || scan.distinctPaintCount > 1 {
            warnings.append("Colours and gradients flatten into one silhouette, so lighter areas won't stay lighter.")
        }
        if let aspectWarning = aspectWarning(for: artwork.path) {
            warnings.append(aspectWarning)
        }
        if let legibilityWarning = artwork.legibility.warning {
            warnings.append(legibilityWarning)
        }

        return ValidationResult(isValid: true, errors: [], warnings: warnings, artwork: artwork)
    }

    // MARK: - Import

    /// Copy a validated SVG into `ConfigManager.iconsDirectoryURL` and return its
    /// path relative to that directory.
    ///
    /// The stored file keeps the user's original artwork verbatim; the SF Symbols
    /// template is synthesized from it later, when the helper bundle is built.
    ///
    /// The returned path is not necessarily `name`: symbols are deduplicated by
    /// name downstream, so importing a second, *different* `logo.svg` picks
    /// `logo-2.svg` rather than silently repainting an existing favorite. Callers
    /// should take the favorite's symbol name from the returned path.
    static func importSymbol(from sourceURL: URL, named name: String) throws -> String {
        let result = validate(at: sourceURL)
        guard result.isValid else {
            throw ImportError.validationFailed(result.errors)
        }

        let fileManager = FileManager.default
        let iconsDirectory = ConfigManager.shared.iconsDirectoryURL
        let base = sanitizedSymbolName(name)

        // Everything already in Icons/, so a second "logo.svg" cannot take a name
        // an existing favorite is relying on.
        let taken = Set(
            ((try? fileManager.contentsOfDirectory(
                at: iconsDirectory,
                includingPropertiesForKeys: nil
            )) ?? [])
                .filter { $0.pathExtension.lowercased() == "svg" }
                .map { $0.deletingPathExtension().lastPathComponent }
        )

        let candidate: String
        let existingURL = iconsDirectory.appendingPathComponent("\(base).svg")
        let sourceData = try? Data(contentsOf: sourceURL)
        if let sourceData, let stored = try? Data(contentsOf: existingURL), stored == sourceData {
            // Re-importing the exact same artwork reuses the file it already has.
            candidate = base
        } else {
            candidate = SymbolTemplateSynthesizer.uniqueSymbolName(base, avoiding: taken)
        }

        let relativePath = "\(candidate).svg"
        let destinationURL = iconsDirectory.appendingPathComponent(relativePath)
        if fileManager.fileExists(atPath: destinationURL.path) {
            try fileManager.removeItem(at: destinationURL)
        }
        try fileManager.copyItem(at: sourceURL, to: destinationURL)

        return relativePath
    }

    /// Fold a file name into the name this icon will be known by.
    ///
    /// Delegates to `SymbolTemplateSynthesizer`, which owns the rule for the whole
    /// pipeline (`"Company Logo.svg"` -> `"custom.company.logo"`), so the file
    /// stored in `Icons/`, the favorite's `iconValue` and the symbol compiled into
    /// `Assets.car` all end up with the same name instead of three near-misses.
    /// It is idempotent, so re-importing an already-named icon is a no-op.
    static func sanitizedSymbolName(_ raw: String) -> String {
        let name = SymbolTemplateSynthesizer.sanitizedSymbolName(raw)
        // Belt and braces: the name is also a path component in Icons/.
        guard SymbolCatalogBuilder.isValidSymbolName(name),
              SymbolTemplateSynthesizer.isAcceptableSymbolName(name) else {
            return SymbolTemplateSynthesizer.namespacePrefix + "icon"
        }
        return name
    }

    enum ImportError: LocalizedError {
        case validationFailed([ValidationError])

        var errorDescription: String? {
            switch self {
            case .validationFailed(let errors):
                let described = errors.compactMap { $0.errorDescription }
                return described.isEmpty ? "This SVG can't be used as an icon." : described.joined(separator: " ")
            }
        }
    }

    // MARK: - Geometry parser adapter

    /// The one way a *stored* icon file becomes glyph geometry.
    ///
    /// Every consumer of `Icons/` goes through here - the import sheet's preview,
    /// the sidebar row thumbnails, the menu-bar icon, and the template
    /// `SymbolCatalogBuilder` hands to `actool`. That is the whole point: one parse
    /// means the preview cannot show something the compiled symbol will not draw.
    ///
    /// Two shapes of file arrive here and both come out as the same thing:
    ///
    /// * an ordinary SVG the user dropped in (a logo, an exported icon), parsed
    ///   whole;
    /// * an SF Symbols template made the old way - every custom icon stored by
    ///   0.5.0 and 0.6.0 is one - whose `Regular-S` glyph is lifted out first.
    ///   Parsed whole, a template is an artboard: six guide lines, three weight
    ///   columns of the same mark and a `Template v.N` text marker, which would
    ///   union into a striped rectangle.
    static func glyphGeometry(at url: URL) throws -> SVGGeometry {
        if let text = try? String(contentsOf: url, encoding: .utf8),
           let glyphDocument = templateGlyphDocument(from: text),
           let geometry = try? SVGGeometryParser.parse(svg: glyphDocument),
           !geometry.isEmpty {
            return geometry
        }
        return try SVGGeometryParser.parse(contentsOf: url)
    }

    /// If `text` is an SF Symbols template, a standalone SVG holding just its
    /// `Regular-S` glyph; otherwise `nil`.
    ///
    /// Exposed because the helper-bundle build needs exactly the same treatment:
    /// whatever artwork this returns for a stored file is the artwork the
    /// synthesized symbol has to be built from, or the preview and the icon in
    /// Finder will disagree.
    static func templateGlyphDocument(from text: String) -> String? {
        guard text.range(of: #"id\s*=\s*["']Symbols["']"#, options: .regularExpression) != nil,
              let glyph = enclosingGroup(withID: "Regular-S", in: text),
              glyph.range(
                of: #"<(path|rect|circle|ellipse|polygon|polyline|line|use)\b"#,
                options: .regularExpression
              ) != nil else {
            return nil
        }
        return #"<svg xmlns="http://www.w3.org/2000/svg">"# + glyph + "</svg>"
    }

    /// Extract `<g id="...">...</g>` while tracking nesting, so the match runs to
    /// the *matching* close tag rather than the first one.
    private static func enclosingGroup(withID id: String, in text: String) -> String? {
        let escapedID = NSRegularExpression.escapedPattern(for: id)
        guard let openRegex = try? NSRegularExpression(
                pattern: "<g\\b[^>]*id\\s*=\\s*[\"']\(escapedID)[\"'][^>]*>"
              ),
              let openMatch = openRegex.firstMatch(
                in: text,
                range: NSRange(text.startIndex..., in: text)
              ),
              let openRange = Range(openMatch.range, in: text),
              !text[openRange].hasSuffix("/>"),
              let tagRegex = try? NSRegularExpression(pattern: "<g\\b[^>]*/?>|</g>") else {
            return nil
        }

        var depth = 1
        var cursor = openRange.upperBound
        var iterations = 0
        while cursor < text.endIndex, iterations < 10_000 {
            iterations += 1
            guard let match = tagRegex.firstMatch(
                    in: text,
                    range: NSRange(cursor..<text.endIndex, in: text)
                  ),
                  let matchRange = Range(match.range, in: text) else {
                return nil
            }

            let tag = text[matchRange]
            if tag == "</g>" {
                depth -= 1
                if depth == 0 {
                    return String(text[openRange.lowerBound..<matchRange.upperBound])
                }
            } else if !tag.hasSuffix("/>") {
                depth += 1
            }
            cursor = matchRange.upperBound
        }
        return nil
    }

    /// Restate a parse failure in the import sheet's own terms. `SVGGeometryError`
    /// is written for a developer reading a log; these are written for someone who
    /// just dragged a logo in and wants to know what to fix.
    private static func validationError(for error: Error, scan: SVGScan) -> ValidationError {
        guard let geometryError = error as? SVGGeometryError else {
            return .geometryNotUsable
        }
        switch geometryError {
        case .unreadableFile:
            return .fileNotReadable
        case .malformedXML(let detail):
            return .malformedSVG(detail: detail)
        case .notAnSVG:
            return .notAnSVG(rootElement: scan.rootElement)
        case .noRenderableGeometry(let hadRasterContent):
            return .noDrawableGeometry(rasterOnly: hadRasterContent)
        }
    }

    /// Elements the parser understood but could not turn into geometry, minus the
    /// two that already have warnings of their own.
    private static func droppedElementsWarning(for geometry: SVGGeometry) -> String? {
        let alreadyReported: Set<String> = ["image", "text", "tspan", "textpath"]
        let remaining = geometry.droppedElements
            .filter { !alreadyReported.contains($0.lowercased()) }
        guard !remaining.isEmpty else { return nil }

        let list = remaining.map { "<\($0)>" }.joined(separator: ", ")
        return "Some parts of this SVG can't be reproduced in a symbol (\(list)). The preview shows what the icon will actually contain."
    }

    private static func isUsable(_ path: CGPath) -> Bool {
        guard !path.isEmpty else { return false }
        let box = path.boundingBoxOfPath
        guard !box.isNull, !box.isInfinite,
              box.width.isFinite, box.height.isFinite else {
            return false
        }
        // A zero-width or zero-height path fills to nothing - e.g. a single
        // straight stroke that was never outlined.
        return box.width > 0.0001 && box.height > 0.0001
    }

    // MARK: - Legibility

    /// Rasterize the silhouette at sidebar size and judge whether anything
    /// readable survives.
    ///
    /// The thresholds are measured, not guessed - they were fitted against a
    /// spread of real shapes rendered through exactly this code path, and are set
    /// to stay quiet for anything a person would recognise as an icon:
    ///
    ///     shape                    coverage  softRatio  verdict
    ///     filled circle               0.61      0.14     good
    ///     GitHub octocat              0.41      0.54     good
    ///     letter "A"                  0.24      0.60     good
    ///     ring, 22% stroke            0.42      0.31     good
    ///     solid square                0.77      0.22     dense
    ///     solid rounded square        0.75      0.19     dense
    ///     ring, 4% stroke             0.09      1.00     busy
    ///     20 hairline stripes         0.39      1.00     busy
    ///     bar 5% of canvas high       0.04      1.00     sparse
    ///     "ACME CORP" wordmark        0.03      1.00     sparse
    static func legibility(of path: CGPath, fillRule: CGPathFillRule) -> Legibility {
        guard let ink = inkStatistics(path: path, fillRule: fillRule, pixels: 16) else {
            return .good
        }

        if ink.coverage < 0.04 { return .sparse }
        // 0.774 is the most a shape can cover once the side bearing is applied,
        // so "almost the whole box" starts a little under that.
        if ink.coverage > 0.72 { return .dense }
        // Nearly all the ink landing on partly-lit pixels means the features are
        // sub-pixel here: the artwork is being smeared rather than drawn.
        if ink.softRatio > 0.80 { return .busy }

        return .good
    }

    /// Sidebar icons are square. Artwork far off square gets scaled down to fit
    /// its long side, which is what makes wordmark logos illegible.
    static func aspectWarning(for path: CGPath) -> String? {
        let box = path.boundingBoxOfPath
        guard box.width > 0, box.height > 0 else { return nil }
        let ratio = max(box.width / box.height, box.height / box.width)
        guard ratio > 3 else { return nil }

        return box.width > box.height
            ? "Much wider than it is tall. Sidebar icons are square, so this gets shrunk to fit its width - a compact mark works better than a wordmark."
            : "Much taller than it is wide. Sidebar icons are square, so this gets shrunk to fit its height - a compact mark reads better."
    }

    /// Aspect-fit `path` into a `pixels`-square bitmap and measure its ink.
    /// - Returns: `coverage` (mean alpha over the whole canvas) and `softRatio`
    ///   (share of inked pixels that came out under 85% opacity, i.e. detail the
    ///   rasterizer could not draw solidly at this size).
    private static func inkStatistics(
        path: CGPath,
        fillRule: CGPathFillRule,
        pixels: Int
    ) -> (coverage: Double, softRatio: Double)? {
        let box = path.boundingBoxOfPath
        guard pixels > 0, box.width > 0, box.height > 0 else { return nil }

        guard let context = CGContext(
            data: nil,
            width: pixels,
            height: pixels,
            bitsPerComponent: 8,
            bytesPerRow: pixels * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }
        context.setShouldAntialias(true)

        // Same fit the synthesizer uses conceptually: uniform scale, centred, with
        // a little side bearing so edge-to-edge artwork isn't reported as denser
        // than it will actually look.
        let inset = Double(pixels) * 0.06
        let available = Double(pixels) - inset * 2
        let scale = min(available / Double(box.width), available / Double(box.height))
        var transform = CGAffineTransform.identity
            .translatedBy(x: CGFloat(pixels) / 2, y: CGFloat(pixels) / 2)
            .scaledBy(x: CGFloat(scale), y: CGFloat(scale))
            .translatedBy(x: -box.midX, y: -box.midY)
        guard let fitted = path.copy(using: &transform) else { return nil }

        context.addPath(fitted)
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fillPath(using: fillRule)

        guard let raw = context.data else { return nil }
        let byteCount = pixels * pixels * 4
        let buffer = raw.bindMemory(to: UInt8.self, capacity: byteCount)

        var totalAlpha = 0.0
        var inked = 0
        var soft = 0
        for offset in stride(from: 3, to: byteCount, by: 4) {
            let alpha = Double(buffer[offset]) / 255.0
            totalAlpha += alpha
            if alpha > 0.02 {
                inked += 1
                if alpha < 0.85 { soft += 1 }
            }
        }

        let coverage = totalAlpha / Double(pixels * pixels)
        let softRatio = inked == 0 ? 0 : Double(soft) / Double(inked)
        return (coverage, softRatio)
    }
}

// MARK: - Source document scan

/// One pass over the raw XML for the things `SVGGeometryParser` does not report:
/// how many colours the artwork uses, and whether it leans on live text. Purely
/// advisory - the parser decides whether an import succeeds.
///
/// Content inside an SF Symbols template's `Guides` / `Notes` layers is skipped,
/// so importing a real template reports on the artwork and not on the scaffold -
/// its `<text id="template-version">` marker is not a wordmark.
private final class SVGScan: NSObject, XMLParserDelegate {

    private(set) var rootElement: String?
    private(set) var hasRaster = false
    private(set) var hasLiveText = false
    private(set) var hasGradient = false

    private var paints: Set<String> = []
    var distinctPaintCount: Int { paints.count }

    /// Depth inside a subtree we are deliberately ignoring (template scaffolding).
    private var ignoreDepth = 0

    private static let gradientElements: Set<String> = [
        "lineargradient", "radialgradient", "meshgradient"
    ]
    private static let ignoredGroupIDs: Set<String> = ["guides", "notes"]
    /// `<text>` markers that belong to the SF Symbols template scaffold, not to art.
    private static let scaffoldTextIDs: Set<String> = ["template-version", "descriptive-name"]
    private static let nonColourPaints: Set<String> = [
        "none", "transparent", "inherit", "currentcolor", "context-fill", "context-stroke"
    ]

    init(data: Data) {
        super.init()
        let parser = XMLParser(data: data)
        parser.shouldProcessNamespaces = true
        parser.shouldResolveExternalEntities = false
        parser.delegate = self
        // A parse failure needs no handling here: whatever was collected before it
        // is still usable, and the geometry parser reports the malformed XML.
        _ = parser.parse()
    }

    func parser(
        _ parser: XMLParser,
        didStartElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?,
        attributes attributeDict: [String: String] = [:]
    ) {
        let name = elementName.lowercased()
        if rootElement == nil {
            rootElement = name
        }

        if ignoreDepth > 0 {
            ignoreDepth += 1
            return
        }

        let id = (attributeDict["id"] ?? "").lowercased()
        if name == "g", Self.ignoredGroupIDs.contains(id) {
            ignoreDepth = 1
            return
        }

        if name == "image" {
            hasRaster = true
        } else if name == "text" || name == "textpath" {
            if !Self.scaffoldTextIDs.contains(id) {
                hasLiveText = true
            }
        } else if Self.gradientElements.contains(name) {
            hasGradient = true
        }

        collectPaint(from: attributeDict)
    }

    func parser(
        _ parser: XMLParser,
        didEndElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?
    ) {
        if ignoreDepth > 0 {
            ignoreDepth -= 1
        }
    }

    private func collectPaint(from attributes: [String: String]) {
        for key in ["fill", "stroke"] {
            if let value = attributes[key] {
                addPaint(value)
            }
        }
        guard let style = attributes["style"] else { return }
        for declaration in style.split(separator: ";") {
            let parts = declaration.split(separator: ":", maxSplits: 1)
            guard parts.count == 2 else { continue }
            let property = parts[0].trimmingCharacters(in: .whitespaces).lowercased()
            guard property == "fill" || property == "stroke" else { continue }
            addPaint(String(parts[1]))
        }
    }

    private func addPaint(_ raw: String) {
        var value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !value.isEmpty else { return }

        if value.hasPrefix("url(") {
            // A paint server: a gradient or a pattern. Either way it flattens.
            hasGradient = true
            return
        }
        guard !Self.nonColourPaints.contains(value) else { return }

        // Normalize equivalent spellings so #000 / #000000 / black count once.
        if value == "black" { value = "#000000" }
        if value == "white" { value = "#ffffff" }
        if value.hasPrefix("#"), value.count == 4 {
            value = "#" + value.dropFirst().map { "\($0)\($0)" }.joined()
        }

        paints.insert(value)
    }
}

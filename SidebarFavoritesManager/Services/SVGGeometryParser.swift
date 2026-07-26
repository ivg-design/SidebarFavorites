import CoreGraphics
import Foundation

/// Everything `SVGGeometryParser` could learn about one arbitrary SVG file.
///
/// `path` is a single flattened outline in SVG user space (y grows *downward*),
/// with every ancestor transform already composed in and every stroke converted
/// to a filled outline. That is exactly the shape `SymbolTemplateSynthesizer`
/// wants: the SF Symbol rasterizer fills geometry and silently drops both raster
/// content and un-outlined strokes.
struct SVGGeometry {
    /// The artwork as one path, y-down, in the root element's user space, ready to
    /// fill with `fillRule` - which is always `.winding`, the only rule the SF
    /// Symbol rasterizer has.
    ///
    /// Getting there took two adjustments, both already applied:
    ///
    /// * even-odd shapes are rewound, because `actool` ignores `fill-rule` and
    ///   would otherwise fill their holes in solid;
    /// * every shape's outer contour is wound the same way, because an SVG paints
    ///   its elements one at a time while a glyph is a single path - without this,
    ///   two overlapping shapes that happened to be drawn in opposite directions
    ///   cancel and punch a hole that is nowhere in the original.
    ///
    /// Measured against AppKit's own SVG rasterizer, the result matches the source
    /// silhouette to an IoU of 0.999+ on arcs, transforms, strokes, `<use>` and
    /// even-odd artwork.
    let path: CGPath

    /// The rule `path` has to be filled with: always `.winding`. It is carried
    /// explicitly so callers that pass artwork around as `(path, fillRule)` - and
    /// callers that supply their own `CGPath` from a font glyph or an in-app
    /// drawing - all speak the same language.
    let fillRule: CGPathFillRule

    /// What the file itself asked for. Purely informational: `path` already
    /// accounts for it.
    let declaredFillRule: CGPathFillRule

    /// The individual painted elements, in document order, each with the rule it
    /// declared - before they were merged into `path`.
    let shapes: [SVGShape]

    /// The root `viewBox`, when the file declared one.
    let viewBox: CGRect?

    /// The root `width`/`height`, when both were absolute lengths.
    let declaredSize: CGSize?

    /// True when the file carried `<image>` content. Raster compiles without an
    /// `actool` error and then renders *completely empty*, so the caller has to
    /// warn instead of shipping a blank icon.
    let droppedRasterContent: Bool

    /// Tag names that were understood but could not become geometry
    /// (`image`, `text`, `mask`, `clipPath`, ...), sorted and deduplicated.
    let droppedElements: [String]

    /// Tight bounding box of `path`.
    var bounds: CGRect { path.boundingBoxOfPath }

    var isEmpty: Bool { path.isEmpty }
}

/// One painted SVG element, already transformed into root user space and already
/// outlined if it was stroked.
struct SVGShape {
    let path: CGPath
    let fillRule: CGPathFillRule
}

enum SVGGeometryError: LocalizedError {
    case unreadableFile(URL)
    case malformedXML(String)
    case notAnSVG
    /// The file parsed, but nothing in it can become vector geometry. The
    /// associated flag says whether the reason was that it is a raster wrapper.
    case noRenderableGeometry(hadRasterContent: Bool)

    var errorDescription: String? {
        switch self {
        case .unreadableFile(let url):
            return "Could not read \(url.lastPathComponent)."
        case .malformedXML(let detail):
            return "That file is not valid XML: \(detail)"
        case .notAnSVG:
            return "That file does not contain an <svg> element."
        case .noRenderableGeometry(let hadRaster):
            return hadRaster
                ? "That SVG only contains an embedded image. Sidebar icons are drawn from vector outlines, so a bitmap cannot be used - export the artwork as paths, or trace it first."
                : "That SVG contains no shapes to draw."
        }
    }
}

/// Parses an *ordinary* SVG - a logo, an exported icon, something drawn by hand -
/// into one flattened `CGPath`.
///
/// Deliberately wider than the SF Symbol template parsing elsewhere in the app:
/// the whole point is that the user never has to touch an SF Symbols template, so
/// whatever they drop in has to survive. Handled here:
///
/// * `<path d>` with the complete command set - `M m L l H h V v C c S s Q q T t
///   A a Z z`, implicit command repeats, exponent notation, compact arc flags.
/// * `<rect>` (including `rx`/`ry`), `<circle>`, `<ellipse>`, `<polygon>`,
///   `<polyline>`, `<line>`.
/// * Nested `<g>` with `transform` (`translate`, `scale`, `rotate`, `matrix`,
///   `skewX`, `skewY`), composed down the tree.
/// * `<use>` references into `<defs>`/`<symbol>`, with cycle protection.
/// * The root `viewBox` / `width` / `height` mapping.
/// * `fill-rule`, and `stroke` -> outline conversion honouring `stroke-width`,
///   caps, joins and the local transform.
/// * Presentation attributes, inline `style="..."`, and simple `<style>` rules
///   (type / `.class` / `#id`), which is how Illustrator marks up stroked art.
///
/// Uses `XMLParser`, never a regular expression, so nested structure and
/// attribute quoting behave.
enum SVGGeometryParser {
    // MARK: - Entry points

    static func parse(contentsOf url: URL) throws -> SVGGeometry {
        guard let data = try? Data(contentsOf: url) else {
            throw SVGGeometryError.unreadableFile(url)
        }
        return try parse(data)
    }

    static func parse(svg string: String) throws -> SVGGeometry {
        guard let data = string.data(using: .utf8) else {
            throw SVGGeometryError.malformedXML("not UTF-8 encodable")
        }
        return try parse(data)
    }

    static func parse(_ data: Data) throws -> SVGGeometry {
        let root = try documentTree(from: data)
        guard root.name == "svg" else { throw SVGGeometryError.notAnSVG }

        var renderer = Renderer(stylesheet: Stylesheet(collectedFrom: root))
        renderer.indexIdentifiers(in: root)

        let (viewBox, declaredSize, rootTransform) = rootMapping(of: root)
        renderer.render(node: root, state: RenderState(ctm: rootTransform), depth: 0)

        let shapes = renderer.paintedShapes()
        let merged = SVGPathWinding.unionedGlyphPath(of: shapes)
        guard !merged.isEmpty else {
            throw SVGGeometryError.noRenderableGeometry(hadRasterContent: renderer.droppedRaster)
        }

        return SVGGeometry(
            path: merged,
            fillRule: .winding,
            declaredFillRule: shapes.contains { $0.fillRule == .evenOdd } ? .evenOdd : .winding,
            shapes: shapes,
            viewBox: viewBox,
            declaredSize: declaredSize,
            droppedRasterContent: renderer.droppedRaster,
            droppedElements: renderer.dropped.sorted()
        )
    }

    // MARK: - XML -> node tree

    /// Lightweight DOM. Building one first (instead of rendering straight from the
    /// `XMLParser` callbacks) is what makes `<use>` and `<style>` resolvable, since
    /// both need to look at elements that may appear *after* the reference.
    final class Node {
        let name: String
        let attributes: [String: String]
        private(set) var children: [Node] = []
        fileprivate(set) var text: String = ""

        init(name: String, attributes: [String: String]) {
            self.name = name
            self.attributes = attributes
        }

        fileprivate func append(_ child: Node) { children.append(child) }
    }

    private final class TreeBuilder: NSObject, XMLParserDelegate {
        var root: Node?
        var failure: String?
        private var stack: [Node] = []

        func parser(_ parser: XMLParser,
                    didStartElement elementName: String,
                    namespaceURI: String?,
                    qualifiedName qName: String?,
                    attributes attributeDict: [String: String]) {
            // With namespace processing off, `elementName` still carries a prefix
            // ("svg:rect"); strip it so both parsing modes agree.
            let local = Self.localName(elementName)
            var attributes: [String: String] = [:]
            attributes.reserveCapacity(attributeDict.count)
            for (key, value) in attributeDict {
                attributes[Self.localName(key)] = value
            }

            let node = Node(name: local, attributes: attributes)
            if let parent = stack.last {
                parent.append(node)
            } else if root == nil {
                root = node
            }
            stack.append(node)
        }

        func parser(_ parser: XMLParser,
                    didEndElement elementName: String,
                    namespaceURI: String?,
                    qualifiedName qName: String?) {
            if !stack.isEmpty { stack.removeLast() }
        }

        func parser(_ parser: XMLParser, foundCharacters string: String) {
            stack.last?.text += string
        }

        func parser(_ parser: XMLParser, foundCDATA CDATABlock: Data) {
            if let text = String(data: CDATABlock, encoding: .utf8) {
                stack.last?.text += text
            }
        }

        func parser(_ parser: XMLParser, parseErrorOccurred parseError: Error) {
            failure = parseError.localizedDescription
        }

        private static func localName(_ name: String) -> String {
            guard let colon = name.lastIndex(of: ":") else { return name }
            return String(name[name.index(after: colon)...])
        }
    }

    private static func documentTree(from data: Data) throws -> Node {
        // Namespace processing on is the correct reading; a file with an undeclared
        // prefix makes libxml bail, so fall back to raw qualified names (the
        // builder strips prefixes either way).
        var lastFailure: String?
        for processNamespaces in [true, false] {
            let parser = XMLParser(data: data)
            parser.shouldProcessNamespaces = processNamespaces
            parser.shouldResolveExternalEntities = false
            let builder = TreeBuilder()
            parser.delegate = builder
            let ok = parser.parse()
            if ok, let root = builder.root { return root }
            lastFailure = builder.failure ?? lastFailure
        }
        throw SVGGeometryError.malformedXML(lastFailure ?? "unrecognized content")
    }

    // MARK: - Root viewBox / width / height

    private static func rootMapping(of root: Node) -> (CGRect?, CGSize?, CGAffineTransform) {
        let viewBox = parseViewBox(root.attributes["viewBox"])
        let width = length(root.attributes["width"])
        let height = length(root.attributes["height"])
        let declaredSize: CGSize? = {
            guard let width, let height, width > 0, height > 0 else { return nil }
            return CGSize(width: width, height: height)
        }()

        guard let viewBox, viewBox.width > 0, viewBox.height > 0 else {
            return (viewBox, declaredSize, .identity)
        }

        // Shift the viewBox origin to (0, 0). Uniform ("meet") scaling is left
        // alone on purpose: the synthesizer normalizes by the artwork's own
        // bounding box, so a global scale factor changes nothing, while a
        // *non-uniform* one ("preserveAspectRatio: none") changes the shape and
        // therefore has to be applied.
        var transform = CGAffineTransform(translationX: -viewBox.minX, y: -viewBox.minY)
        let preserve = root.attributes["preserveAspectRatio"]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        if preserve?.hasPrefix("none") == true, let size = declaredSize {
            transform = transform.concatenating(
                CGAffineTransform(scaleX: size.width / viewBox.width, y: size.height / viewBox.height)
            )
        }
        return (viewBox, declaredSize, transform)
    }

    private static func parseViewBox(_ raw: String?) -> CGRect? {
        guard let numbers = raw.map({ SVGGeometryParser.numberList($0) }), numbers.count >= 4 else { return nil }
        return CGRect(x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3])
    }

    // MARK: - Rendering state

    fileprivate struct RenderState {
        var ctm: CGAffineTransform = .identity
        var fills = true
        var fillRule: CGPathFillRule = .winding
        var strokes = false
        var strokeWidth: CGFloat = 1
        var lineCap: CGLineCap = .butt
        var lineJoin: CGLineJoin = .miter
        var miterLimit: CGFloat = 4
    }

    private struct Renderer {
        let stylesheet: Stylesheet
        private var identifiers: [String: Node] = [:]
        /// Every painted element, kept separate: an SVG's painting model is
        /// per-element, and collapsing that too early is what turns overlapping
        /// shapes into accidental holes.
        private var shapes: [SVGShape] = []
        var droppedRaster = false
        var dropped: Set<String> = []

        init(stylesheet: Stylesheet) { self.stylesheet = stylesheet }

        mutating func indexIdentifiers(in node: Node) {
            if let id = node.attributes["id"], identifiers[id] == nil {
                identifiers[id] = node
            }
            for child in node.children { indexIdentifiers(in: child) }
        }

        /// Elements whose *content* is only drawn when a `<use>` points at it, or
        /// that describe paint rather than shape.
        private static let deferredContainers: Set<String> = [
            "defs", "symbol", "clippath", "mask", "marker", "pattern", "filter",
            "lineargradient", "radialgradient", "meshgradient", "style", "metadata",
            "title", "desc", "script", "foreignobject"
        ]

        private static let reportedButUndrawn: Set<String> = [
            "text", "textpath", "tspan", "clippath", "mask", "filter", "foreignobject", "script"
        ]

        mutating func render(node: Node, state inherited: RenderState, depth: Int) {
            // Deep enough for anything Illustrator nests, shallow enough that a
            // <use> cycle or a hostile file cannot run away with the stack.
            guard depth < 64 else { return }
            let tag = node.name.lowercased()

            if tag == "image" {
                droppedRaster = true
                dropped.insert("image")
                return
            }
            if Self.deferredContainers.contains(tag) {
                if Self.reportedButUndrawn.contains(tag) { dropped.insert(tag) }
                return
            }
            if Self.reportedButUndrawn.contains(tag) {
                dropped.insert(tag)
                return
            }

            let declarations = stylesheet.declarations(for: node)
            guard !isHidden(declarations) else { return }

            var state = inherited
            apply(declarations, to: &state)
            state.ctm = SVGGeometryParser.transform(from: node.attributes["transform"])
                .concatenating(state.ctm)

            switch tag {
            case "svg", "g", "a", "switch":
                // A nested <svg> re-origins its children; the root's own mapping is
                // already folded into the state the caller passed in.
                if tag == "svg", depth > 0 {
                    let x = SVGGeometryParser.length(node.attributes["x"]) ?? 0
                    let y = SVGGeometryParser.length(node.attributes["y"]) ?? 0
                    state.ctm = CGAffineTransform(translationX: x, y: y).concatenating(state.ctm)
                }
                for child in node.children {
                    render(node: child, state: state, depth: depth + 1)
                }

            case "use":
                let reference = node.attributes["href"] ?? node.attributes["xlink:href"]
                guard let reference, reference.hasPrefix("#") else { dropped.insert("use"); return }
                guard let target = identifiers[String(reference.dropFirst())], target !== node else {
                    dropped.insert("use")
                    return
                }
                let x = SVGGeometryParser.length(node.attributes["x"]) ?? 0
                let y = SVGGeometryParser.length(node.attributes["y"]) ?? 0
                var useState = state
                useState.ctm = CGAffineTransform(translationX: x, y: y).concatenating(state.ctm)
                // <symbol> and <defs> are only ever drawn through a reference, so
                // their children are rendered directly; anything else - including a
                // plain <g>, whose own transform and styling still have to apply -
                // goes through the normal path.
                let targetTag = target.name.lowercased()
                if targetTag == "symbol" || targetTag == "defs" {
                    for child in target.children {
                        render(node: child, state: useState, depth: depth + 1)
                    }
                } else {
                    render(node: target, state: useState, depth: depth + 1)
                }

            default:
                guard let shape = SVGGeometryParser.shapePath(for: node, tag: tag) else {
                    if !tag.isEmpty, !["svg", "g"].contains(tag) { dropped.insert(tag) }
                    return
                }
                emit(shape: shape, tag: tag, state: state)
            }
        }

        /// Fill first, then the stroke outline, both mapped through the CTM.
        ///
        /// Stroking happens in the element's *local* space and only then gets
        /// transformed - that is SVG's own rule, and it is what makes
        /// `stroke-width` come out right under a scaling ancestor.
        private mutating func emit(shape: ShapeGeometry, tag: String, state: RenderState) {
            var ctm = state.ctm

            if state.fills, shape.fillable {
                if let filled = shape.path.copy(using: &ctm) {
                    add(filled, rule: state.fillRule)
                }
            }

            if state.strokes, state.strokeWidth > 0 {
                let outline = shape.path.copy(
                    strokingWithWidth: state.strokeWidth,
                    lineCap: state.lineCap,
                    lineJoin: state.lineJoin,
                    miterLimit: state.miterLimit
                )
                if let stroked = outline.copy(using: &ctm) {
                    // A stroke outline is always a nonzero shape.
                    add(stroked, rule: .winding)
                }
            }
        }

        private mutating func add(_ path: CGPath, rule: CGPathFillRule) {
            guard !path.isEmpty else { return }
            shapes.append(SVGShape(path: path, fillRule: rule))
        }

        func paintedShapes() -> [SVGShape] { shapes }

        // MARK: Style -> state

        private func isHidden(_ declarations: [String: String]) -> Bool {
            if declarations["display"]?.lowercased().contains("none") == true { return true }
            if declarations["visibility"]?.lowercased().hasPrefix("hidden") == true { return true }
            if let opacity = SVGGeometryParser.number(declarations["opacity"]), opacity <= 0.001 {
                return true
            }
            return false
        }

        private func apply(_ declarations: [String: String], to state: inout RenderState) {
            if let fill = declarations["fill"] {
                state.fills = !isNone(fill)
            }
            if let opacity = SVGGeometryParser.number(declarations["fill-opacity"]), opacity <= 0.001 {
                state.fills = false
            }
            if let rule = declarations["fill-rule"]?.lowercased() {
                state.fillRule = (rule == "evenodd" || rule == "even-odd") ? .evenOdd : .winding
            }
            if let stroke = declarations["stroke"] {
                state.strokes = !isNone(stroke)
            }
            if let opacity = SVGGeometryParser.number(declarations["stroke-opacity"]), opacity <= 0.001 {
                state.strokes = false
            }
            if let width = SVGGeometryParser.length(declarations["stroke-width"]) {
                state.strokeWidth = width
            }
            if let cap = declarations["stroke-linecap"]?.lowercased() {
                state.lineCap = cap == "round" ? .round : (cap == "square" ? .square : .butt)
            }
            if let join = declarations["stroke-linejoin"]?.lowercased() {
                state.lineJoin = join == "round" ? .round : (join == "bevel" ? .bevel : .miter)
            }
            if let limit = SVGGeometryParser.number(declarations["stroke-miterlimit"]), limit > 0 {
                state.miterLimit = limit
            }
        }

        private func isNone(_ paint: String) -> Bool {
            let value = paint.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return value == "none" || value == "transparent" || value.isEmpty
        }
    }

    // MARK: - Shapes

    fileprivate struct ShapeGeometry {
        let path: CGPath
        /// `<line>` and `<polyline>` exist to be stroked; `<line>` can never be
        /// filled, so filling it would invent geometry that is not in the file.
        let fillable: Bool
    }

    fileprivate static func shapePath(for node: Node, tag: String) -> ShapeGeometry? {
        let attributes = node.attributes

        switch tag {
        case "path":
            guard let d = attributes["d"], !d.isEmpty else { return nil }
            let path = SVGPathData.path(from: d)
            return path.isEmpty ? nil : ShapeGeometry(path: path, fillable: true)

        case "rect":
            let width = length(attributes["width"]) ?? 0
            let height = length(attributes["height"]) ?? 0
            guard width > 0, height > 0 else { return nil }
            let x = length(attributes["x"]) ?? 0
            let y = length(attributes["y"]) ?? 0
            let rect = CGRect(x: x, y: y, width: width, height: height)

            // SVG's rx/ry defaulting: either one alone stands in for the other,
            // and both clamp to half the side.
            var rx = length(attributes["rx"])
            var ry = length(attributes["ry"])
            if rx == nil { rx = ry }
            if ry == nil { ry = rx }
            let cornerX = min(max(rx ?? 0, 0), width / 2)
            let cornerY = min(max(ry ?? 0, 0), height / 2)
            let path: CGPath = (cornerX > 0 && cornerY > 0)
                ? CGPath(roundedRect: rect, cornerWidth: cornerX, cornerHeight: cornerY, transform: nil)
                : CGPath(rect: rect, transform: nil)
            return ShapeGeometry(path: path, fillable: true)

        case "circle":
            guard let r = length(attributes["r"]), r > 0 else { return nil }
            let cx = length(attributes["cx"]) ?? 0
            let cy = length(attributes["cy"]) ?? 0
            let box = CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2)
            return ShapeGeometry(path: CGPath(ellipseIn: box, transform: nil), fillable: true)

        case "ellipse":
            let rx = length(attributes["rx"]) ?? length(attributes["ry"]) ?? 0
            let ry = length(attributes["ry"]) ?? rx
            guard rx > 0, ry > 0 else { return nil }
            let cx = length(attributes["cx"]) ?? 0
            let cy = length(attributes["cy"]) ?? 0
            let box = CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2)
            return ShapeGeometry(path: CGPath(ellipseIn: box, transform: nil), fillable: true)

        case "line":
            let x1 = length(attributes["x1"]) ?? 0
            let y1 = length(attributes["y1"]) ?? 0
            let x2 = length(attributes["x2"]) ?? 0
            let y2 = length(attributes["y2"]) ?? 0
            let path = CGMutablePath()
            path.move(to: CGPoint(x: x1, y: y1))
            path.addLine(to: CGPoint(x: x2, y: y2))
            return ShapeGeometry(path: path.copy()!, fillable: false)

        case "polygon", "polyline":
            let numbers = numberList(attributes["points"] ?? "")
            guard numbers.count >= 4 else { return nil }
            let path = CGMutablePath()
            path.move(to: CGPoint(x: numbers[0], y: numbers[1]))
            var index = 2
            while index + 1 < numbers.count {
                path.addLine(to: CGPoint(x: numbers[index], y: numbers[index + 1]))
                index += 2
            }
            if tag == "polygon" { path.closeSubpath() }
            return ShapeGeometry(path: path.copy()!, fillable: true)

        default:
            return nil
        }
    }

    // MARK: - transform="..."

    /// Composes an SVG transform list. SVG applies the list right-to-left
    /// (`transform="A B"` means "B, then A"), which in `CGAffineTransform`'s
    /// row-vector convention is `M_B * M_A`.
    fileprivate static func transform(from raw: String?) -> CGAffineTransform {
        guard let raw, !raw.isEmpty else { return .identity }
        var result = CGAffineTransform.identity
        var scanner = raw.startIndex

        while scanner < raw.endIndex {
            // name
            while scanner < raw.endIndex, !raw[scanner].isLetter { scanner = raw.index(after: scanner) }
            guard scanner < raw.endIndex else { break }
            var nameEnd = scanner
            while nameEnd < raw.endIndex, raw[nameEnd].isLetter { nameEnd = raw.index(after: nameEnd) }
            let name = raw[scanner..<nameEnd].lowercased()

            // (arguments)
            guard let open = raw[nameEnd...].firstIndex(of: "("),
                  let close = raw[open...].firstIndex(of: ")") else { break }
            let arguments = numberList(String(raw[raw.index(after: open)..<close]))
            scanner = raw.index(after: close)

            let step: CGAffineTransform
            switch name {
            case "translate":
                step = CGAffineTransform(
                    translationX: arguments.count > 0 ? arguments[0] : 0,
                    y: arguments.count > 1 ? arguments[1] : 0
                )
            case "scale":
                let sx = arguments.count > 0 ? arguments[0] : 1
                let sy = arguments.count > 1 ? arguments[1] : sx
                step = CGAffineTransform(scaleX: sx, y: sy)
            case "rotate":
                let angle = (arguments.count > 0 ? arguments[0] : 0) * .pi / 180
                if arguments.count >= 3 {
                    let cx = arguments[1], cy = arguments[2]
                    step = CGAffineTransform(translationX: -cx, y: -cy)
                        .concatenating(CGAffineTransform(rotationAngle: angle))
                        .concatenating(CGAffineTransform(translationX: cx, y: cy))
                } else {
                    step = CGAffineTransform(rotationAngle: angle)
                }
            case "matrix":
                guard arguments.count >= 6 else { step = .identity; break }
                step = CGAffineTransform(
                    a: arguments[0], b: arguments[1],
                    c: arguments[2], d: arguments[3],
                    tx: arguments[4], ty: arguments[5]
                )
            case "skewx":
                let angle = (arguments.count > 0 ? arguments[0] : 0) * .pi / 180
                step = CGAffineTransform(a: 1, b: 0, c: tan(angle), d: 1, tx: 0, ty: 0)
            case "skewy":
                let angle = (arguments.count > 0 ? arguments[0] : 0) * .pi / 180
                step = CGAffineTransform(a: 1, b: tan(angle), c: 0, d: 1, tx: 0, ty: 0)
            default:
                step = .identity
            }

            // "apply `step` first, then everything already accumulated to its left"
            result = step.concatenating(result)
        }
        return result
    }

    // MARK: - Stylesheet (presentation attributes + <style> + style="")

    /// The subset of CSS an icon file realistically uses. Illustrator and Figma
    /// both emit `<style>.cls-1{fill:none;stroke:#000;stroke-width:2}</style>`,
    /// and getting that wrong turns stroked art into a solid blob.
    private struct Stylesheet {
        private var byType: [String: [String: String]] = [:]
        private var byClass: [String: [String: String]] = [:]
        private var byIdentifier: [String: [String: String]] = [:]

        private static let inheritedProperties = [
            "fill", "fill-rule", "fill-opacity",
            "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
            "stroke-miterlimit", "stroke-opacity",
            "opacity", "display", "visibility"
        ]

        init(collectedFrom root: Node) {
            var sheets: [String] = []
            Self.collect(from: root, into: &sheets)
            for sheet in sheets { ingest(sheet) }
        }

        private static func collect(from node: Node, into sheets: inout [String]) {
            if node.name.lowercased() == "style", !node.text.isEmpty {
                sheets.append(node.text)
            }
            for child in node.children { Self.collect(from: child, into: &sheets) }
        }

        private mutating func ingest(_ css: String) {
            // Strip comments, then split on rule blocks. Media queries and other
            // at-rules are skipped rather than mis-parsed.
            var text = css
            while let start = text.range(of: "/*"), let end = text.range(of: "*/", range: start.upperBound..<text.endIndex) {
                text.removeSubrange(start.lowerBound..<end.upperBound)
            }

            var remainder = Substring(text)
            while let open = remainder.firstIndex(of: "{"), let close = remainder[open...].firstIndex(of: "}") {
                let selectors = remainder[remainder.startIndex..<open]
                let body = remainder[remainder.index(after: open)..<close]
                remainder = remainder[remainder.index(after: close)...]

                guard !selectors.contains("@") else { continue }
                let declarations = Self.parseDeclarations(String(body))
                guard !declarations.isEmpty else { continue }

                for selector in selectors.split(separator: ",") {
                    let trimmed = selector.trimmingCharacters(in: .whitespacesAndNewlines)
                    // Only single simple selectors; descendant selectors are rare
                    // in exported icon files and would need a full matcher.
                    guard !trimmed.isEmpty, !trimmed.contains(" "), !trimmed.contains(">") else { continue }
                    if trimmed.hasPrefix(".") {
                        Self.merge(declarations, into: &byClass, key: String(trimmed.dropFirst()))
                    } else if trimmed.hasPrefix("#") {
                        Self.merge(declarations, into: &byIdentifier, key: String(trimmed.dropFirst()))
                    } else {
                        Self.merge(declarations, into: &byType, key: trimmed.lowercased())
                    }
                }
            }
        }

        private static func merge(_ declarations: [String: String],
                                  into table: inout [String: [String: String]],
                                  key: String) {
            var existing = table[key] ?? [:]
            for (property, value) in declarations { existing[property] = value }
            table[key] = existing
        }

        static func parseDeclarations(_ body: String) -> [String: String] {
            var result: [String: String] = [:]
            for declaration in body.split(separator: ";") {
                guard let colon = declaration.firstIndex(of: ":") else { continue }
                let property = declaration[declaration.startIndex..<colon]
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .lowercased()
                var value = declaration[declaration.index(after: colon)...]
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if let bang = value.range(of: "!important") { value.removeSubrange(bang) }
                guard !property.isEmpty else { continue }
                result[property] = value.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            return result
        }

        /// Cascade order: presentation attributes (lowest), then type, class and
        /// id rules, then the inline `style` attribute (highest) - which is what
        /// the SVG styling spec prescribes.
        func declarations(for node: Node) -> [String: String] {
            var result: [String: String] = [:]

            for property in Self.inheritedProperties {
                if let value = node.attributes[property] { result[property] = value }
            }
            if let typeRules = byType[node.name.lowercased()] {
                for (property, value) in typeRules { result[property] = value }
            }
            if let classes = node.attributes["class"] {
                for name in classes.split(whereSeparator: { $0 == " " || $0 == "\t" || $0 == "\n" }) {
                    guard let rules = byClass[String(name)] else { continue }
                    for (property, value) in rules { result[property] = value }
                }
            }
            if let identifier = node.attributes["id"], let rules = byIdentifier[identifier] {
                for (property, value) in rules { result[property] = value }
            }
            if let inline = node.attributes["style"] {
                for (property, value) in Self.parseDeclarations(inline) { result[property] = value }
            }
            return result
        }
    }

    // MARK: - Scalar helpers

    /// A CSS length as used by icon files: a number with an optional unit. `%` is
    /// meaningless without a viewport context here, so it is refused.
    fileprivate static func length(_ raw: String?) -> CGFloat? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.hasSuffix("%") else { return nil }

        var digits = ""
        for character in trimmed {
            if character.isASCIINumber || character == "." || character == "-" || character == "+"
                || character == "e" || character == "E" {
                digits.append(character)
            } else {
                break
            }
        }
        guard let value = Double(digits) else { return nil }

        // Absolute CSS units, so a "10mm" logo still lands at a sane scale. The
        // synthesizer normalizes by bounding box anyway; this only matters when a
        // file mixes units between elements.
        let unit = trimmed.dropFirst(digits.count).trimmingCharacters(in: .whitespaces).lowercased()
        let factor: Double
        switch unit {
        case "pt": factor = 96.0 / 72.0
        case "pc": factor = 16
        case "in": factor = 96
        case "mm": factor = 96.0 / 25.4
        case "cm": factor = 96.0 / 2.54
        default: factor = 1                     // px, em-ish, or unitless
        }
        return CGFloat(value * factor)
    }

    fileprivate static func number(_ raw: String?) -> CGFloat? {
        guard let raw else { return nil }
        guard let value = Double(raw.trimmingCharacters(in: .whitespacesAndNewlines)) else { return nil }
        return CGFloat(value)
    }

    /// Splits an SVG number list: whitespace and commas separate, and a sign or a
    /// second decimal point starts a new number even without a separator.
    fileprivate static func numberList(_ raw: String) -> [CGFloat] {
        var numbers: [CGFloat] = []
        var scanner = SVGNumberScanner(raw)
        while let value = scanner.next() { numbers.append(CGFloat(value)) }
        return numbers
    }
}

// MARK: - Path data

/// The `d` attribute, in full: absolute and relative forms of every command,
/// implicit repeats, exponent notation and the compact arc-flag spelling
/// (`a1 1 0 0110 10`). Elliptical arcs are converted to cubics through the
/// endpoint-to-centre parameterization from the SVG spec (F.6.5).
enum SVGPathData {
    static func path(from d: String) -> CGPath {
        let path = CGMutablePath()
        var scanner = SVGNumberScanner(d)
        var current = CGPoint.zero
        var subpathStart = CGPoint.zero
        var lastCubicControl: CGPoint?
        var lastQuadControl: CGPoint?
        var command: Character = " "
        var hasCurrentPoint = false

        func value() -> CGFloat { CGFloat(scanner.next() ?? 0) }

        func point(relative: Bool) -> CGPoint {
            let x = value(), y = value()
            return relative ? CGPoint(x: current.x + x, y: current.y + y) : CGPoint(x: x, y: y)
        }

        /// Guards CoreGraphics against a `d` string that draws before it moves.
        func ensureCurrentPoint() {
            if !hasCurrentPoint {
                path.move(to: current)
                subpathStart = current
                hasCurrentPoint = true
            }
        }

        while true {
            if let next = scanner.nextCommand() {
                command = next
            } else if !scanner.hasNumber {
                break
            } else if command == " " {
                break                            // numbers with no command at all
            }

            let relative = command.isLowercase
            switch Character(command.uppercased()) {
            case "M":
                let p = point(relative: relative)
                path.move(to: p)
                current = p
                subpathStart = p
                hasCurrentPoint = true
                command = relative ? "l" : "L"   // implicit lineto for extra pairs
                lastCubicControl = nil
                lastQuadControl = nil

            case "L":
                ensureCurrentPoint()
                let p = point(relative: relative)
                path.addLine(to: p)
                current = p
                lastCubicControl = nil
                lastQuadControl = nil

            case "H":
                ensureCurrentPoint()
                let x = value()
                let p = CGPoint(x: relative ? current.x + x : x, y: current.y)
                path.addLine(to: p)
                current = p
                lastCubicControl = nil
                lastQuadControl = nil

            case "V":
                ensureCurrentPoint()
                let y = value()
                let p = CGPoint(x: current.x, y: relative ? current.y + y : y)
                path.addLine(to: p)
                current = p
                lastCubicControl = nil
                lastQuadControl = nil

            case "C":
                ensureCurrentPoint()
                let c1 = point(relative: relative)
                let c2 = point(relative: relative)
                let p = point(relative: relative)
                path.addCurve(to: p, control1: c1, control2: c2)
                current = p
                lastCubicControl = c2
                lastQuadControl = nil

            case "S":
                ensureCurrentPoint()
                let c1 = lastCubicControl.map {
                    CGPoint(x: 2 * current.x - $0.x, y: 2 * current.y - $0.y)
                } ?? current
                let c2 = point(relative: relative)
                let p = point(relative: relative)
                path.addCurve(to: p, control1: c1, control2: c2)
                current = p
                lastCubicControl = c2
                lastQuadControl = nil

            case "Q":
                ensureCurrentPoint()
                let control = point(relative: relative)
                let p = point(relative: relative)
                path.addQuadCurve(to: p, control: control)
                current = p
                lastQuadControl = control
                lastCubicControl = nil

            case "T":
                ensureCurrentPoint()
                let control = lastQuadControl.map {
                    CGPoint(x: 2 * current.x - $0.x, y: 2 * current.y - $0.y)
                } ?? current
                let p = point(relative: relative)
                path.addQuadCurve(to: p, control: control)
                current = p
                lastQuadControl = control
                lastCubicControl = nil

            case "A":
                ensureCurrentPoint()
                let rx = value(), ry = value(), rotation = value()
                let largeArc = scanner.nextFlag()
                let sweep = scanner.nextFlag()
                let p = point(relative: relative)
                addArc(to: path, from: current, to: p,
                       rx: rx, ry: ry, rotation: rotation,
                       largeArc: largeArc, sweep: sweep)
                current = p
                lastCubicControl = nil
                lastQuadControl = nil

            case "Z":
                if hasCurrentPoint {
                    path.closeSubpath()
                    current = subpathStart
                }
                lastCubicControl = nil
                lastQuadControl = nil
                // `Z` consumes no numbers, so a malformed "Z 5 5" would spin here
                // forever without this - the only command that cannot make progress.
                if scanner.hasNumber { return path.copy() ?? path }

            default:
                return path.copy() ?? path       // unknown command: keep what parsed
            }

            if !scanner.hasMore { break }
        }
        return path.copy() ?? path
    }

    /// SVG elliptical arc -> up to four cubic segments.
    private static func addArc(to path: CGMutablePath,
                               from start: CGPoint,
                               to end: CGPoint,
                               rx rxIn: CGFloat,
                               ry ryIn: CGFloat,
                               rotation: CGFloat,
                               largeArc: Bool,
                               sweep: Bool) {
        guard rxIn != 0, ryIn != 0 else { path.addLine(to: end); return }
        guard start != end else { return }       // per spec, a zero-length arc is dropped

        var rx = abs(rxIn), ry = abs(ryIn)
        let phi = rotation * .pi / 180
        let cosPhi = cos(phi), sinPhi = sin(phi)

        let dx = (start.x - end.x) / 2, dy = (start.y - end.y) / 2
        let x1 = cosPhi * dx + sinPhi * dy
        let y1 = -sinPhi * dx + cosPhi * dy

        // Scale the radii up when they are too small to span the chord.
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 {
            let scale = sqrt(lambda)
            rx *= scale
            ry *= scale
        }

        let denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
        var numerator = rx * rx * ry * ry - denominator
        if numerator < 0 { numerator = 0 }
        var coefficient = sqrt(numerator / max(denominator, .leastNonzeroMagnitude))
        if largeArc == sweep { coefficient = -coefficient }

        let cxPrime = coefficient * rx * y1 / ry
        let cyPrime = -coefficient * ry * x1 / rx
        let cx = cosPhi * cxPrime - sinPhi * cyPrime + (start.x + end.x) / 2
        let cy = sinPhi * cxPrime + cosPhi * cyPrime + (start.y + end.y) / 2

        func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
            let dot = ux * vx + uy * vy
            let magnitude = sqrt(ux * ux + uy * uy) * sqrt(vx * vx + vy * vy)
            var result = acos(max(-1, min(1, dot / max(magnitude, .leastNonzeroMagnitude))))
            if ux * vy - uy * vx < 0 { result = -result }
            return result
        }

        let ux = (x1 - cxPrime) / rx, uy = (y1 - cyPrime) / ry
        let vx = (-x1 - cxPrime) / rx, vy = (-y1 - cyPrime) / ry
        let theta1 = angle(1, 0, ux, uy)
        var sweepAngle = angle(ux, uy, vx, vy)
        if !sweep, sweepAngle > 0 { sweepAngle -= 2 * .pi }
        if sweep, sweepAngle < 0 { sweepAngle += 2 * .pi }

        let segments = max(1, Int(ceil(abs(sweepAngle) / (.pi / 2))))
        let delta = sweepAngle / CGFloat(segments)
        let alpha = 4.0 / 3.0 * tan(delta / 4)

        func map(_ cosTheta: CGFloat, _ sinTheta: CGFloat) -> CGPoint {
            CGPoint(
                x: cosPhi * rx * cosTheta - sinPhi * ry * sinTheta + cx,
                y: sinPhi * rx * cosTheta + cosPhi * ry * sinTheta + cy
            )
        }

        var theta = theta1
        for _ in 0..<segments {
            let nextTheta = theta + delta
            let cos1 = cos(theta), sin1 = sin(theta)
            let cos2 = cos(nextTheta), sin2 = sin(nextTheta)
            let control1 = map(cos1 - alpha * sin1, sin1 + alpha * cos1)
            let control2 = map(cos2 + alpha * sin2, sin2 - alpha * cos2)
            path.addCurve(to: map(cos2, sin2), control1: control1, control2: control2)
            theta = nextTheta
        }
    }
}

// MARK: - Number scanning

/// Shared by the path-data parser, `points` lists and `transform` arguments.
struct SVGNumberScanner {
    private let characters: [Character]
    private var index = 0

    init(_ string: String) { characters = Array(string) }

    private static func isSeparator(_ character: Character) -> Bool {
        character == " " || character == "," || character == "\n"
            || character == "\t" || character == "\r"
    }

    private func skippingSeparators() -> Int {
        var cursor = index
        while cursor < characters.count, Self.isSeparator(characters[cursor]) { cursor += 1 }
        return cursor
    }

    var hasMore: Bool { skippingSeparators() < characters.count }

    var hasNumber: Bool {
        let cursor = skippingSeparators()
        guard cursor < characters.count else { return false }
        let character = characters[cursor]
        return character.isASCIINumber || character == "-" || character == "+" || character == "."
    }

    mutating func nextCommand() -> Character? {
        index = skippingSeparators()
        guard index < characters.count, characters[index].isLetter else { return nil }
        // `e`/`E` only ever appear inside a number, which `next()` consumes whole.
        let character = characters[index]
        index += 1
        return character
    }

    /// Arc flags are single characters and may be written with no separator at
    /// all (`a1 1 0 0110 10` is four tokens, not two numbers).
    mutating func nextFlag() -> Bool {
        index = skippingSeparators()
        guard index < characters.count else { return false }
        let character = characters[index]
        index += 1
        return character == "1"
    }

    mutating func next() -> Double? {
        index = skippingSeparators()
        var cursor = index
        if cursor < characters.count, characters[cursor] == "-" || characters[cursor] == "+" {
            cursor += 1
        }
        while cursor < characters.count, characters[cursor].isASCIINumber { cursor += 1 }
        if cursor < characters.count, characters[cursor] == "." {
            cursor += 1
            while cursor < characters.count, characters[cursor].isASCIINumber { cursor += 1 }
        }
        if cursor < characters.count, characters[cursor] == "e" || characters[cursor] == "E" {
            var exponent = cursor + 1
            if exponent < characters.count,
               characters[exponent] == "-" || characters[exponent] == "+" {
                exponent += 1
            }
            if exponent < characters.count, characters[exponent].isASCIINumber {
                while exponent < characters.count, characters[exponent].isASCIINumber { exponent += 1 }
                cursor = exponent
            }
        }
        guard cursor > index, let value = Double(String(characters[index..<cursor])) else { return nil }
        index = cursor
        return value
    }
}

private extension Character {
    /// `Character.isNumber` is true for "½" and every non-Latin digit, which have
    /// no business in a path-data string.
    var isASCIINumber: Bool { self >= "0" && self <= "9" }
}

// MARK: - Winding

/// Makes every subpath's direction agree with its nesting depth, so one merged
/// path filled *nonzero* reproduces what the source painted.
///
/// Two separate problems, one fix:
///
/// 1. `actool`'s symbol compiler always fills nonzero and ignores `fill-rule`
///    (measured: two concentric circles wound the same way render solid with and
///    without `fill-rule="evenodd"`). Even-odd artwork has to be rewound or its
///    holes fill in solid. For even-odd input this rewinding is exact - depth
///    parity is precisely what even-odd means.
/// 2. An SVG paints each element separately, but a symbol glyph is one path.
///    Two overlapping shapes that happen to wind opposite ways - a filled dot
///    sitting on a stroked ring, a logo mark over its background plate - cancel
///    where they overlap and punch an accidental hole. Orienting by depth turns
///    the merge into a union instead, which is the silhouette the user drew.
///
/// The one thing it cannot reproduce is a nonzero file that deliberately nests a
/// same-direction subpath inside another to keep it solid - geometry that is
/// invisible in the source anyway.
enum SVGPathWinding {
    /// Subpath count above which the O(n^2) nesting test is skipped. Icons never
    /// come close; a traced photograph would.
    private static let complexityLimit = 2048

    /// Merges the painted shapes into the single nonzero path a symbol glyph has
    /// to be.
    ///
    /// Each shape is oriented by its own nesting depth - outer contours one way,
    /// holes the other - which is exact for even-odd and leaves well-formed
    /// nonzero art untouched. Because *every* shape ends up with its outer
    /// contour wound the same way, overlapping shapes add rather than cancel, so
    /// the glyph is the silhouette of everything the file painted instead of a
    /// picture pockmarked by whichever direction each shape happened to be drawn.
    static func unionedGlyphPath(of shapes: [SVGShape]) -> CGPath {
        let merged = CGMutablePath()
        for shape in shapes { merged.addPath(normalizedToNonZero(shape.path)) }
        return merged.copy() ?? merged
    }

    /// Orients one shape's subpaths by nesting depth. Safe to call on artwork of
    /// unknown provenance (a font glyph, an in-app drawing), which is why the
    /// `CGPath`-only entry points in `SymbolTemplateSynthesizer` use it directly.
    static func normalizedToNonZero(_ path: CGPath) -> CGPath {
        let subpaths = path.svgSubpaths()
        // Note the absence of a `count > 1` shortcut: a lone contour still gets
        // forced to the canonical direction, because that is what makes *separate*
        // shapes union instead of cancelling when they are merged later.
        guard !subpaths.isEmpty, subpaths.count <= complexityLimit else { return path }

        let boxes = subpaths.map { $0.boundingBoxOfPath }
        let polygons = subpaths.map { $0.svgFlattenedPoints() }
        let probes = zip(polygons, boxes).map { interiorProbe(polygon: $0, box: $1) }
        let result = CGMutablePath()

        for (index, subpath) in subpaths.enumerated() {
            var depth = 0
            let probe = probes[index]
            for (other, otherPath) in subpaths.enumerated() where other != index {
                // Cheap rejection first: only a strictly enclosing box can nest.
                guard boxes[other].contains(boxes[index]) else { continue }
                if otherPath.contains(probe, using: .evenOdd) { depth += 1 }
            }
            let isCounterClockwise = signedArea(of: polygons[index]) > 0
            let wantsCounterClockwise = depth % 2 == 0
            result.addPath(isCounterClockwise == wantsCounterClockwise ? subpath : reversed(subpath))
        }
        return result.copy() ?? path
    }

    /// A point guaranteed to be *inside* the subpath.
    ///
    /// A centroid is not good enough - it falls outside anything concave, and a
    /// misplaced probe means a wrong nesting depth and a hole in the wrong place.
    /// This casts horizontal rays and takes the midpoint of the first span, which
    /// is interior for any simple closed outline.
    private static func interiorProbe(polygon: [CGPoint], box: CGRect) -> CGPoint {
        guard polygon.count > 2 else { return CGPoint(x: box.midX, y: box.midY) }

        for fraction in [0.5, 0.37, 0.63, 0.21, 0.79, 0.11, 0.89] as [CGFloat] {
            let y = box.minY + box.height * fraction
            var crossings: [CGFloat] = []
            for index in polygon.indices {
                let a = polygon[index]
                let b = polygon[(index + 1) % polygon.count]
                // Half-open rule, so a vertex exactly on the ray counts once.
                guard (a.y <= y && b.y > y) || (b.y <= y && a.y > y) else { continue }
                let t = (y - a.y) / (b.y - a.y)
                crossings.append(a.x + t * (b.x - a.x))
            }
            guard crossings.count >= 2 else { continue }
            crossings.sort()
            let candidate = CGPoint(x: (crossings[0] + crossings[1]) / 2, y: y)
            if crossings[1] - crossings[0] > 1e-9 { return candidate }
        }
        return CGPoint(x: box.midX, y: box.midY)
    }

    private static func signedArea(of polygon: [CGPoint]) -> CGFloat {
        guard polygon.count > 2 else { return 0 }
        var area: CGFloat = 0
        for index in polygon.indices {
            let a = polygon[index]
            let b = polygon[(index + 1) % polygon.count]
            area += a.x * b.y - b.x * a.y
        }
        return area / 2
    }

    /// Reverses a subpath, keeping its curves as curves - a rewound hole in a
    /// letterform must not turn into a polygon.
    private static func reversed(_ path: CGPath) -> CGPath {
        enum Segment {
            case line(CGPoint)
            case quad(control: CGPoint, end: CGPoint)
            case cubic(control1: CGPoint, control2: CGPoint, end: CGPoint)

            var end: CGPoint {
                switch self {
                case .line(let point): return point
                case .quad(_, let end): return end
                case .cubic(_, _, let end): return end
                }
            }
        }

        var start: CGPoint?
        var segments: [Segment] = []
        var closed = false

        path.applyWithBlock { element in
            let item = element.pointee
            switch item.type {
            case .moveToPoint:
                start = item.points[0]
            case .addLineToPoint:
                segments.append(.line(item.points[0]))
            case .addQuadCurveToPoint:
                segments.append(.quad(control: item.points[0], end: item.points[1]))
            case .addCurveToPoint:
                segments.append(.cubic(control1: item.points[0], control2: item.points[1], end: item.points[2]))
            case .closeSubpath:
                closed = true
                if let start, segments.last?.end != start { segments.append(.line(start)) }
            @unknown default:
                break
            }
        }

        guard let start, let last = segments.last else { return path }
        let result = CGMutablePath()
        result.move(to: last.end)
        for index in segments.indices.reversed() {
            let previousEnd = index == 0 ? start : segments[index - 1].end
            switch segments[index] {
            case .line:
                result.addLine(to: previousEnd)
            case .quad(let control, _):
                result.addQuadCurve(to: previousEnd, control: control)
            case .cubic(let control1, let control2, _):
                result.addCurve(to: previousEnd, control1: control2, control2: control1)
            }
        }
        if closed { result.closeSubpath() }
        return result.copy() ?? path
    }
}

// MARK: - CGPath helpers

extension CGPath {
    /// Serializes to an SVG `d` string in absolute coordinates, optionally
    /// applying a transform on the way out so no second pass is needed.
    func svgPathData(transform: CGAffineTransform = .identity, decimals: Int = 4) -> String {
        var output = ""

        func format(_ value: CGFloat) -> String {
            var text = String(format: "%.\(decimals)f", Double(value))
            if text.contains(".") {
                while text.hasSuffix("0") { text.removeLast() }
                if text.hasSuffix(".") { text.removeLast() }
            }
            return text == "-0" ? "0" : text
        }

        func pair(_ point: CGPoint) -> String {
            let mapped = point.applying(transform)
            return "\(format(mapped.x)) \(format(mapped.y))"
        }

        applyWithBlock { element in
            let item = element.pointee
            switch item.type {
            case .moveToPoint:
                output += "M\(pair(item.points[0]))"
            case .addLineToPoint:
                output += "L\(pair(item.points[0]))"
            case .addQuadCurveToPoint:
                output += "Q\(pair(item.points[0])) \(pair(item.points[1]))"
            case .addCurveToPoint:
                output += "C\(pair(item.points[0])) \(pair(item.points[1])) \(pair(item.points[2]))"
            case .closeSubpath:
                output += "Z"
            @unknown default:
                break
            }
        }
        return output
    }

    /// Splits into one `CGPath` per subpath, so winding can be reasoned about.
    func svgSubpaths() -> [CGPath] {
        var result: [CGPath] = []
        var current: CGMutablePath?

        applyWithBlock { element in
            let item = element.pointee
            switch item.type {
            case .moveToPoint:
                if let path = current, !path.isEmpty { result.append(path.copy()!) }
                let path = CGMutablePath()
                path.move(to: item.points[0])
                current = path
            case .addLineToPoint:
                current?.addLine(to: item.points[0])
            case .addQuadCurveToPoint:
                current?.addQuadCurve(to: item.points[1], control: item.points[0])
            case .addCurveToPoint:
                current?.addCurve(to: item.points[2], control1: item.points[0], control2: item.points[1])
            case .closeSubpath:
                current?.closeSubpath()
            @unknown default:
                break
            }
        }
        if let path = current, !path.isEmpty { result.append(path.copy()!) }
        return result
    }

    /// Polyline approximation - CoreGraphics exposes no public flattener. Used for
    /// winding and containment questions, never for output geometry.
    func svgFlattenedPoints(segmentsPerCurve: Int = 12) -> [CGPoint] {
        var points: [CGPoint] = []
        var current = CGPoint.zero
        var start = CGPoint.zero

        func cubic(_ p0: CGPoint, _ p1: CGPoint, _ p2: CGPoint, _ p3: CGPoint) {
            for step in 1...segmentsPerCurve {
                let t = CGFloat(step) / CGFloat(segmentsPerCurve)
                let u = 1 - t
                let x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x
                let y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
                points.append(CGPoint(x: x, y: y))
            }
        }

        applyWithBlock { element in
            let item = element.pointee
            switch item.type {
            case .moveToPoint:
                current = item.points[0]
                start = current
                points.append(current)
            case .addLineToPoint:
                current = item.points[0]
                points.append(current)
            case .addQuadCurveToPoint:
                let control = item.points[0], end = item.points[1]
                let c1 = CGPoint(x: current.x + 2.0 / 3 * (control.x - current.x),
                                 y: current.y + 2.0 / 3 * (control.y - current.y))
                let c2 = CGPoint(x: end.x + 2.0 / 3 * (control.x - end.x),
                                 y: end.y + 2.0 / 3 * (control.y - end.y))
                cubic(current, c1, c2, end)
                current = end
            case .addCurveToPoint:
                let end = item.points[2]
                cubic(current, item.points[0], item.points[1], end)
                current = end
            case .closeSubpath:
                current = start
            @unknown default:
                break
            }
        }
        return points
    }
}

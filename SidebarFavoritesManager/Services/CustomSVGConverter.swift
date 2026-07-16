import AppKit
import Foundation

/// Converts a regular vector SVG into the SF Symbols template used by Finder favorites.
enum CustomSVGConverter {
    enum ConversionError: LocalizedError {
        case invalidSVG
        case unsupportedContent(String)
        case noArtwork
        case missingTemplate
        case couldNotMeasure

        var errorDescription: String? {
            switch self {
            case .invalidSVG:
                return "The selected file is not a valid SVG."
            case .unsupportedContent(let content):
                return "This SVG contains unsupported \(content). Convert it to vector paths first."
            case .noArtwork:
                return "No visible vector paths or shapes were found in this SVG."
            case .missingTemplate:
                return "The bundled custom symbol template could not be loaded."
            case .couldNotMeasure:
                return "The SVG artwork could not be measured."
            }
        }
    }

    private struct Matrix {
        var a: CGFloat = 1
        var b: CGFloat = 0
        var c: CGFloat = 0
        var d: CGFloat = 1
        var tx: CGFloat = 0
        var ty: CGFloat = 0

        func multiplied(by other: Matrix) -> Matrix {
            Matrix(
                a: a * other.a + c * other.b,
                b: b * other.a + d * other.b,
                c: a * other.c + c * other.d,
                d: b * other.c + d * other.d,
                tx: a * other.tx + c * other.ty + tx,
                ty: b * other.tx + d * other.ty + ty
            )
        }

        static func translation(_ x: CGFloat, _ y: CGFloat) -> Matrix {
            Matrix(tx: x, ty: y)
        }

        static func scale(_ x: CGFloat, _ y: CGFloat) -> Matrix {
            Matrix(a: x, d: y)
        }

        static func rotation(_ radians: CGFloat) -> Matrix {
            Matrix(a: cos(radians), b: sin(radians), c: -sin(radians), d: cos(radians))
        }

        var svgValue: String {
            [a, b, c, d, tx, ty]
                .map { String(format: "%.6f", Double($0)) }
                .joined(separator: " ")
        }
    }

    private struct ArtworkElement {
        let element: XMLElement
        let transform: Matrix
    }

    private static let graphicNames = Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line"])
    private static let skippedContainers = Set(["defs", "clippath", "mask", "metadata", "title", "desc", "style"])
    private static let geometryAttributes = Set(["d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "points"])
    private static let styleNames = [
        "fill", "fill-opacity", "fill-rule", "stroke", "stroke-opacity", "stroke-width",
        "stroke-linecap", "stroke-linejoin", "display", "visibility", "opacity"
    ]
    private static let variants: [(id: String, centerX: CGFloat)] = [
        ("Black-S", 2933.4),
        ("Regular-S", 1449.845),
        ("Ultralight-S", 559.711)
    ]

    static func convert(sourceURL: URL, templateURL: URL, symbolName: String) throws -> String {
        let sourceData = try Data(contentsOf: sourceURL)
        let sourceText = String(data: sourceData, encoding: .utf8) ?? ""
        try validateSafety(sourceText)

        let sourceDocument: XMLDocument
        do {
            sourceDocument = try XMLDocument(data: sourceData, options: [.nodeLoadExternalEntitiesNever])
        } catch {
            throw ConversionError.invalidSVG
        }
        guard let root = sourceDocument.rootElement(), root.localName?.lowercased() == "svg" else {
            throw ConversionError.invalidSVG
        }

        let sourceBox = try viewBox(of: root)
        let artworkBox = try visibleArtworkBounds(data: sourceData, viewBox: sourceBox)
        var artwork: [ArtworkElement] = []
        collectArtwork(from: root, parentTransform: Matrix(), inheritedStyle: [:], output: &artwork)
        guard !artwork.isEmpty else { throw ConversionError.noArtwork }

        let templateData: Data
        do {
            templateData = try Data(contentsOf: templateURL)
        } catch {
            throw ConversionError.missingTemplate
        }
        let templateDocument: XMLDocument
        do {
            templateDocument = try XMLDocument(data: templateData, options: [.nodeLoadExternalEntitiesNever])
        } catch {
            throw ConversionError.missingTemplate
        }
        guard let symbols = try templateDocument.nodes(forXPath: "//*[@id='Symbols']").first as? XMLElement else {
            throw ConversionError.missingTemplate
        }

        while symbols.childCount > 0 { symbols.removeChild(at: 0) }
        let scale = min(108 / artworkBox.width, 70.459 / artworkBox.height)
        let centerY: CGFloat = 660.7705

        for variant in variants {
            let group = XMLElement(name: "g")
            group.addAttribute(XMLNode.attribute(withName: "id", stringValue: variant.id) as! XMLNode)
            let placement = Matrix.translation(
                variant.centerX - scale * artworkBox.midX,
                centerY - scale * artworkBox.midY
            ).multiplied(by: .scale(scale, scale))

            for item in artwork {
                guard let element = item.element.copy() as? XMLElement else { continue }
                let transform = placement.multiplied(by: item.transform)
                element.addAttribute(XMLNode.attribute(withName: "transform", stringValue: "matrix(\(transform.svgValue))") as! XMLNode)
                group.addChild(element)
            }
            symbols.addChild(group)
            // SVGThumbnailView includes one character after </g>; keep it harmless whitespace.
            symbols.addChild(XMLNode.text(withStringValue: "\n  ") as! XMLNode)
        }

        if let descriptiveName = try templateDocument.nodes(forXPath: "//*[@id='descriptive-name']").first as? XMLElement {
            while descriptiveName.childCount > 0 { descriptiveName.removeChild(at: 0) }
            let tspan = XMLElement(name: "tspan")
            tspan.stringValue = sanitizedSymbolName(symbolName)
            descriptiveName.addChild(tspan)
        }

        return templateDocument.xmlString(options: [.nodePrettyPrint])
    }

    private static func validateSafety(_ source: String) throws {
        let lowercased = source.lowercased()
        let unsupported: [(String, String)] = [
            ("<script", "scripts"),
            ("<foreignobject", "embedded HTML"),
            ("<image", "raster images"),
            ("<text", "live text"),
            ("<use", "reusable SVG instances"),
            ("<!doctype", "external document declarations")
        ]
        if let match = unsupported.first(where: { lowercased.contains($0.0) }) {
            throw ConversionError.unsupportedContent(match.1)
        }
        if lowercased.range(of: #"(?:href|xlink:href)\s*=\s*["'](?:https?:|data:|//)"#, options: .regularExpression) != nil {
            throw ConversionError.unsupportedContent("external resources")
        }
    }

    private static func viewBox(of root: XMLElement) throws -> CGRect {
        if let value = root.attribute(forName: "viewBox")?.stringValue {
            let numbers = parseNumbers(value)
            if numbers.count == 4, numbers[2] > 0, numbers[3] > 0 {
                return CGRect(x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3])
            }
        }
        let width = root.attribute(forName: "width")?.stringValue.flatMap { parseNumbers($0).first }
        let height = root.attribute(forName: "height")?.stringValue.flatMap { parseNumbers($0).first }
        guard let width, let height, width > 0, height > 0 else { throw ConversionError.invalidSVG }
        return CGRect(x: 0, y: 0, width: width, height: height)
    }

    private static func visibleArtworkBounds(data: Data, viewBox: CGRect) throws -> CGRect {
        guard let image = NSImage(data: data) else { throw ConversionError.couldNotMeasure }
        let rasterScale = min(1024 / max(viewBox.width, viewBox.height), 8)
        let width = max(1, Int(ceil(viewBox.width * rasterScale)))
        let height = max(1, Int(ceil(viewBox.height * rasterScale)))
        guard let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: width,
            pixelsHigh: height,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bitmapFormat: [],
            bytesPerRow: 0,
            bitsPerPixel: 0
        ), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
            throw ConversionError.couldNotMeasure
        }

        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        context.cgContext.clear(CGRect(x: 0, y: 0, width: width, height: height))
        image.draw(in: CGRect(x: 0, y: 0, width: width, height: height), from: .zero, operation: .sourceOver, fraction: 1)
        context.flushGraphics()
        NSGraphicsContext.restoreGraphicsState()

        var minX = width
        var minY = height
        var maxX = -1
        var maxY = -1
        for y in 0..<height {
            for x in 0..<width where (bitmap.colorAt(x: x, y: y)?.alphaComponent ?? 0) > 0.01 {
                minX = min(minX, x)
                minY = min(minY, y)
                maxX = max(maxX, x)
                maxY = max(maxY, y)
            }
        }
        guard maxX >= minX, maxY >= minY else { throw ConversionError.noArtwork }

        let x1 = viewBox.minX + CGFloat(minX) / CGFloat(width) * viewBox.width
        let x2 = viewBox.minX + CGFloat(maxX + 1) / CGFloat(width) * viewBox.width
        let y1 = viewBox.minY + CGFloat(height - maxY - 1) / CGFloat(height) * viewBox.height
        let y2 = viewBox.minY + CGFloat(height - minY) / CGFloat(height) * viewBox.height
        return CGRect(x: x1, y: y1, width: x2 - x1, height: y2 - y1)
    }

    private static func collectArtwork(
        from element: XMLElement,
        parentTransform: Matrix,
        inheritedStyle: [String: String],
        output: inout [ArtworkElement]
    ) {
        let name = (element.localName ?? element.name ?? "").lowercased()
        if skippedContainers.contains(name) { return }

        var style = inheritedStyle
        for key in styleNames {
            if let value = element.attribute(forName: key)?.stringValue { style[key] = value }
        }
        if let inlineStyle = element.attribute(forName: "style")?.stringValue {
            for declaration in inlineStyle.split(separator: ";") {
                let pair = declaration.split(separator: ":", maxSplits: 1).map(String.init)
                if pair.count == 2 { style[pair[0].trimmingCharacters(in: .whitespaces)] = pair[1].trimmingCharacters(in: .whitespaces) }
            }
        }
        if style["display"] == "none" || style["visibility"] == "hidden"
            || (style["opacity"].map { number($0) == 0 } ?? false) { return }

        let localTransform = parseTransform(element.attribute(forName: "transform")?.stringValue ?? "")
        let transform = parentTransform.multiplied(by: localTransform)
        if graphicNames.contains(name), let clean = cleanElement(element, style: style) {
            output.append(ArtworkElement(element: clean, transform: transform))
        }
        for child in element.children ?? [] {
            if let child = child as? XMLElement {
                collectArtwork(from: child, parentTransform: transform, inheritedStyle: style, output: &output)
            }
        }
    }

    private static func cleanElement(_ source: XMLElement, style: [String: String]) -> XMLElement? {
        let name = source.localName ?? source.name ?? "path"
        let element = XMLElement(name: name)
        for attribute in source.attributes ?? [] where geometryAttributes.contains(attribute.name ?? "") {
            element.addAttribute(attribute.copy() as! XMLNode)
        }

        let fillVisible = style["fill"]?.lowercased() != "none"
            && style["fill"]?.lowercased() != "transparent"
            && number(style["fill-opacity"], fallback: 1) > 0
        let strokeValue = style["stroke"]?.lowercased() ?? "none"
        let strokeVisible = strokeValue != "none" && strokeValue != "transparent"
            && number(style["stroke-opacity"], fallback: 1) > 0
        guard fillVisible || strokeVisible else { return nil }

        element.addAttribute(XMLNode.attribute(withName: "fill", stringValue: fillVisible ? "#000" : "none") as! XMLNode)
        element.addAttribute(XMLNode.attribute(withName: "stroke", stringValue: strokeVisible ? "#000" : "none") as! XMLNode)
        for key in ["fill-rule", "stroke-width", "stroke-linecap", "stroke-linejoin"] {
            if let value = style[key] {
                element.addAttribute(XMLNode.attribute(withName: key, stringValue: value) as! XMLNode)
            }
        }
        return element
    }

    private static func parseTransform(_ value: String) -> Matrix {
        guard let regex = try? NSRegularExpression(pattern: #"([A-Za-z]+)\s*\(([^)]*)\)"#) else { return Matrix() }
        let matches = regex.matches(in: value, range: NSRange(value.startIndex..., in: value))
        return matches.reduce(Matrix()) { result, match in
            guard let nameRange = Range(match.range(at: 1), in: value),
                  let valuesRange = Range(match.range(at: 2), in: value) else { return result }
            let name = value[nameRange].lowercased()
            let values = parseNumbers(String(value[valuesRange]))
            let transform: Matrix
            switch name {
            case "matrix" where values.count == 6:
                transform = Matrix(a: values[0], b: values[1], c: values[2], d: values[3], tx: values[4], ty: values[5])
            case "translate" where !values.isEmpty:
                transform = .translation(values[0], values.count > 1 ? values[1] : 0)
            case "scale" where !values.isEmpty:
                transform = .scale(values[0], values.count > 1 ? values[1] : values[0])
            case "rotate" where !values.isEmpty:
                let rotation = Matrix.rotation(values[0] * .pi / 180)
                if values.count >= 3 {
                    transform = Matrix.translation(values[1], values[2])
                        .multiplied(by: rotation)
                        .multiplied(by: .translation(-values[1], -values[2]))
                } else {
                    transform = rotation
                }
            case "skewx" where !values.isEmpty:
                transform = Matrix(c: tan(values[0] * .pi / 180))
            case "skewy" where !values.isEmpty:
                transform = Matrix(b: tan(values[0] * .pi / 180))
            default:
                transform = Matrix()
            }
            return result.multiplied(by: transform)
        }
    }

    private static func parseNumbers(_ value: String) -> [CGFloat] {
        guard let regex = try? NSRegularExpression(pattern: #"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?"#) else { return [] }
        return regex.matches(in: value, range: NSRange(value.startIndex..., in: value)).compactMap { match in
            guard let range = Range(match.range, in: value), let number = Double(value[range]) else { return nil }
            return CGFloat(number)
        }
    }

    private static func number(_ value: String?, fallback: CGFloat = 0) -> CGFloat {
        guard let value, let number = Double(value) else { return fallback }
        return CGFloat(number)
    }

    private static func sanitizedSymbolName(_ name: String) -> String {
        let cleaned = name.lowercased()
            .replacingOccurrences(of: #"[^a-z0-9._-]+"#, with: ".", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))
        return cleaned.isEmpty ? "custom.symbol" : cleaned
    }
}

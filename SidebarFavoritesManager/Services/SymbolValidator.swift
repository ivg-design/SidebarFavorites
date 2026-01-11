import Foundation
import AppKit

/// Validates SF Symbol SVG files for correct structure
struct SymbolValidator {

    /// Validation result
    struct ValidationResult {
        var isValid: Bool
        var errors: [ValidationError]
        var warnings: [String]

        static var success: ValidationResult {
            ValidationResult(isValid: true, errors: [], warnings: [])
        }
    }

    /// Validation error types
    enum ValidationError: LocalizedError, Equatable {
        case fileNotReadable
        case missingSymbolsLayer
        case missingGuidesLayer
        case missingTemplateVersion
        case invalidTemplateVersion(String)
        case missingRegularVariant
        case missingUltralightVariant
        case missingBlackVariant

        var errorDescription: String? {
            switch self {
            case .fileNotReadable:
                return "Could not read the SVG file"
            case .missingSymbolsLayer:
                return "Missing 'Symbols' layer (id=\"Symbols\")"
            case .missingGuidesLayer:
                return "Missing 'Guides' layer (id=\"Guides\")"
            case .missingTemplateVersion:
                return "Missing template version text element (id=\"template-version\")"
            case .invalidTemplateVersion(let value):
                return "Invalid template version: '\(value)' (expected 'Template v.X.X')"
            case .missingRegularVariant:
                return "Missing Regular-S weight variant"
            case .missingUltralightVariant:
                return "Missing Ultralight-S weight variant"
            case .missingBlackVariant:
                return "Missing Black-S weight variant"
            }
        }
    }

    /// Validate an SF Symbol SVG file
    static func validate(at url: URL) -> ValidationResult {
        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            return ValidationResult(isValid: false, errors: [.fileNotReadable], warnings: [])
        }

        return validate(content: content)
    }

    /// Validate SVG content string
    static func validate(content: String) -> ValidationResult {
        var errors: [ValidationError] = []
        var warnings: [String] = []

        // Check for Symbols layer
        if !content.contains("id=\"Symbols\"") {
            errors.append(.missingSymbolsLayer)
        }

        // Check for Guides layer
        if !content.contains("id=\"Guides\"") {
            errors.append(.missingGuidesLayer)
        }

        // Check for template version
        if !content.contains("id=\"template-version\"") {
            errors.append(.missingTemplateVersion)
        } else {
            // Validate template version format
            if let versionMatch = content.range(of: "Template v\\.[0-9]+\\.[0-9]+", options: .regularExpression) {
                let version = String(content[versionMatch])
                if version != "Template v.6.0" && version != "Template v.5.0" && version != "Template v.4.0" {
                    warnings.append("Using template version \(version), recommended version is 6.0")
                }
            } else if content.contains("id=\"template-version\"") {
                // Has the element but bad format
                errors.append(.invalidTemplateVersion("format not recognized"))
            }
        }

        // Check for weight variants
        if !content.contains("id=\"Regular-S\"") {
            errors.append(.missingRegularVariant)
        }

        if !content.contains("id=\"Ultralight-S\"") {
            warnings.append("Missing Ultralight-S variant (optional but recommended)")
        }

        if !content.contains("id=\"Black-S\"") {
            warnings.append("Missing Black-S variant (optional but recommended)")
        }

        return ValidationResult(
            isValid: errors.isEmpty,
            errors: errors,
            warnings: warnings
        )
    }

    /// Import a custom symbol SVG to the Icons directory
    static func importSymbol(from sourceURL: URL, named name: String) throws -> String {
        let configManager = ConfigManager.shared
        let relativePath = "\(name).svg"
        let destinationURL = configManager.iconsDirectoryURL.appendingPathComponent(relativePath)

        // Validate first
        let result = validate(at: sourceURL)
        guard result.isValid else {
            throw ImportError.validationFailed(result.errors)
        }

        // Copy to Icons directory
        if FileManager.default.fileExists(atPath: destinationURL.path) {
            try FileManager.default.removeItem(at: destinationURL)
        }
        try FileManager.default.copyItem(at: sourceURL, to: destinationURL)

        return relativePath
    }

    enum ImportError: LocalizedError {
        case validationFailed([ValidationError])

        var errorDescription: String? {
            switch self {
            case .validationFailed(let errors):
                return "Symbol validation failed: " + errors.compactMap { $0.errorDescription }.joined(separator: ", ")
            }
        }
    }

    /// Extract and render a preview image from an SF Symbol SVG
    /// Returns an NSImage that can be displayed in the UI
    static func renderPreview(from url: URL, size: CGFloat = 24) -> NSImage? {
        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            return nil
        }

        // Find the Symbols group and extract the first complete path element
        guard let symbolsStart = content.range(of: "<g id=\"Symbols\">"),
              let firstPathStart = content.range(of: "<path", range: symbolsStart.upperBound..<content.endIndex),
              let pathEnd = content.range(of: "/>", range: firstPathStart.lowerBound..<content.endIndex) else {
            return nil
        }

        // Extract the full path element
        let pathElement = String(content[firstPathStart.lowerBound...pathEnd.lowerBound]) + "/>"

        // Extract the d attribute
        guard let dStart = pathElement.range(of: "d=\""),
              let dEnd = pathElement.range(of: "\"", range: dStart.upperBound..<pathElement.endIndex) else {
            return nil
        }
        let pathData = String(pathElement[dStart.upperBound..<dEnd.lowerBound])

        // Parse the path to find bounding box
        let bounds = getPathBounds(pathData)

        // Render path to image
        return renderPathToImage(pathData: pathData, bounds: bounds, size: size)
    }

    /// Render preview returning CGImage for SwiftUI compatibility
    static func renderPreviewCG(from url: URL, size: CGFloat = 24) -> CGImage? {
        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            return nil
        }

        // Find the Symbols group and extract the first complete path element
        guard let symbolsStart = content.range(of: "<g id=\"Symbols\">"),
              let firstPathStart = content.range(of: "<path", range: symbolsStart.upperBound..<content.endIndex),
              let pathEnd = content.range(of: "/>", range: firstPathStart.lowerBound..<content.endIndex) else {
            return nil
        }

        // Extract the full path element
        let pathElement = String(content[firstPathStart.lowerBound...pathEnd.lowerBound]) + "/>"

        // Extract the d attribute
        guard let dStart = pathElement.range(of: "d=\""),
              let dEnd = pathElement.range(of: "\"", range: dStart.upperBound..<pathElement.endIndex) else {
            return nil
        }
        let pathData = String(pathElement[dStart.upperBound..<dEnd.lowerBound])

        // Parse the path to find bounding box
        let bounds = getPathBounds(pathData)

        // Render to CGImage
        return renderPathToCGImage(pathData: pathData, bounds: bounds, size: size)
    }

    /// Render SVG path to CGImage
    private static func renderPathToCGImage(pathData: String, bounds: CGRect, size: CGFloat) -> CGImage? {
        let intSize = Int(size)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil,
            width: intSize,
            height: intSize,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }

        // Fill background
        context.setFillColor(CGColor(gray: 0.9, alpha: 1.0))
        context.fill(CGRect(x: 0, y: 0, width: intSize, height: intSize))

        // Draw directly without complex transforms - just scale path to fit
        let cgPath = CGMutablePath()
        parseSVGPathToCGPath(pathData, into: cgPath)

        // Get path bounds and scale to fit
        let pathBounds = cgPath.boundingBox
        if !pathBounds.isEmpty && pathBounds.width > 0 && pathBounds.height > 0 {
            let scale = min(size / pathBounds.width, size / pathBounds.height) * 0.8
            var transform = CGAffineTransform.identity
            transform = transform.translatedBy(x: size / 2, y: size / 2)
            transform = transform.scaledBy(x: scale, y: scale)
            transform = transform.translatedBy(x: -pathBounds.midX, y: -pathBounds.midY)

            if let transformedPath = cgPath.copy(using: &transform) {
                context.addPath(transformedPath)
                context.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1))
                context.fillPath()
            }
        } else {
            // Path is empty - draw red X as debug indicator
            context.setStrokeColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
            context.setLineWidth(2)
            context.move(to: CGPoint(x: 0, y: 0))
            context.addLine(to: CGPoint(x: intSize, y: intSize))
            context.move(to: CGPoint(x: intSize, y: 0))
            context.addLine(to: CGPoint(x: 0, y: intSize))
            context.strokePath()
        }

        return context.makeImage()
    }

    /// Parse SVG path data into CGMutablePath
    private static func parseSVGPathToCGPath(_ pathData: String, into path: CGMutablePath) {
        var currentPoint = CGPoint.zero
        var index = pathData.startIndex

        while index < pathData.endIndex {
            let char = pathData[index]

            switch char {
            case "M", "m":
                index = pathData.index(after: index)
                if let (point, nextIndex) = parsePoint(from: pathData, startingAt: index) {
                    currentPoint = char == "M" ? point : CGPoint(x: currentPoint.x + point.x, y: currentPoint.y + point.y)
                    path.move(to: currentPoint)
                    index = nextIndex
                }
            case "L", "l":
                index = pathData.index(after: index)
                if let (point, nextIndex) = parsePoint(from: pathData, startingAt: index) {
                    currentPoint = char == "L" ? point : CGPoint(x: currentPoint.x + point.x, y: currentPoint.y + point.y)
                    path.addLine(to: currentPoint)
                    index = nextIndex
                }
            case "H", "h":
                index = pathData.index(after: index)
                if let (value, nextIndex) = parseNumber(from: pathData, startingAt: index) {
                    currentPoint.x = char == "H" ? CGFloat(value) : currentPoint.x + CGFloat(value)
                    path.addLine(to: currentPoint)
                    index = nextIndex
                }
            case "V", "v":
                index = pathData.index(after: index)
                if let (value, nextIndex) = parseNumber(from: pathData, startingAt: index) {
                    currentPoint.y = char == "V" ? CGFloat(value) : currentPoint.y + CGFloat(value)
                    path.addLine(to: currentPoint)
                    index = nextIndex
                }
            case "C", "c":
                index = pathData.index(after: index)
                if let (p1, i1) = parsePoint(from: pathData, startingAt: index),
                   let (p2, i2) = parsePoint(from: pathData, startingAt: i1),
                   let (p3, i3) = parsePoint(from: pathData, startingAt: i2) {
                    let cp1 = char == "C" ? p1 : CGPoint(x: currentPoint.x + p1.x, y: currentPoint.y + p1.y)
                    let cp2 = char == "C" ? p2 : CGPoint(x: currentPoint.x + p2.x, y: currentPoint.y + p2.y)
                    let end = char == "C" ? p3 : CGPoint(x: currentPoint.x + p3.x, y: currentPoint.y + p3.y)
                    path.addCurve(to: end, control1: cp1, control2: cp2)
                    currentPoint = end
                    index = i3
                }
            case "S", "s":
                index = pathData.index(after: index)
                if let (p2, i2) = parsePoint(from: pathData, startingAt: index),
                   let (p3, i3) = parsePoint(from: pathData, startingAt: i2) {
                    let cp2 = char == "S" ? p2 : CGPoint(x: currentPoint.x + p2.x, y: currentPoint.y + p2.y)
                    let end = char == "S" ? p3 : CGPoint(x: currentPoint.x + p3.x, y: currentPoint.y + p3.y)
                    path.addCurve(to: end, control1: currentPoint, control2: cp2)
                    currentPoint = end
                    index = i3
                }
            case "Z", "z":
                path.closeSubpath()
                index = pathData.index(after: index)
            case " ", ",", "\n", "\t":
                index = pathData.index(after: index)
            default:
                if let (point, nextIndex) = parsePoint(from: pathData, startingAt: index) {
                    path.addLine(to: point)
                    currentPoint = point
                    index = nextIndex
                } else {
                    index = pathData.index(after: index)
                }
            }
        }
    }

    /// Create a simple test image to verify rendering works
    static func testImage(size: CGFloat = 24) -> NSImage {
        let intSize = Int(size)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil,
            width: intSize,
            height: intSize,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return NSImage(size: NSSize(width: size, height: size))
        }

        // Draw blue circle
        context.setFillColor(NSColor.blue.cgColor)
        context.fillEllipse(in: CGRect(x: 2, y: 2, width: size - 4, height: size - 4))

        guard let cgImage = context.makeImage() else {
            return NSImage(size: NSSize(width: size, height: size))
        }

        return NSImage(cgImage: cgImage, size: NSSize(width: size, height: size))
    }

    /// Get approximate bounding box from SVG path data
    private static func getPathBounds(_ pathData: String) -> CGRect {
        var minX: CGFloat = .greatestFiniteMagnitude
        var minY: CGFloat = .greatestFiniteMagnitude
        var maxX: CGFloat = -.greatestFiniteMagnitude
        var maxY: CGFloat = -.greatestFiniteMagnitude

        // Simple regex to extract coordinate pairs
        let pattern = "([0-9]+\\.?[0-9]*),([0-9]+\\.?[0-9]*)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return CGRect(x: 500, y: 620, width: 100, height: 80)
        }

        let matches = regex.matches(in: pathData, range: NSRange(pathData.startIndex..., in: pathData))
        for match in matches {
            if let xRange = Range(match.range(at: 1), in: pathData),
               let yRange = Range(match.range(at: 2), in: pathData),
               let x = Double(pathData[xRange]),
               let y = Double(pathData[yRange]) {
                minX = min(minX, CGFloat(x))
                minY = min(minY, CGFloat(y))
                maxX = max(maxX, CGFloat(x))
                maxY = max(maxY, CGFloat(y))
            }
        }

        if minX == .greatestFiniteMagnitude {
            return CGRect(x: 500, y: 620, width: 100, height: 80)
        }

        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    /// Render SVG path data to an NSImage using NSBezierPath
    private static func renderPathToImage(pathData: String, bounds: CGRect, size: CGFloat) -> NSImage? {
        let scale = min(size / bounds.width, size / bounds.height) * 0.8

        let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { rect in
            guard let context = NSGraphicsContext.current?.cgContext else { return false }

            // Scale and translate to fit
            context.translateBy(x: size / 2, y: size / 2)
            context.scaleBy(x: scale, y: -scale) // Flip Y for SVG coordinate system
            context.translateBy(x: -bounds.midX, y: -bounds.midY)

            // Create bezier path from SVG path data
            let path = NSBezierPath()
            parseSVGPath(pathData, into: path)

            NSColor.black.setFill()
            path.fill()
            return true
        }

        image.isTemplate = true
        return image
    }

    /// Parse SVG path data into NSBezierPath (simplified parser)
    private static func parseSVGPath(_ pathData: String, into path: NSBezierPath) {
        var currentPoint = CGPoint.zero
        var index = pathData.startIndex

        while index < pathData.endIndex {
            let char = pathData[index]

            switch char {
            case "M", "m": // MoveTo
                index = pathData.index(after: index)
                if let (point, nextIndex) = parsePoint(from: pathData, startingAt: index) {
                    currentPoint = char == "M" ? point : CGPoint(x: currentPoint.x + point.x, y: currentPoint.y + point.y)
                    path.move(to: currentPoint)
                    index = nextIndex
                }
            case "L", "l": // LineTo
                index = pathData.index(after: index)
                if let (point, nextIndex) = parsePoint(from: pathData, startingAt: index) {
                    currentPoint = char == "L" ? point : CGPoint(x: currentPoint.x + point.x, y: currentPoint.y + point.y)
                    path.line(to: currentPoint)
                    index = nextIndex
                }
            case "H", "h": // Horizontal line
                index = pathData.index(after: index)
                if let (value, nextIndex) = parseNumber(from: pathData, startingAt: index) {
                    currentPoint.x = char == "H" ? CGFloat(value) : currentPoint.x + CGFloat(value)
                    path.line(to: currentPoint)
                    index = nextIndex
                }
            case "V", "v": // Vertical line
                index = pathData.index(after: index)
                if let (value, nextIndex) = parseNumber(from: pathData, startingAt: index) {
                    currentPoint.y = char == "V" ? CGFloat(value) : currentPoint.y + CGFloat(value)
                    path.line(to: currentPoint)
                    index = nextIndex
                }
            case "C", "c": // Cubic bezier
                index = pathData.index(after: index)
                if let (p1, i1) = parsePoint(from: pathData, startingAt: index),
                   let (p2, i2) = parsePoint(from: pathData, startingAt: i1),
                   let (p3, i3) = parsePoint(from: pathData, startingAt: i2) {
                    let cp1 = char == "C" ? p1 : CGPoint(x: currentPoint.x + p1.x, y: currentPoint.y + p1.y)
                    let cp2 = char == "C" ? p2 : CGPoint(x: currentPoint.x + p2.x, y: currentPoint.y + p2.y)
                    let end = char == "C" ? p3 : CGPoint(x: currentPoint.x + p3.x, y: currentPoint.y + p3.y)
                    path.curve(to: end, controlPoint1: cp1, controlPoint2: cp2)
                    currentPoint = end
                    index = i3
                }
            case "S", "s": // Smooth cubic bezier
                index = pathData.index(after: index)
                if let (p2, i2) = parsePoint(from: pathData, startingAt: index),
                   let (p3, i3) = parsePoint(from: pathData, startingAt: i2) {
                    let cp2 = char == "S" ? p2 : CGPoint(x: currentPoint.x + p2.x, y: currentPoint.y + p2.y)
                    let end = char == "S" ? p3 : CGPoint(x: currentPoint.x + p3.x, y: currentPoint.y + p3.y)
                    path.curve(to: end, controlPoint1: currentPoint, controlPoint2: cp2)
                    currentPoint = end
                    index = i3
                }
            case "Z", "z": // ClosePath
                path.close()
                index = pathData.index(after: index)
            case " ", ",", "\n", "\t":
                index = pathData.index(after: index)
            default:
                // Try to parse as implicit lineto (number following M/L)
                if let (point, nextIndex) = parsePoint(from: pathData, startingAt: index) {
                    path.line(to: point)
                    currentPoint = point
                    index = nextIndex
                } else {
                    index = pathData.index(after: index)
                }
            }
        }
    }

    private static func parsePoint(from string: String, startingAt start: String.Index) -> (CGPoint, String.Index)? {
        guard let (x, afterX) = parseNumber(from: string, startingAt: start) else { return nil }
        var index = afterX
        // Skip comma or whitespace
        while index < string.endIndex && (string[index] == "," || string[index] == " ") {
            index = string.index(after: index)
        }
        guard let (y, afterY) = parseNumber(from: string, startingAt: index) else { return nil }
        return (CGPoint(x: CGFloat(x), y: CGFloat(y)), afterY)
    }

    private static func parseNumber(from string: String, startingAt start: String.Index) -> (Double, String.Index)? {
        var index = start
        // Skip whitespace
        while index < string.endIndex && (string[index] == " " || string[index] == ",") {
            index = string.index(after: index)
        }

        var numStr = ""
        while index < string.endIndex {
            let char = string[index]
            if char == "-" || char == "." || char.isNumber {
                // Handle negative numbers and decimals
                if char == "-" && !numStr.isEmpty { break }
                if char == "." && numStr.contains(".") { break }
                numStr.append(char)
                index = string.index(after: index)
            } else {
                break
            }
        }

        guard let value = Double(numStr) else { return nil }
        return (value, index)
    }
}

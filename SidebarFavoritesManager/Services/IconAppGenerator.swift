import Foundation
import AppKit

/// Generates icon apps from template for each favorite
final class IconAppGenerator {
    static let shared = IconAppGenerator()

    private let fileManager = FileManager.default
    private let configManager = ConfigManager.shared

    /// URL to the template app bundle inside our Resources
    private var templateURL: URL? {
        Bundle.main.url(forResource: "IconAppTemplate", withExtension: "app")
    }

    private init() {}

    /// Generate an icon app for a favorite
    func generateIconApp(for favorite: Favorite) throws {
        guard let templateURL = templateURL else {
            throw GeneratorError.templateNotFound
        }

        let destinationURL = configManager.iconAppURL(for: favorite)

        // Remove existing app if present
        if fileManager.fileExists(atPath: destinationURL.path) {
            try fileManager.removeItem(at: destinationURL)
        }

        // Copy template
        try fileManager.copyItem(at: templateURL, to: destinationURL)

        // Handle icon compilation (before any signing)
        var symbolName = favorite.iconValue

        if favorite.iconType == .custom, let svgPath = favorite.customSVGPath {
            // Custom SVG: compile to Assets.car as symbol
            symbolName = try compileCustomSymbol(svgPath: svgPath, appURL: destinationURL)
        }
        // For SF Symbols: just use the symbol name directly - NO compilation needed!
        // System SF Symbols work with just CFBundleSymbolName set in Info.plist

        // Update main app Info.plist
        try updateMainInfoPlist(at: destinationURL, for: favorite, symbolName: symbolName)

        // Update extension Info.plist
        try updateExtensionInfoPlist(at: destinationURL, for: favorite)

        // Write folder path to text file (extension reads this at runtime)
        try updateFolderPathFile(at: destinationURL, for: favorite)

        // Sign the app bundle properly
        // Since we changed the extension's bundle identifier, we MUST re-sign it
        // But we need to preserve the correct entitlements
        try signAppBundle(at: destinationURL)

        // Register with Launch Services (with full flags)
        try registerWithLaunchServices(at: destinationURL)
    }

    /// Update the main app's Info.plist
    private func updateMainInfoPlist(at appURL: URL, for favorite: Favorite, symbolName: String) throws {
        let plistURL = appURL.appendingPathComponent("Contents/Info.plist")

        guard var plist = NSDictionary(contentsOf: plistURL) as? [String: Any] else {
            throw GeneratorError.plistReadFailed
        }

        // Update bundle identifier
        plist["CFBundleIdentifier"] = favorite.bundleIdentifier

        // Update display name
        plist["CFBundleName"] = favorite.name

        // Set the SF Symbol name - this works for BOTH system SF Symbols and custom symbols
        // System SF Symbols (like "flame", "hammer.fill") just need the name
        // Custom symbols need Assets.car compiled but also use CFBundleSymbolName
        var icons = plist["CFBundleIcons"] as? [String: Any] ?? [:]
        var primaryIcon = icons["CFBundlePrimaryIcon"] as? [String: Any] ?? [:]
        primaryIcon["CFBundleSymbolName"] = symbolName
        icons["CFBundlePrimaryIcon"] = primaryIcon
        plist["CFBundleIcons"] = icons

        // Remove CFBundleIconFile if present (we use CFBundleSymbolName instead)
        plist.removeValue(forKey: "CFBundleIconFile")

        // Increment bundle version to force icon refresh
        let currentVersion = Int(plist["CFBundleVersion"] as? String ?? "1") ?? 1
        plist["CFBundleVersion"] = String(currentVersion + 1)

        let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try data.write(to: plistURL)
    }

    /// Update the extension's Info.plist
    private func updateExtensionInfoPlist(at appURL: URL, for favorite: Favorite) throws {
        let extensionURL = appURL.appendingPathComponent("Contents/PlugIns/IconAppSync.appex")
        let plistURL = extensionURL.appendingPathComponent("Contents/Info.plist")

        guard var plist = NSDictionary(contentsOf: plistURL) as? [String: Any] else {
            throw GeneratorError.plistReadFailed
        }

        // Update bundle identifier
        plist["CFBundleIdentifier"] = favorite.extensionBundleIdentifier

        // Update display name
        plist["CFBundleName"] = "\(favorite.name) Sync"

        // Set the folder paths in Info.plist (this is read by FinderSync at runtime)
        // IMPORTANT: Must expand tilde to full path for FinderSync to work
        let expandedPath = (favorite.folderPath as NSString).expandingTildeInPath
        plist["SidebarFolderPaths"] = [expandedPath]

        let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try data.write(to: plistURL)
    }

    /// Write the folder path to a text file in the extension's Resources
    private func updateFolderPathFile(at appURL: URL, for favorite: Favorite) throws {
        let resourcesDir = appURL.appendingPathComponent("Contents/PlugIns/IconAppSync.appex/Contents/Resources")

        // Create Resources directory if it doesn't exist
        if !fileManager.fileExists(atPath: resourcesDir.path) {
            try fileManager.createDirectory(at: resourcesDir, withIntermediateDirectories: true)
        }

        // Expand tilde to full path before writing
        let expandedPath = (favorite.folderPath as NSString).expandingTildeInPath

        let pathFileURL = resourcesDir.appendingPathComponent("FolderPath.txt")
        try expandedPath.write(to: pathFileURL, atomically: true, encoding: .utf8)
    }

    /// Compile a custom SF Symbol SVG into Assets.car
    /// Returns the symbol name extracted from the SVG's descriptive-name field
    private func compileCustomSymbol(svgPath: String, appURL: URL) throws -> String {
        let svgURL = configManager.customIconURL(relativePath: svgPath)
        guard fileManager.fileExists(atPath: svgURL.path) else {
            throw GeneratorError.customIconNotFound
        }

        // CRITICAL: Extract symbol name from SVG's descriptive-name field
        let symbolName = try extractSymbolName(from: svgURL)

        // Create temp directory for asset catalog
        let tempDir = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try fileManager.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: tempDir) }

        let xcassetsURL = tempDir.appendingPathComponent("Symbols.xcassets")
        try fileManager.createDirectory(at: xcassetsURL, withIntermediateDirectories: true)

        // Create root Contents.json
        let rootContentsJSON = """
        {
          "info": {
            "version": 1,
            "author": "xcode"
          }
        }
        """
        try rootContentsJSON.write(to: xcassetsURL.appendingPathComponent("Contents.json"), atomically: true, encoding: .utf8)

        // Create symbolset directory with the CORRECT symbol name
        let symbolsetURL = xcassetsURL.appendingPathComponent("\(symbolName).symbolset")
        try fileManager.createDirectory(at: symbolsetURL, withIntermediateDirectories: true)

        // Copy SVG with the correct name
        let destSVG = symbolsetURL.appendingPathComponent("\(symbolName).svg")
        try fileManager.copyItem(at: svgURL, to: destSVG)

        // Create symbolset Contents.json
        let symbolContentsJSON = """
        {
          "info": {
            "version": 1,
            "author": "xcode"
          },
          "symbols": [
            {
              "filename": "\(symbolName).svg",
              "idiom": "universal"
            }
          ]
        }
        """
        try symbolContentsJSON.write(to: symbolsetURL.appendingPathComponent("Contents.json"), atomically: true, encoding: .utf8)

        // Compile with actool
        let outputDir = tempDir.appendingPathComponent("output")
        try fileManager.createDirectory(at: outputDir, withIntermediateDirectories: true)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/xcrun")
        process.arguments = [
            "actool",
            xcassetsURL.path,
            "--compile", outputDir.path,
            "--platform", "macosx",
            "--minimum-deployment-target", "13.0",
            "--output-format", "human-readable-text"
        ]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            throw GeneratorError.actoolFailed(output)
        }

        // Copy Assets.car to app bundle
        let assetsCarSource = outputDir.appendingPathComponent("Assets.car")
        let resourcesDir = appURL.appendingPathComponent("Contents/Resources")
        let assetsCarDest = resourcesDir.appendingPathComponent("Assets.car")

        // Create Resources directory if it doesn't exist
        try fileManager.createDirectory(at: resourcesDir, withIntermediateDirectories: true)

        if fileManager.fileExists(atPath: assetsCarDest.path) {
            try fileManager.removeItem(at: assetsCarDest)
        }
        try fileManager.copyItem(at: assetsCarSource, to: assetsCarDest)

        return symbolName
    }

    /// Compile an SF Symbol to icns file for app icon
    /// This is used when we can't create a proper SF Symbol template (which requires vector paths)
    private func compileSFSymbolToIcns(symbolName: String, appURL: URL) throws {
        guard let symbolImage = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil) else {
            throw GeneratorError.invalidSFSymbol(symbolName)
        }

        // Create iconset directory
        let tempDir = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try fileManager.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: tempDir) }

        let iconsetURL = tempDir.appendingPathComponent("AppIcon.iconset")
        try fileManager.createDirectory(at: iconsetURL, withIntermediateDirectories: true)

        // Icon sizes required for macOS icns
        let sizes: [(name: String, size: Int)] = [
            ("icon_16x16", 16),
            ("icon_16x16@2x", 32),
            ("icon_32x32", 32),
            ("icon_32x32@2x", 64),
            ("icon_128x128", 128),
            ("icon_128x128@2x", 256),
            ("icon_256x256", 256),
            ("icon_256x256@2x", 512),
            ("icon_512x512", 512),
            ("icon_512x512@2x", 1024)
        ]

        // Render the symbol at each size
        for (name, pixelSize) in sizes {
            // Configure symbol for this size
            let config = NSImage.SymbolConfiguration(pointSize: CGFloat(pixelSize) * 0.7, weight: .regular)
            let configuredImage = symbolImage.withSymbolConfiguration(config) ?? symbolImage

            guard let bitmapRep = NSBitmapImageRep(
                bitmapDataPlanes: nil,
                pixelsWide: pixelSize,
                pixelsHigh: pixelSize,
                bitsPerSample: 8,
                samplesPerPixel: 4,
                hasAlpha: true,
                isPlanar: false,
                colorSpaceName: .deviceRGB,
                bytesPerRow: 0,
                bitsPerPixel: 0
            ) else {
                continue
            }

            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmapRep)

            // Clear background
            NSColor.clear.setFill()
            NSRect(x: 0, y: 0, width: pixelSize, height: pixelSize).fill()

            // Draw the symbol centered
            let drawRect = NSRect(x: 0, y: 0, width: pixelSize, height: pixelSize)
            configuredImage.draw(in: drawRect, from: .zero, operation: .sourceOver, fraction: 1.0)

            NSGraphicsContext.restoreGraphicsState()

            guard let pngData = bitmapRep.representation(using: .png, properties: [:]) else {
                continue
            }

            let pngURL = iconsetURL.appendingPathComponent("\(name).png")
            try pngData.write(to: pngURL)
        }

        // Convert iconset to icns using iconutil
        let icnsURL = tempDir.appendingPathComponent("AppIcon.icns")

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
        process.arguments = ["-c", "icns", "-o", icnsURL.path, iconsetURL.path]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            throw GeneratorError.iconutilFailed(output)
        }

        // Copy icns to app bundle Resources
        let resourcesDir = appURL.appendingPathComponent("Contents/Resources")
        try fileManager.createDirectory(at: resourcesDir, withIntermediateDirectories: true)

        let destIcns = resourcesDir.appendingPathComponent("AppIcon.icns")
        if fileManager.fileExists(atPath: destIcns.path) {
            try fileManager.removeItem(at: destIcns)
        }
        try fileManager.copyItem(at: icnsURL, to: destIcns)
    }

    /// Compile an SF Symbol to Assets.car for Finder sidebar compatibility
    /// Finder sidebar requires symbols (not icon images) in compiled asset catalogs
    /// We create an SF Symbol template SVG from the system symbol and compile it
    /// Returns the custom symbol name used (prefixed to avoid conflict with system symbols)
    private func compileSFSymbolToAssets(symbolName: String, appURL: URL) throws -> String {
        guard NSImage(systemSymbolName: symbolName, accessibilityDescription: nil) != nil else {
            throw GeneratorError.invalidSFSymbol(symbolName)
        }

        // Use a custom prefix to avoid conflict with system SF Symbols
        // System symbols take precedence, so we need a unique name
        let customSymbolName = "sidebar.\(symbolName)"

        // Create temp directory for asset catalog
        let tempDir = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try fileManager.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: tempDir) }

        // Generate an SF Symbol template SVG with proper guides
        let svgContent = generateSymbolTemplateSVG(symbolName: customSymbolName)

        let xcassetsURL = tempDir.appendingPathComponent("Symbols.xcassets")
        try fileManager.createDirectory(at: xcassetsURL, withIntermediateDirectories: true)

        // Create root Contents.json
        let rootContentsJSON = """
        {
          "info": {
            "version": 1,
            "author": "xcode"
          }
        }
        """
        try rootContentsJSON.write(to: xcassetsURL.appendingPathComponent("Contents.json"), atomically: true, encoding: .utf8)

        // Create symbolset directory with custom name
        let symbolsetURL = xcassetsURL.appendingPathComponent("\(customSymbolName).symbolset")
        try fileManager.createDirectory(at: symbolsetURL, withIntermediateDirectories: true)

        // Write SVG file
        let svgURL = symbolsetURL.appendingPathComponent("\(customSymbolName).svg")
        try svgContent.write(to: svgURL, atomically: true, encoding: .utf8)

        // Create symbolset Contents.json
        let symbolContentsJSON = """
        {
          "info": {
            "version": 1,
            "author": "xcode"
          },
          "symbols": [
            {
              "filename": "\(customSymbolName).svg",
              "idiom": "universal"
            }
          ]
        }
        """
        try symbolContentsJSON.write(to: symbolsetURL.appendingPathComponent("Contents.json"), atomically: true, encoding: .utf8)

        // Compile with actool
        let outputDir = tempDir.appendingPathComponent("output")
        try fileManager.createDirectory(at: outputDir, withIntermediateDirectories: true)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/xcrun")
        process.arguments = [
            "actool",
            xcassetsURL.path,
            "--compile", outputDir.path,
            "--platform", "macosx",
            "--minimum-deployment-target", "13.0",
            "--output-format", "human-readable-text"
        ]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        try process.run()
        process.waitUntilExit()

        let actoolOutput = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        NSLog("IconAppGenerator: actool output: \(actoolOutput)")

        guard process.terminationStatus == 0 else {
            throw GeneratorError.actoolFailed(actoolOutput)
        }

        // Copy Assets.car to app bundle
        let assetsCarSource = outputDir.appendingPathComponent("Assets.car")

        // Check if Assets.car was actually created
        guard fileManager.fileExists(atPath: assetsCarSource.path) else {
            let contents = try? fileManager.contentsOfDirectory(atPath: outputDir.path)
            NSLog("IconAppGenerator: actool output dir contains: \(contents ?? [])")
            throw GeneratorError.actoolFailed("Assets.car not created. Output dir: \(contents ?? [])")
        }

        let resourcesDir = appURL.appendingPathComponent("Contents/Resources")
        let assetsCarDest = resourcesDir.appendingPathComponent("Assets.car")

        try fileManager.createDirectory(at: resourcesDir, withIntermediateDirectories: true)

        if fileManager.fileExists(atPath: assetsCarDest.path) {
            try fileManager.removeItem(at: assetsCarDest)
        }
        try fileManager.copyItem(at: assetsCarSource, to: assetsCarDest)
        NSLog("IconAppGenerator: Assets.car with symbol '\(customSymbolName)' copied successfully")

        return customSymbolName
    }

    /// Generate an SF Symbol template SVG from a system symbol
    /// Renders the actual SF Symbol into the template as embedded images
    private func generateSymbolTemplateSVG(symbolName: String) -> String {
        // Get the original SF Symbol name (remove our "sidebar." prefix)
        let originalSymbolName = symbolName.hasPrefix("sidebar.") ?
            String(symbolName.dropFirst("sidebar.".count)) : symbolName

        // Render the SF Symbol to base64 PNG for embedding
        let symbolPNG = renderSFSymbolToPNG(named: originalSymbolName, size: 70)
        let base64Image = symbolPNG?.base64EncodedString() ?? ""
        let imageDataURL = base64Image.isEmpty ? "" : "data:image/png;base64,\(base64Image)"

        // Create image elements for each weight/size position (S, M, L rows)
        // Using embedded PNG of the actual SF Symbol instead of placeholder rectangles
        let ultralightS = imageDataURL.isEmpty ? "" : "<image x=\"510\" y=\"630\" width=\"100\" height=\"60\" href=\"\(imageDataURL)\"/>"
        let regularS = imageDataURL.isEmpty ? "" : "<image x=\"1400\" y=\"630\" width=\"100\" height=\"60\" href=\"\(imageDataURL)\"/>"
        let blackS = imageDataURL.isEmpty ? "" : "<image x=\"2880\" y=\"630\" width=\"100\" height=\"60\" href=\"\(imageDataURL)\"/>"
        let ultralightM = imageDataURL.isEmpty ? "" : "<image x=\"510\" y=\"1060\" width=\"100\" height=\"60\" href=\"\(imageDataURL)\"/>"
        let regularM = imageDataURL.isEmpty ? "" : "<image x=\"1400\" y=\"1060\" width=\"100\" height=\"60\" href=\"\(imageDataURL)\"/>"
        let blackM = imageDataURL.isEmpty ? "" : "<image x=\"2880\" y=\"1060\" width=\"100\" height=\"60\" href=\"\(imageDataURL)\"/>"
        let ultralightL = imageDataURL.isEmpty ? "" : "<image x=\"510\" y=\"1490\" width=\"100\" height=\"60\" href=\"\(imageDataURL)\"/>"
        let regularL = imageDataURL.isEmpty ? "" : "<image x=\"1400\" y=\"1490\" width=\"100\" height=\"60\" href=\"\(imageDataURL)\"/>"
        let blackL = imageDataURL.isEmpty ? "" : "<image x=\"2880\" y=\"1490\" width=\"100\" height=\"60\" href=\"\(imageDataURL)\"/>"

        let svg = """
<?xml version="1.0" encoding="UTF-8"?>
<svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" width="3300" height="2200" version="1.1" viewBox="0 0 3300 2200">
  <g id="Notes">
    <rect id="artboard" y="0" width="3300" height="2200" fill="#fff"/>
    <text id="descriptive-name" transform="translate(2850 1883)" font-family="Helvetica" font-size="13"><tspan x="0" y="0">\(symbolName)</tspan></text>
  </g>
  <g id="Guides">
    <line id="Baseline-S" x1="263" y1="696" x2="3036" y2="696" fill="none" stroke="#27aae1" stroke-width=".5"/>
    <line id="Capline-S" x1="263" y1="625.541016" x2="3036" y2="625.541016" fill="none" stroke="#27aae1" stroke-width=".5"/>
    <line id="Baseline-M" x1="263" y1="1126" x2="3036" y2="1126" fill="none" stroke="#27aae1" stroke-width=".5"/>
    <line id="Capline-M" x1="263" y1="1055.540039" x2="3036" y2="1055.540039" fill="none" stroke="#27aae1" stroke-width=".5"/>
    <line id="Baseline-L" x1="263" y1="1556" x2="3036" y2="1556" fill="none" stroke="#27aae1" stroke-width=".5"/>
    <line id="Capline-L" x1="263" y1="1485.540039" x2="3036" y2="1485.540039" fill="none" stroke="#27aae1" stroke-width=".5"/>
    <line id="left-margin-Ultralight-S" x1="505.70" y1="600.78" x2="505.70" y2="720.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="right-margin-Ultralight-S" x1="613.72" y1="600.78" x2="613.72" y2="720.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="left-margin-Regular-S" x1="1394.79" y1="600.78" x2="1394.79" y2="720.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="right-margin-Regular-S" x1="1504.90" y1="600.78" x2="1504.90" y2="720.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="left-margin-Black-S" x1="2877.35" y1="600.78" x2="2877.35" y2="720.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="right-margin-Black-S" x1="2989.45" y1="600.78" x2="2989.45" y2="720.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="left-margin-Ultralight-M" x1="505.70" y1="1030.78" x2="505.70" y2="1150.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="right-margin-Ultralight-M" x1="613.72" y1="1030.78" x2="613.72" y2="1150.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="left-margin-Regular-M" x1="1394.79" y1="1030.78" x2="1394.79" y2="1150.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="right-margin-Regular-M" x1="1504.90" y1="1030.78" x2="1504.90" y2="1150.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="left-margin-Black-M" x1="2877.35" y1="1030.78" x2="2877.35" y2="1150.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="right-margin-Black-M" x1="2989.45" y1="1030.78" x2="2989.45" y2="1150.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="left-margin-Ultralight-L" x1="505.70" y1="1460.78" x2="505.70" y2="1580.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="right-margin-Ultralight-L" x1="613.72" y1="1460.78" x2="613.72" y2="1580.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="left-margin-Regular-L" x1="1394.79" y1="1460.78" x2="1394.79" y2="1580.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="right-margin-Regular-L" x1="1504.90" y1="1460.78" x2="1504.90" y2="1580.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="left-margin-Black-L" x1="2877.35" y1="1460.78" x2="2877.35" y2="1580.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
    <line id="right-margin-Black-L" x1="2989.45" y1="1460.78" x2="2989.45" y2="1580.12" fill="none" stroke="#00aeef" stroke-width=".5"/>
  </g>
  <g id="Symbols">
    <g id="Ultralight-S">\(ultralightS)</g>
    <g id="Regular-S">\(regularS)</g>
    <g id="Black-S">\(blackS)</g>
    <g id="Ultralight-M">\(ultralightM)</g>
    <g id="Regular-M">\(regularM)</g>
    <g id="Black-M">\(blackM)</g>
    <g id="Ultralight-L">\(ultralightL)</g>
    <g id="Regular-L">\(regularL)</g>
    <g id="Black-L">\(blackL)</g>
  </g>
</svg>
"""
        return svg
    }

    /// Render an SF Symbol to PNG data
    private func renderSFSymbolToPNG(named symbolName: String, size: CGFloat) -> Data? {
        guard let symbolImage = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil) else {
            return nil
        }

        let config = NSImage.SymbolConfiguration(pointSize: size, weight: .regular)
        let configuredImage = symbolImage.withSymbolConfiguration(config) ?? symbolImage

        // Create bitmap
        let pixelSize = Int(size * 2)  // 2x for retina
        guard let bitmapRep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: pixelSize,
            pixelsHigh: pixelSize,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) else {
            return nil
        }

        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmapRep)

        // Clear background
        NSColor.clear.setFill()
        NSRect(x: 0, y: 0, width: pixelSize, height: pixelSize).fill()

        // Draw symbol centered
        let drawRect = NSRect(x: 0, y: 0, width: pixelSize, height: pixelSize)
        configuredImage.draw(in: drawRect, from: .zero, operation: .sourceOver, fraction: 1.0)

        NSGraphicsContext.restoreGraphicsState()

        return bitmapRep.representation(using: .png, properties: [:])
    }

    /// Extract symbol name from SVG's descriptive-name field
    private func extractSymbolName(from svgURL: URL) throws -> String {
        let svgContent = try String(contentsOf: svgURL, encoding: .utf8)

        // Look for: id="descriptive-name"...><tspan...>symbol.name.here</tspan>
        // The symbol name is inside a tspan element within the descriptive-name text element
        let pattern = #"id="descriptive-name"[^>]*>.*?<tspan[^>]*>([^<]+)</tspan>"#

        guard let regex = try? NSRegularExpression(pattern: pattern, options: .dotMatchesLineSeparators),
              let match = regex.firstMatch(in: svgContent, range: NSRange(svgContent.startIndex..., in: svgContent)),
              let range = Range(match.range(at: 1), in: svgContent) else {
            throw GeneratorError.symbolNameNotFound
        }

        let symbolName = String(svgContent[range]).trimmingCharacters(in: .whitespaces)

        guard !symbolName.isEmpty else {
            throw GeneratorError.symbolNameNotFound
        }

        return symbolName
    }

    /// Sign the entire app bundle (extension first, then main app)
    /// This is required because we change the extension's bundle identifier
    private func signAppBundle(at appURL: URL) throws {
        let extensionURL = appURL.appendingPathComponent("Contents/PlugIns/IconAppSync.appex")

        // Create entitlements file for the extension
        // These match what Xcode uses for Finder Sync extensions
        let tempDir = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try fileManager.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: tempDir) }

        let entitlementsContent = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
            <key>com.apple.security.app-sandbox</key>
            <true/>
            <key>com.apple.security.files.user-selected.read-only</key>
            <true/>
        </dict>
        </plist>
        """
        let entitlementsURL = tempDir.appendingPathComponent("extension.entitlements")
        try entitlementsContent.write(to: entitlementsURL, atomically: true, encoding: .utf8)

        // Sign the extension first with entitlements
        let extProcess = Process()
        extProcess.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")
        extProcess.arguments = [
            "--force",
            "--sign", "Apple Development",
            "--entitlements", entitlementsURL.path,
            extensionURL.path
        ]

        let extPipe = Pipe()
        extProcess.standardOutput = extPipe
        extProcess.standardError = extPipe

        try extProcess.run()
        extProcess.waitUntilExit()

        guard extProcess.terminationStatus == 0 else {
            let output = String(data: extPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            throw GeneratorError.codesignFailed("Extension: \(output)")
        }

        // Then sign the main app
        let appProcess = Process()
        appProcess.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")
        appProcess.arguments = [
            "--force",
            "--sign", "Apple Development",
            appURL.path
        ]

        let appPipe = Pipe()
        appProcess.standardOutput = appPipe
        appProcess.standardError = appPipe

        try appProcess.run()
        appProcess.waitUntilExit()

        guard appProcess.terminationStatus == 0 else {
            let output = String(data: appPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            throw GeneratorError.codesignFailed("Main app: \(output)")
        }
    }

    /// Register with Launch Services using full flags
    private func registerWithLaunchServices(at appURL: URL) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister")

        // Use full flags like Xcode does: -f -R -trusted
        process.arguments = ["-f", "-R", "-trusted", appURL.path]

        try process.run()
        process.waitUntilExit()
    }

    /// Restart Finder to refresh sidebar icons
    func restartFinder() {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/killall")
        process.arguments = ["Finder"]

        try? process.run()
        process.waitUntilExit()
    }

    /// Remove an icon app and unregister its extension
    func removeIconApp(for favorite: Favorite) throws {
        // First, disable the extension via pluginkit
        let extensionId = favorite.extensionBundleIdentifier
        let disableProcess = Process()
        disableProcess.executableURL = URL(fileURLWithPath: "/usr/bin/pluginkit")
        disableProcess.arguments = ["-e", "ignore", "-i", extensionId]
        try? disableProcess.run()
        disableProcess.waitUntilExit()

        // Unregister from Launch Services
        let appURL = configManager.iconAppURL(for: favorite)
        if fileManager.fileExists(atPath: appURL.path) {
            let lsProcess = Process()
            lsProcess.executableURL = URL(fileURLWithPath: "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister")
            lsProcess.arguments = ["-u", appURL.path]
            try? lsProcess.run()
            lsProcess.waitUntilExit()

            // Then remove the app bundle
            try fileManager.removeItem(at: appURL)
        }
    }

    /// Check if an icon app exists and is up to date
    func isIconAppCurrent(for favorite: Favorite) -> Bool {
        let appURL = configManager.iconAppURL(for: favorite)
        guard fileManager.fileExists(atPath: appURL.path) else {
            return false
        }

        // Check if the app bundle was modified after the favorite was updated
        guard let attrs = try? fileManager.attributesOfItem(atPath: appURL.path),
              let modDate = attrs[.modificationDate] as? Date else {
            return false
        }

        return modDate >= favorite.updatedAt
    }

    enum GeneratorError: LocalizedError {
        case templateNotFound
        case plistReadFailed
        case customIconNotFound
        case symbolNameNotFound
        case invalidSFSymbol(String)
        case actoolFailed(String)
        case iconutilFailed(String)
        case codesignFailed(String)

        var errorDescription: String? {
            switch self {
            case .templateNotFound:
                return "IconAppTemplate.app not found in Resources"
            case .plistReadFailed:
                return "Failed to read Info.plist"
            case .customIconNotFound:
                return "Custom icon SVG file not found"
            case .symbolNameNotFound:
                return "Could not extract symbol name from SVG (missing descriptive-name field)"
            case .invalidSFSymbol(let name):
                return "Invalid SF Symbol name: \(name)"
            case .actoolFailed(let output):
                return "Failed to compile assets: \(output)"
            case .iconutilFailed(let output):
                return "Failed to create icns: \(output)"
            case .codesignFailed(let output):
                return "Failed to sign app: \(output)"
            }
        }
    }
}

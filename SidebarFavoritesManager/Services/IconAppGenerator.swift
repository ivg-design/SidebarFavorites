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

        // Handle custom icon first (before any signing)
        // This extracts the correct symbol name from the SVG
        var symbolName = favorite.iconValue
        if favorite.iconType == .custom, let svgPath = favorite.customSVGPath {
            symbolName = try compileCustomSymbol(svgPath: svgPath, appURL: destinationURL)
        }

        // Update main app Info.plist with the correct symbol name
        try updateMainInfoPlist(at: destinationURL, for: favorite, symbolName: symbolName)

        // Update extension Info.plist
        try updateExtensionInfoPlist(at: destinationURL, for: favorite)

        // Update URLs file
        try updateURLsFile(at: destinationURL, for: favorite)

        // CRITICAL: Only remove and re-sign the MAIN APP, NOT the extension!
        // Re-signing the extension breaks pluginkit registration
        try removeMainAppSignature(at: destinationURL)
        try signMainAppOnly(at: destinationURL)

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

        // Update icon with the correct symbol name (extracted from SVG if custom)
        var icons = plist["CFBundleIcons"] as? [String: Any] ?? [:]
        var primaryIcon = icons["CFBundlePrimaryIcon"] as? [String: Any] ?? [:]
        primaryIcon["CFBundleSymbolName"] = symbolName
        icons["CFBundlePrimaryIcon"] = primaryIcon
        plist["CFBundleIcons"] = icons

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

        let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try data.write(to: plistURL)
    }

    /// Update the URLs file with the folder path
    private func updateURLsFile(at appURL: URL, for favorite: Favorite) throws {
        let urlsFileURL = appURL.appendingPathComponent("Contents/PlugIns/IconAppSync.appex/Contents/Resources/URLs")
        try favorite.folderPath.write(to: urlsFileURL, atomically: true, encoding: .utf8)
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

    /// Remove ONLY the main app's code signature (NOT the extension!)
    private func removeMainAppSignature(at appURL: URL) throws {
        // ONLY remove main app signature
        let mainCodeSig = appURL.appendingPathComponent("Contents/_CodeSignature")
        try? fileManager.removeItem(at: mainCodeSig)

        // DO NOT touch the extension's signature!
        // Removing/re-signing the extension breaks pluginkit registration
    }

    /// Sign ONLY the main app bundle (NOT the extension!)
    private func signMainAppOnly(at appURL: URL) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")

        // Sign only the main app, NOT --deep
        // The extension keeps its original Xcode-built signature
        process.arguments = [
            "--force",
            "--sign", "Apple Development",
            appURL.path
        ]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            throw GeneratorError.codesignFailed(output)
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

    /// Remove an icon app
    func removeIconApp(for favorite: Favorite) throws {
        let appURL = configManager.iconAppURL(for: favorite)
        if fileManager.fileExists(atPath: appURL.path) {
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
        case actoolFailed(String)
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
            case .actoolFailed(let output):
                return "Failed to compile assets: \(output)"
            case .codesignFailed(let output):
                return "Failed to sign app: \(output)"
            }
        }
    }
}

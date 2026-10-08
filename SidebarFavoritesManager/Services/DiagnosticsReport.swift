import Foundation
import UniformTypeIdentifiers

/// A plain-text account of what the app believes and what Finder's list says,
/// for pasting into a bug report.
///
/// Read-only. It answers the first question every sidebar bug turns on - does the
/// row still carry its code, and does that code still resolve to our symbol? - so
/// "Finder stopped drawing it" can be told apart from "the app lost track of it"
/// without a screen-sharing session.
enum DiagnosticsReport {
    static func make(favorites: [Favorite]) -> String {
        let os = ProcessInfo.processInfo.operatingSystemVersion
        var lines = ["SidebarFavorites \(AppVersion.display), macOS \(os.majorVersion).\(os.minorVersion).\(os.patchVersion)", ""]

        let symbols = declaredSymbols()

        lines.append("Favorites (\(favorites.count)):")
        for favorite in favorites {
            var parts = [
                "- \(favorite.isSpacer ? "[spacer]" : favorite.name)",
                favorite.folderPath,
                "code=\(favorite.osType ?? "none")",
                "row=\(favorite.sidebarItemID.map(String.init) ?? "none")",
                favorite.sidebarProvenance.rawValue,
                "icon=\(favorite.iconType == .sfSymbol ? favorite.iconValue : (favorite.customSVGPath ?? favorite.iconValue))",
            ]
            if favorite.iconType == .custom, favorite.iconScale != Favorite.defaultIconScale {
                parts.append("scale=\(favorite.iconScale)")
            }
            if !favorite.enabled { parts.append("disabled") }
            if favorite.locationsOnly { parts.append("locations-only") }
            if favorite.mode == .advanced { parts.append("both-icons") }
            let path = favorite.expandedFolderPath
            if CloudFolder.isDomainRoot(path) {
                parts.append("cloud-account-root")
            } else if CloudFolder.contains(path) {
                parts.append("cloud")
            }
            if !FileManager.default.fileExists(atPath: path) { parts.append("FOLDER-MISSING") }
            lines.append(parts.joined(separator: "  "))
        }

        lines.append("")
        lines.append("Finder sidebar (Favorites), top to bottom:")
        do {
            for (index, row) in try SidebarItemManager.shared.snapshot().enumerated() {
                var parts = ["\(index). \(row.itemID)", "\"\(row.displayName)\""]
                if let path = row.path {
                    parts.append(path)
                } else if let recorded = row.recordedPath {
                    parts.append("UNRESOLVED (recorded: \(recorded))")
                } else {
                    parts.append("UNRESOLVED")
                }
                if let code = row.osType {
                    parts.append("code=\(code) -> \(resolution(of: code, symbols: symbols))")
                }
                lines.append(parts.joined(separator: "  "))
            }
        } catch {
            lines.append("(couldn't read it: \(error.localizedDescription))")
        }
        return lines.joined(separator: "\n")
    }

    /// What Launch Services makes of a row's code right now.
    private static func resolution(of code: String, symbols: [String: String]) -> String {
        guard let type = UTType(tag: code, tagClass: UTTagClass(rawValue: "com.apple.ostype"), conformingTo: nil) else {
            return "no type"
        }
        if type.identifier.hasPrefix(IconHelperBundle.utiPrefix) {
            return "ours, symbol \(symbols[code] ?? "MISSING from helper")"
        }
        return type.isDynamic ? "NOT DECLARED (helper not registered?)" : "declared by \(type.identifier)"
    }

    /// OSType -> symbol name, as the installed helper bundle declares them.
    private static func declaredSymbols() -> [String: String] {
        let plistURL = ConfigManager.shared.helperAppURL.appendingPathComponent("Contents/Info.plist")
        guard let info = NSDictionary(contentsOf: plistURL),
              let declarations = info["UTExportedTypeDeclarations"] as? [[String: Any]] else {
            return [:]
        }
        var symbols: [String: String] = [:]
        for declaration in declarations {
            guard let tags = declaration["UTTypeTagSpecification"] as? [String: Any],
                  let code = (tags["com.apple.ostype"] as? [String])?.first else { continue }
            let icons = declaration["UTTypeIcons"] as? [String: Any]
            symbols[code] = icons?["UTTypeSymbolName"] as? String ?? "none (folder fallback)"
        }
        return symbols
    }
}

import AppKit

/// Every SF Symbol this Mac can draw, for the symbol browser.
///
/// There is no public API that enumerates SF Symbols, but macOS ships the
/// catalog itself: `CoreGlyphs.bundle` carries the canonical symbol order, the
/// release each name became available in, the category assignments and the
/// search keywords that the SF Symbols app uses. Reading those plists gives the
/// real list - about 8,300 names on macOS 26 - rather than a list hard-coded
/// into this app that would rot with every OS release.
///
/// Nothing here is load-bearing: if the bundle moves or changes shape, `all` is
/// empty and the browser falls back to the built-in quick picks, which is the
/// behaviour every build before this one had.
enum SymbolCatalog {
    struct Symbol: Hashable, Identifiable {
        let name: String
        var id: String { name }
        /// Category identifiers this symbol belongs to (`nature`, `devices`, …).
        let categories: [String]
        /// Words the SF Symbols app matches on beyond the name itself.
        let keywords: [String]
    }

    private static let resources = URL(
        fileURLWithPath: "/System/Library/CoreServices/CoreGlyphs.bundle/Contents/Resources")

    /// Loaded once; the plists total a few hundred KB and parse in milliseconds.
    static let all: [Symbol] = load()

    /// True when the catalog could be read, i.e. the browser has something to show.
    static var isAvailable: Bool { !all.isEmpty }

    private static func load() -> [Symbol] {
        guard let order = plist(named: "symbol_order.plist") as? [String] else { return [] }
        let categories = plist(named: "symbol_categories.plist") as? [String: [String]] ?? [:]
        let search = plist(named: "symbol_search.plist") as? [String: [String]] ?? [:]

        // The order file lists every name the bundle knows, including ones this
        // macOS cannot draw (newer releases) and ones reserved for Apple's own
        // use. Asking AppKit for the image is the only honest test of "can this
        // Mac render it", and it is also what the picker will do later.
        return order.compactMap { name in
            guard NSImage(systemSymbolName: name, accessibilityDescription: nil) != nil else {
                return nil
            }
            return Symbol(name: name,
                          categories: categories[name] ?? [],
                          keywords: search[name] ?? [])
        }
    }

    private static func plist(named name: String) -> Any? {
        guard let data = try? Data(contentsOf: resources.appendingPathComponent(name)) else {
            return nil
        }
        return try? PropertyListSerialization.propertyList(from: data, format: nil)
    }

    /// Symbols matching `query`, ranked so exact and prefix matches come first.
    ///
    /// Matches the name, the dot-separated words in it, and the SF Symbols app's
    /// own keywords - so "trash" finds `trash.slash` and "bin" finds `trash`.
    static func search(_ query: String, in symbols: [Symbol] = all) -> [Symbol] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return symbols }

        var exact: [Symbol] = []
        var prefix: [Symbol] = []
        var contains: [Symbol] = []
        var keyword: [Symbol] = []

        for symbol in symbols {
            let name = symbol.name
            if name == needle {
                exact.append(symbol)
            } else if name.hasPrefix(needle) {
                prefix.append(symbol)
            } else if name.contains(needle) {
                contains.append(symbol)
            } else if symbol.keywords.contains(where: { $0.lowercased().contains(needle) }) {
                keyword.append(symbol)
            }
        }
        return exact + prefix + contains + keyword
    }

    /// The categories present in the catalog, in the order Apple lists them,
    /// paired with a symbol that represents each one.
    static let categoryNames: [(id: String, label: String)] = {
        guard let raw = plist(named: "categories.plist") as? [[String: Any]] else { return [] }
        return raw.compactMap { entry in
            guard let key = entry["key"] as? String else { return nil }
            let label = (entry["label"] as? String) ?? key.capitalized
            return (key, label)
        }
    }()
}

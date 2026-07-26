import Foundation

/// Compiles every custom SF Symbol used by an enabled favorite into a single
/// `Assets.car` inside the icon helper bundle.
///
/// 0.6.0 compiled one symbolset per generated app; 0.7.0 has exactly one helper
/// bundle, so the symbols are deduplicated by name (two favorites pointing at the
/// same SVG share one symbolset) and compiled in a single `xcrun actool` run.
///
/// ## Nothing is handed to `actool` as the user wrote it
///
/// Up to 1.0 this copied the stored SVG straight into the `.symbolset`, which only
/// works when the file already *is* a hand-made SF Symbols template - so an
/// ordinary logo failed with "must have a glyph for Regular weight Medium size"
/// and took every other custom icon in the same `actool` run down with it.
///
/// Now every icon, without exception, is parsed by `SymbolValidator.glyphGeometry`
/// and re-wrapped by `SymbolTemplateSynthesizer`:
///
/// * An **arbitrary SVG** becomes one flattened outline inside a synthesized
///   `Template v.7.0` scaffold.
/// * An **SVG that is already a template** - every custom icon stored by 0.5.0 and
///   0.6.0 - has its `Regular-S` glyph lifted out and re-wrapped the same way.
///   Passing such a file through untouched would also compile (measured: a
///   `Template v.6.0` file compiles on its own), but it is deliberately not done:
///   the app can only *preview* what it can parse, so a file it ships unparsed is
///   a file whose sidebar icon it cannot show. Re-synthesizing means one code path,
///   one scaffold whose every requirement was established by ablation, and a
///   preview that is the compiled glyph rather than a guess at it. The only thing
///   lost is per-weight artwork variation, and a sidebar icon is drawn at one
///   weight.
enum SymbolCatalogBuilder {
    struct Symbol: Hashable {
        /// Asset name inside `Assets.car`, and therefore the name
        /// `UTTypeIcons.UTTypeSymbolName` has to reference. Comes from
        /// `SymbolTemplateSynthesizer.uniqueSymbolName` - never from anything
        /// inside the user's file, which for an ordinary SVG carries no name at all.
        let name: String
        let svgURL: URL

        /// The favorite's optical size correction. Part of the symbol's identity,
        /// not a rendering option: one stored SVG used by two favorites at two
        /// scales is two symbolsets, which is why `IconHelperBundle` names them
        /// per (file, scale) rather than per file.
        let iconScale: CGFloat

        init(name: String, svgURL: URL, iconScale: CGFloat = CGFloat(Favorite.defaultIconScale)) {
            self.name = name
            self.svgURL = svgURL
            self.iconScale = iconScale
        }
    }

    /// Writes `Contents/Resources/Assets.car` inside `bundleURL`, or removes an
    /// existing one when there is nothing to compile.
    ///
    /// Returns the set of symbol names that actually made it into the catalog. A
    /// symbol whose SVG is missing, unreadable or unparseable is skipped rather
    /// than aborting the whole catalog, so the caller turns the difference between
    /// what it asked for and what came back into a per-favorite warning.
    ///
    /// Throws only when `actool` itself fails for every symbol - which is also the
    /// "no Xcode / no Command Line Tools installed" case, so callers are expected
    /// to degrade to a warning. The previously compiled catalog is left untouched
    /// on failure.
    @discardableResult
    static func synchronize(symbols: [Symbol], inBundleAt bundleURL: URL) throws -> Set<String> {
        let fileManager = FileManager.default
        let resourcesURL = bundleURL.appendingPathComponent("Contents/Resources")
        let assetsCarURL = resourcesURL.appendingPathComponent("Assets.car")

        func discardCatalog() throws {
            if fileManager.fileExists(atPath: assetsCarURL.path) {
                try fileManager.removeItem(at: assetsCarURL)
            }
        }

        // Deduplicate by name, dropping anything we cannot turn into a template.
        var staged: [(name: String, templateSVG: String)] = []
        var seen: Set<String> = []
        for symbol in symbols {
            guard isValidSymbolName(symbol.name),
                  SymbolTemplateSynthesizer.isAcceptableSymbolName(symbol.name) else {
                NSLog("SymbolCatalogBuilder: skipping unusable symbol name '\(symbol.name)'")
                continue
            }
            guard seen.insert(symbol.name).inserted else { continue }
            guard fileManager.fileExists(atPath: symbol.svgURL.path) else {
                NSLog("SymbolCatalogBuilder: skipping '\(symbol.name)': \(symbol.svgURL.lastPathComponent) is missing")
                continue
            }

            do {
                // The single parse the previews use too - see `glyphGeometry`.
                let geometry = try SymbolValidator.glyphGeometry(at: symbol.svgURL)
                staged.append((
                    symbol.name,
                    SymbolTemplateSynthesizer.synthesizeTemplate(
                        from: geometry,
                        symbolName: symbol.name,
                        iconScale: symbol.iconScale
                    )
                ))
            } catch {
                // One bad SVG must not cost every other favorite its icon.
                NSLog("SymbolCatalogBuilder: skipping '\(symbol.name)': \(error.localizedDescription)")
            }
        }

        guard !staged.isEmpty else {
            // Nothing to compile: drop a catalog left behind by an earlier build so
            // the helper does not ship dead assets.
            try discardCatalog()
            return []
        }

        do {
            try SymbolTemplateSynthesizer.compileSymbols(staged, to: resourcesURL)
            return Set(staged.map(\.name))
        } catch {
            // A synthesized template that `actool` still refuses is not something
            // the other favorites should pay for - the 1.0 bug was exactly this,
            // one unusable icon emptying the whole catalog. Find the survivors and
            // ship them; only a wholesale failure (no actool at all) propagates.
            guard staged.count > 1, let survivors = try? compilable(staged), !survivors.isEmpty else {
                throw error
            }
            try SymbolTemplateSynthesizer.compileSymbols(survivors, to: resourcesURL)
            return Set(survivors.map(\.name))
        }
    }

    /// The subset of `staged` that compiles, established one `actool` run at a
    /// time into a scratch directory. Only ever reached after a batch failure.
    private static func compilable(
        _ staged: [(name: String, templateSVG: String)]
    ) throws -> [(name: String, templateSVG: String)] {
        let fileManager = FileManager.default
        let probeDirectory = fileManager.temporaryDirectory
            .appendingPathComponent("SymbolProbe-\(UUID().uuidString)")
        try fileManager.createDirectory(at: probeDirectory, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: probeDirectory) }

        return staged.filter { symbol in
            do {
                try SymbolTemplateSynthesizer.compileSymbols([symbol], to: probeDirectory)
                return true
            } catch {
                NSLog("SymbolCatalogBuilder: '\(symbol.name)' will not compile: \(error.localizedDescription)")
                return false
            }
        }
    }

    /// A symbol name has to be usable as a single path component, because it names
    /// the `.symbolset` directory `actool` compiles.
    static func isValidSymbolName(_ name: String) -> Bool {
        !name.isEmpty
            && !name.hasPrefix(".")
            && !name.contains("/")
            && !name.contains(":")
            && !name.contains("\0")
    }
}

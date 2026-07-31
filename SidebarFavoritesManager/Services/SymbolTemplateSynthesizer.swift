import AppKit
import CoreGraphics
import Foundation

/// Builds an SF Symbols template around arbitrary vector artwork, then compiles
/// it with `actool`.
///
/// The user never sees any of this: they import an ordinary SVG, `SVGGeometryParser`
/// turns it into one `CGPath`, and this type wraps that path in the scaffolding
/// `actool` insists on. No SF Symbols app, no Illustrator, no template layers, no
/// descriptive-name field to get wrong.
///
/// ## What the scaffold has to contain
///
/// Established by ablation - 30+ variants compiled, each requirement proven by
/// removing it and watching `actool` fail:
///
/// * `<text id="template-version">` containing `Template v.7.0`. Without it (or
///   with a different version string) `actool` falls back to the legacy 9-glyph
///   format and fails with "must have a glyph for Regular weight Medium size".
/// * `<g id="Symbols">` holding **all three** of `Ultralight-S`, `Regular-S` and
///   `Black-S`. Any two alone fail.
/// * Six horizontal guides: `Baseline-S/M/L` and `Capline-S/M/L`. The M and L
///   *glyphs* are unnecessary, the M and L *guides* are not.
/// * Margin guides - either interpolatable left/right margins on all three
///   weights, or fixed margins on `Regular-S`. This emits the interpolatable set.
///
/// Everything Apple's own export carries beyond that (the Notes wrapper, the
/// `#artboard` rect, H-reference glyphs, weight-column labels, `viewBox`, the XML
/// prolog) is optional and omitted. The `<style>` block is worse than optional:
/// `SFSymbolsPreviewWireframe` perturbs the compiled glyph's bounding box, so it
/// is never emitted.
///
/// ## What the renderer silently refuses
///
/// `actool` compiles these without a word of warning and then renders nothing:
///
/// * embedded raster (`<image>`, base64 PNG) - handled upstream by
///   `SVGGeometryParser`, which drops it and reports that it did;
/// * un-outlined strokes - also handled upstream, by outlining them;
/// * `fill-rule="evenodd"` - ignored by the rasterizer, so even-odd artwork is
///   rewound here (`SVGPathWinding`) or its holes fill in solid.
enum SymbolTemplateSynthesizer {
    // MARK: - Artboard geometry (template units, 3300 x 2200 artboard)

    /// Baseline-S to Capline-S. Artwork scaled to exactly this height renders at
    /// the same size as a system symbol such as `square.fill`.
    static let capHeight: CGFloat = 70.459

    private static let baselines: [(size: String, y: CGFloat)] = [
        ("S", 696), ("M", 1126), ("L", 1556)
    ]
    private static let caplines: [(size: String, y: CGFloat)] = [
        ("S", 625.541), ("M", 1055.54), ("L", 1485.54)
    ]
    /// Left margin x of each weight column that the v.7.0 format requires.
    private static let columnX: [(weight: String, x: CGFloat)] = [
        ("Ultralight", 505.702), ("Regular", 1394.79), ("Black", 2877.35)
    ]
    /// Vertical extent of the margin guides.
    private static let marginTop: CGFloat = 600.785
    private static let marginBottom: CGFloat = 720.121
    /// Guide lines span the artboard horizontally.
    private static let guideLeft: CGFloat = 263
    private static let guideRight: CGFloat = 3036

    /// Side bearing used by Apple's own placeholder glyph, in template units.
    static let defaultSideBearing: CGFloat = 9.766

    /// How far past the capline the artwork is allowed to run, as a multiple of
    /// the cap height.
    ///
    /// System symbols are constrained *vertically* and overshoot the capline;
    /// measured by rendering each at 256px and taking its ink box, `gearshape.fill`
    /// runs to 1.14 cap heights, `star.fill` to 1.16, `doc.fill` to 1.17 and
    /// `hammer.fill` to 1.24. At 1.25 a synthesized glyph's ink box measures 222px
    /// tall in that same 256px render - exactly where `folder.fill` (222),
    /// `archivebox.fill` (222) and `star.fill` (225) sit.
    static let capOvershoot: CGFloat = 1.25

    /// The widest the artwork may be, in cap heights.
    ///
    /// Deliberately permissive. Finder does *not* clamp a system symbol to the
    /// width of the sidebar's icon column - `hammer.fill` visibly overhangs it -
    /// and every non-degenerate system symbol measured passes through this
    /// untouched (the widest, `eye.fill`, has an ink aspect of 1.61 against the
    /// 2.0 this allows). It exists only so that a 6:1 wordmark cannot run into the
    /// row's label.
    static let maximumWidth: CGFloat = 2.5

    /// Clear space the compiled symbol carries above and below its ink, in
    /// template units.
    ///
    /// Measured, not declared: a glyph whose art is exactly one cap height tall
    /// renders 185px of ink inside a 221px-tall symbol image, i.e. 18px of padding
    /// per side, which is 6.9 template units. Only `renderPreview` needs it - to
    /// draw the artwork at the fraction of its box the sidebar will draw it at,
    /// rather than at some other fraction that happens to look similar.
    private static let glyphVerticalPadding: CGFloat = 6.9

    /// Height the `.capBand` fit gives the artwork, in template units, once the
    /// caller's optical correction is applied.
    ///
    /// THE definition of what `iconScale` means, and deliberately the only one:
    /// `emitTemplate` divides the artwork's own height into this to get the glyph
    /// transform, and `renderBitmap` measures the preview against it. Two
    /// expressions of the same quantity would be two things to keep in step, and
    /// the preview drifting away from the compiled glyph is precisely the bug that
    /// makes a size slider useless.
    static func capBandArtHeight(iconScale: CGFloat) -> CGFloat {
        capHeight * capOvershoot * clampedIconScale(iconScale)
    }

    /// Guards the geometry against a scale the model should never have let
    /// through. `Favorite` clamps on assignment and on decode; this is the second
    /// wall, because a value arriving here from anywhere else - a future caller, a
    /// hand-edited config that got past the decoder - must not be able to produce
    /// a glyph that overruns the artboard or collapses to nothing.
    private static func clampedIconScale(_ value: CGFloat) -> CGFloat {
        CGFloat(Favorite.clampedIconScale(Double(value)))
    }

    /// Template units of glyph per unit of artwork under the `.capBand` fit.
    ///
    /// Factored out of `emitTemplate` so the preview can ask the same question the
    /// compiler answers instead of restating it. Restating it is how the preview
    /// came to ignore the width ceiling: a 6:1 wordmark compiled to 69% ink and
    /// previewed at 17%, and no amount of threading the scale through would have
    /// closed that, because the two were not computing the same quantity.
    private static func capBandScale(box: CGSize, iconScale: CGFloat) -> CGFloat {
        min(
            capBandArtHeight(iconScale: iconScale) / box.height,
            capHeight * maximumWidth / box.width
        )
    }

    /// Where the ink sits inside the symbol image `actool` will produce, as
    /// fractions of that image's height.
    ///
    /// The sidebar fits a symbol's image box to the row's icon height and lets the
    /// width fall where it may - which is why `hammer.fill` overhangs the icon
    /// column - so these two numbers are everything a preview needs in order to be
    /// the same picture at the same size.
    struct GlyphMetrics {
        /// Ink height over image height. Measured at 0.87 for square artwork at
        /// 100%, which is where `folder.fill` (0.86) and `star.fill` (0.87) sit.
        let inkHeightFraction: CGFloat
        /// Ink width over image *height*. Above 1 for artwork that overhangs.
        let inkWidthFraction: CGFloat
    }

    static func glyphMetrics(forArtworkBox box: CGSize, iconScale: CGFloat) -> GlyphMetrics {
        guard box.width > 0, box.height > 0, box.width.isFinite, box.height.isFinite else {
            return GlyphMetrics(inkHeightFraction: 1, inkWidthFraction: 1)
        }
        let scale = capBandScale(box: box, iconScale: iconScale)
        let artHeight = box.height * scale
        let artWidth = box.width * scale
        // The compiled symbol carries `glyphVerticalPadding` of clear space above
        // and below the ink and nothing horizontally, so the image is this tall.
        let imageHeight = artHeight + 2 * glyphVerticalPadding
        return GlyphMetrics(
            inkHeightFraction: artHeight / imageHeight,
            inkWidthFraction: artWidth / imageHeight
        )
    }

    /// How the artwork is scaled into the `Regular-S` guide box.
    enum Fit {
        /// Height drives the scale: the artwork fills the cap-height band with the
        /// overshoot system symbols use, and is scaled down further only to respect
        /// `maximumWidth`. The default, and what makes a custom icon sit at the same
        /// optical size as an SF Symbol next to it.
        ///
        /// The only fit the `iconScale` argument applies to, because it is the only
        /// one whose size is a judgement call. The three below say exactly what
        /// height they want and are left to mean it.
        case capBand
        /// Uniformly fit inside a cap-height square. Never wider than tall, but a
        /// wide source lands well short of a system symbol's height because WIDTH
        /// becomes the binding constraint - which is the whole reason it is no
        /// longer the default.
        case capBox
        /// Scale so the artwork's *height* is exactly the cap height, with no
        /// overshoot and no width ceiling.
        case capHeight
        /// `capBox`, scaled by a factor.
        case scaled(CGFloat)
    }

    enum SynthesisError: LocalizedError {
        case noSymbols
        case invalidSymbolName(String)
        case emptyGeometry(String)
        case actoolFailed(String)
        case noCatalogProduced

        var errorDescription: String? {
            switch self {
            case .noSymbols:
                return "There are no symbols to compile."
            case .invalidSymbolName(let name):
                return "'\(name)' cannot be used as a symbol name."
            case .emptyGeometry(let name):
                return "The artwork for '\(name)' is empty."
            case .actoolFailed(let detail):
                return "actool could not compile the icon catalog: \(detail)"
            case .noCatalogProduced:
                return "actool reported success but produced no Assets.car."
            }
        }
    }

    // MARK: - Template synthesis

    /// Wraps `path` in a compilable `Template v.7.0` document.
    ///
    /// `path` is expected in SVG space (y down), in any units - it is normalized
    /// by its own bounding box. `fillRule` comes from `SVGGeometryParser`; even-odd
    /// artwork is rewound to nonzero here because the symbol rasterizer ignores the
    /// attribute.
    static func synthesizeTemplate(from path: CGPath,
                                   fillRule: CGPathFillRule,
                                   symbolName: String) -> String {
        synthesizeTemplate(
            from: path,
            fillRule: fillRule,
            symbolName: symbolName,
            fit: .capBand,
            sideBearing: defaultSideBearing
        )
    }

    /// - Parameter iconScale: the favorite's optical correction. Multiplies the
    ///   height the `.capBand` fit asks for; the width ceiling is deliberately not
    ///   scaled with it, so a 6:1 wordmark turned up to 150% still stops at
    ///   `maximumWidth` cap heights instead of running into the row's label.
    static func synthesizeTemplate(from path: CGPath,
                                   fillRule: CGPathFillRule,
                                   symbolName: String,
                                   fit: Fit,
                                   sideBearing: CGFloat = defaultSideBearing,
                                   iconScale: CGFloat = CGFloat(Favorite.defaultIconScale)) -> String {
        emitTemplate(
            artwork: glyphPath(from: path, fillRule: fillRule),
            symbolName: symbolName,
            fit: fit,
            sideBearing: sideBearing,
            iconScale: iconScale
        )
    }

    /// Lays out artwork that is *already* nonzero-ready and writes the document.
    /// Nothing here re-winds anything: running the depth pass over a merged path
    /// would treat one shape sitting inside another as a hole and punch the very
    /// knockout `unionedGlyphPath` exists to avoid.
    private static func emitTemplate(artwork: CGPath,
                                     symbolName: String,
                                     fit: Fit,
                                     sideBearing: CGFloat,
                                     iconScale: CGFloat) -> String {
        let name = sanitizedSymbolName(symbolName)
        var glyphArtwork = artwork
        var box = artwork.boundingBoxOfPath

        if !box.width.isFinite || !box.height.isFinite || box.width <= 0 || box.height <= 0 {
            // A template with no glyph groups does not compile at all, so degenerate
            // artwork gets a visible placeholder frame instead. Failing here would
            // cost every *other* favorite its icon: one bad symbol must not take the
            // whole catalog down with it.
            glyphArtwork = placeholderArtwork()
            box = glyphArtwork.boundingBoxOfPath
        }

        let scale: CGFloat
        switch fit {
        case .capBand:
            // Height first, exactly like a real symbol: the artwork fills the cap
            // band and is allowed to be wider than tall. The width ceiling only
            // ever scales it down further, and only for artwork far wider than
            // anything in Apple's catalog.
            //
            // `iconScale` moves the height term and nothing else. Scaling the width
            // ceiling with it would let the one guard here be turned off from the
            // UI, which is the opposite of what a size control should be able to do.
            scale = capBandScale(box: box.size, iconScale: iconScale)
        case .capHeight:
            scale = capHeight / box.height
        case .capBox:
            scale = min(capHeight / box.width, capHeight / box.height)
        case .scaled(let factor):
            let clamped = max(factor, 0.01)
            scale = min(capHeight * clamped / box.width, capHeight * clamped / box.height)
        }

        let artWidth = box.width * scale
        let artHeight = box.height * scale
        let advance = artWidth + 2 * sideBearing
        // Centre on the cap band; the horizontal centring is implied by placing the
        // art one side bearing in from the left margin. Artwork taller than the band
        // makes this negative, which is the overshoot - above the capline and below
        // the baseline in equal measure, the way a round system symbol overshoots.
        let verticalPadding = (capHeight - artHeight) / 2

        var glyphs: [String] = []
        for column in columnX {
            let tx = column.x + sideBearing - box.minX * scale
            let ty = baselines[0].y - capHeight + verticalPadding - box.minY * scale
            let placement = CGAffineTransform(a: scale, b: 0, c: 0, d: scale, tx: tx, ty: ty)
            // Absolute artboard coordinates, no group transform: verified to
            // compile and render identically to Apple's matrix-carrying export.
            // 3 decimals of a template unit is ~0.0006 pt at sidebar size, and the
            // path data is emitted once per weight column - so the precision that
            // costs nothing visually costs a third of the file size.
            glyphs.append("""
              <g id="\(column.weight)-S">
               <path d="\(glyphArtwork.svgPathData(transform: placement, decimals: 3))"/>
              </g>
            """)
        }

        return document(name: name, advance: advance, glyphs: glyphs)
    }

    /// Square frame, drawn as an outer contour with a rewound inner one so nonzero
    /// filling leaves the middle open. Stands in for artwork that has no geometry -
    /// unmistakably a placeholder rather than a blank icon the user cannot see.
    private static func placeholderArtwork() -> CGPath {
        let path = CGMutablePath()
        let outer = CGRect(x: 0, y: 0, width: capHeight, height: capHeight)
        let inset = capHeight * 0.18
        path.addRect(outer)
        // Reversed winding: counter-clockwise outer, clockwise inner.
        let inner = outer.insetBy(dx: inset, dy: inset)
        path.move(to: CGPoint(x: inner.minX, y: inner.minY))
        path.addLine(to: CGPoint(x: inner.minX, y: inner.maxY))
        path.addLine(to: CGPoint(x: inner.maxX, y: inner.maxY))
        path.addLine(to: CGPoint(x: inner.maxX, y: inner.minY))
        path.closeSubpath()
        return path.copy() ?? path
    }

    /// The one place artwork is turned into glyph geometry, so a preview and the
    /// compiled symbol can never disagree.
    ///
    /// A glyph is a single nonzero-filled path. `SVGGeometryParser` already hands
    /// its output over in that form (`fillRule == .winding`), so this is a
    /// pass-through for imported SVGs - deliberately, because re-running the
    /// nesting pass over an already-merged path would read one shape sitting
    /// inside another as a hole and punch a knockout that is not in the source.
    ///
    /// Callers that bring their own `CGPath` - a font glyph, an in-app drawing -
    /// get the rewinding when, and only when, they say the artwork is even-odd.
    private static func glyphPath(from path: CGPath, fillRule: CGPathFillRule) -> CGPath {
        fillRule == .evenOdd ? SVGPathWinding.normalizedToNonZero(path) : path
    }

    /// Convenience for the common case: whatever `SVGGeometryParser` returned.
    /// Identical in every respect to passing `geometry.path` and
    /// `geometry.fillRule` to the call above.
    static func synthesizeTemplate(from geometry: SVGGeometry,
                                   symbolName: String,
                                   fit: Fit = .capBand,
                                   sideBearing: CGFloat = defaultSideBearing,
                                   iconScale: CGFloat = CGFloat(Favorite.defaultIconScale)) -> String {
        synthesizeTemplate(
            from: geometry.path,
            fillRule: geometry.fillRule,
            symbolName: symbolName,
            fit: fit,
            sideBearing: sideBearing,
            iconScale: iconScale
        )
    }

    private static func document(name: String, advance: CGFloat, glyphs: [String]) -> String {
        var guides: [String] = []
        for (index, baseline) in baselines.enumerated() {
            guides.append(guideLine(
                id: "Baseline-\(baseline.size)",
                x1: guideLeft, y1: baseline.y, x2: guideRight, y2: baseline.y
            ))
            let capline = caplines[index]
            guides.append(guideLine(
                id: "Capline-\(capline.size)",
                x1: guideLeft, y1: capline.y, x2: guideRight, y2: capline.y
            ))
        }
        for column in columnX {
            let left = column.x
            let right = column.x + advance
            guides.append(guideLine(
                id: "left-margin-\(column.weight)-S",
                x1: left, y1: marginTop, x2: left, y2: marginBottom
            ))
            guides.append(guideLine(
                id: "right-margin-\(column.weight)-S",
                x1: right, y1: marginTop, x2: right, y2: marginBottom
            ))
        }

        // `descriptive-name` is optional for actool - the asset's real name is the
        // `.symbolset` directory - but it is what the SF Symbols app shows when
        // someone opens the template, so it is emitted for legibility.
        return """
        <?xml version="1.0" encoding="UTF-8"?>
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3300 2200">
         <g id="Notes">
          <text id="template-version" style="stroke:none;fill:black;font-family:sans-serif;font-size:13;" transform="matrix(1 0 0 1 3036 1933)"><tspan x="0" y="0">Template v.7.0</tspan></text>
          <text id="descriptive-name" style="stroke:none;fill:black;font-family:sans-serif;font-size:13;" transform="matrix(1 0 0 1 3036 1969)"><tspan x="0" y="0">\(escaped(name))</tspan></text>
         </g>
         <g id="Guides">
        \(guides.joined(separator: "\n"))
         </g>
         <g id="Symbols">
        \(glyphs.joined(separator: "\n"))
         </g>
        </svg>

        """
    }

    private static func guideLine(id: String,
                                  x1: CGFloat, y1: CGFloat,
                                  x2: CGFloat, y2: CGFloat) -> String {
        func format(_ value: CGFloat) -> String { String(format: "%g", Double(value)) }
        return "  <line id=\"\(id)\" style=\"fill:none;stroke:#00AEEF;stroke-width:0.5;\""
            + " x1=\"\(format(x1))\" y1=\"\(format(y1))\" x2=\"\(format(x2))\" y2=\"\(format(y2))\"/>"
    }

    private static func escaped(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    // MARK: - Compilation

    private static let xcrunPath = "/usr/bin/xcrun"

    private static let rootContentsJSON = """
    {
      "info": {
        "version": 1,
        "author": "xcode"
      }
    }
    """

    /// Compiles every template into one `Assets.car` inside `destinationDirectory`.
    ///
    /// A symbol's runtime name is the `.symbolset` *directory* name - not the SVG
    /// file name and not `descriptive-name` - which is what
    /// `UTTypeIcons.UTTypeSymbolName` has to reference. All symbols go through a
    /// single `actool` invocation.
    ///
    /// The catalog is compiled into a temporary directory first and only moved
    /// into place on success, so a failed run never leaves the helper bundle
    /// without the assets it had.
    /// `compileSymbols` via the system's own engine, with no developer tools.
    ///
    /// The engine silently drops a template it cannot read - the compile reports
    /// success and the symbol is simply absent, which would leave a favorite with
    /// a plain folder and no explanation. Every template is pre-flighted, and a
    /// template that fails throws with the engine's own message so the caller's
    /// existing "find the survivors" path can drop just that one.
    private static func compileSymbolsInProcess(
        _ symbols: [(name: String, templateSVG: String)],
        to destinationDirectory: URL
    ) throws {
        let fileManager = FileManager.default
        let workDirectory = fileManager.temporaryDirectory
            .appendingPathComponent("SymbolCTD-\(UUID().uuidString)")
        try fileManager.createDirectory(at: workDirectory, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: workDirectory) }

        var templates: [String: URL] = [:]
        var staged: Set<String> = []
        for symbol in symbols {
            guard isAcceptableSymbolName(symbol.name) else {
                throw SynthesisError.invalidSymbolName(symbol.name)
            }
            guard staged.insert(symbol.name).inserted else { continue }

            let templateURL = workDirectory.appendingPathComponent("\(symbol.name).svg")
            try symbol.templateSVG.write(to: templateURL, atomically: true, encoding: .utf8)

            if let failure = CoreThemeCatalogWriter.validationFailure(forTemplateAt: templateURL) {
                throw SynthesisError.actoolFailed(failure)
            }
            templates[symbol.name] = templateURL
        }

        guard !templates.isEmpty else { throw SynthesisError.noSymbols }

        try fileManager.createDirectory(at: destinationDirectory, withIntermediateDirectories: true)
        try CoreThemeCatalogWriter.writeCatalog(
            at: destinationDirectory.appendingPathComponent("Assets.car"),
            symbols: templates,
            scratchDirectoryURL: workDirectory
        )
    }

    static func compileSymbols(_ symbols: [(name: String, templateSVG: String)],
                               to destinationDirectory: URL) throws {
        guard !symbols.isEmpty else { throw SynthesisError.noSymbols }

        // Preferred path: the asset-catalog engine that ships with macOS. `actool`
        // is only a front end for it and lives inside Xcode, so this is what lets
        // custom icons work on a machine that has never had Xcode installed.
        // Falls through to `actool` if the engine is missing or refuses.
        if CoreThemeCatalogWriter.isAvailable {
            do {
                try compileSymbolsInProcess(symbols, to: destinationDirectory)
                return
            } catch {
                NSLog("SymbolTemplateSynthesizer: in-process compile failed (\(error.localizedDescription)); falling back to actool")
            }
        }

        let fileManager = FileManager.default
        let workDirectory = fileManager.temporaryDirectory
            .appendingPathComponent("SymbolSynthesis-\(UUID().uuidString)")
        try fileManager.createDirectory(at: workDirectory, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: workDirectory) }

        let catalogURL = workDirectory.appendingPathComponent("Symbols.xcassets")
        try fileManager.createDirectory(at: catalogURL, withIntermediateDirectories: true)
        try rootContentsJSON.write(
            to: catalogURL.appendingPathComponent("Contents.json"),
            atomically: true,
            encoding: .utf8
        )

        var staged: Set<String> = []
        for symbol in symbols {
            guard isAcceptableSymbolName(symbol.name) else {
                throw SynthesisError.invalidSymbolName(symbol.name)
            }
            // Two favorites pointing at the same artwork share one symbolset; the
            // first template wins, which is why names come from `uniqueSymbolName`.
            guard staged.insert(symbol.name).inserted else { continue }

            let symbolsetURL = catalogURL.appendingPathComponent("\(symbol.name).symbolset")
            try fileManager.createDirectory(at: symbolsetURL, withIntermediateDirectories: true)
            try symbol.templateSVG.write(
                to: symbolsetURL.appendingPathComponent("\(symbol.name).svg"),
                atomically: true,
                encoding: .utf8
            )
            try symbolsetContentsJSON(for: symbol.name).write(
                to: symbolsetURL.appendingPathComponent("Contents.json"),
                atomically: true,
                encoding: .utf8
            )
        }

        let outputDirectory = workDirectory.appendingPathComponent("compiled")
        try fileManager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

        let result = ProcessRunner.run(xcrunPath, [
            "actool",
            catalogURL.path,
            "--compile", outputDirectory.path,
            "--platform", "macosx",
            "--minimum-deployment-target", "13.0",
            "--output-format", "human-readable-text"
        ])

        guard result.succeeded else {
            throw SynthesisError.actoolFailed(
                result.output.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        }

        let compiled = outputDirectory.appendingPathComponent("Assets.car")
        guard fileManager.fileExists(atPath: compiled.path) else {
            throw SynthesisError.noCatalogProduced
        }

        try fileManager.createDirectory(at: destinationDirectory, withIntermediateDirectories: true)
        let installed = destinationDirectory.appendingPathComponent("Assets.car")

        // Swap the catalog in rather than deleting and re-copying: a failure
        // between the two would leave the helper bundle with no assets at all.
        if fileManager.fileExists(atPath: installed.path) {
            if (try? fileManager.replaceItemAt(installed, withItemAt: compiled)) == nil {
                try fileManager.removeItem(at: installed)
                try fileManager.copyItem(at: compiled, to: installed)
            }
        } else {
            try fileManager.copyItem(at: compiled, to: installed)
        }
    }

    private static func symbolsetContentsJSON(for name: String) -> String {
        """
        {
          "info": {
            "version": 1,
            "author": "xcode"
          },
          "symbols": [
            {
              "filename": "\(name).svg",
              "idiom": "universal"
            }
          ]
        }
        """
    }

    // MARK: - Symbol names

    /// Namespace every generated symbol so it can never collide with a name in
    /// Apple's catalog (nothing there starts with `custom.`).
    static let namespacePrefix = "custom."

    private static let maximumNameLength = 64

    /// Folds any user-facing string - a file name, a favorite's title, pasted
    /// text - into something `actool` and Launch Services both accept: lowercase
    /// ASCII letters, digits and dots.
    ///
    /// Idempotent, so it is safe to run over a name this function produced.
    static func sanitizedSymbolName(_ raw: String) -> String {
        var base = raw.trimmingCharacters(in: .whitespacesAndNewlines)

        // A dropped file usually arrives as "Company Logo.svg".
        for suffix in [".svg", ".svgz", ".pdf", ".png"] where base.lowercased().hasSuffix(suffix) {
            base = String(base.dropLast(suffix.count))
            break
        }

        var folded = base.folding(options: [.diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .lowercased()

        // Anything outside the allowed set becomes a separator, then runs of
        // separators collapse - "My  Logo (2)!" -> "my.logo.2".
        folded = String(folded.map { character in
            if (character >= "a" && character <= "z") || (character >= "0" && character <= "9") {
                return character
            }
            return "."
        })
        var components = folded.split(separator: ".").map(String.init)

        // Drop a namespace prefix that is already there so re-sanitizing is a no-op.
        let prefixComponent = String(namespacePrefix.dropLast())
        if components.first == prefixComponent { components.removeFirst() }

        // Launch Services and actool are both happier with a leading letter.
        if let first = components.first, first.first?.isLetter != true {
            components[0] = "s\(first)"
        }

        var name = ([prefixComponent] + components).joined(separator: ".")
        if components.isEmpty { name = "\(prefixComponent).icon" }
        if name.count > maximumNameLength { name = String(name.prefix(maximumNameLength)) }
        while name.hasSuffix(".") { name.removeLast() }
        return name
    }

    /// `sanitizedSymbolName`, plus a numeric suffix when the name is taken. Two
    /// favorites called "logo" must not share one symbolset.
    static func uniqueSymbolName(_ raw: String, avoiding taken: Set<String>) -> String {
        let base = sanitizedSymbolName(raw)
        guard taken.contains(base) else { return base }

        // `base` has already been truncated to the length cap, so the suffix has
        // to be made room for rather than appended: a 66-character name is one
        // `isAcceptableSymbolName` rejects, and the symbol is then dropped from
        // the helper bundle and that favorite falls back to the folder icon. The
        // usual way to hit this is one long-named artwork used at two icon
        // scales, which always takes the ".2" suffix.
        func suffixed(_ suffix: String) -> String {
            var stem = base
            let limit = max(1, maximumNameLength - suffix.count - 1)
            if stem.count > limit { stem = String(stem.prefix(limit)) }
            while stem.hasSuffix(".") { stem.removeLast() }   // never produce ".."
            if stem.isEmpty { stem = String(namespacePrefix.dropLast()) }
            return "\(stem).\(suffix)"
        }

        var counter = 2
        while true {
            let candidate = suffixed(String(counter))
            if !taken.contains(candidate) { return candidate }
            counter += 1
            if counter > 9999 { return suffixed(UUID().uuidString.prefix(8).lowercased()) }
        }
    }

    /// The names this type is willing to hand to `actool`.
    static func isAcceptableSymbolName(_ name: String) -> Bool {
        guard !name.isEmpty, name.count <= maximumNameLength else { return false }
        guard !name.hasPrefix("."), !name.hasSuffix("."), !name.contains("..") else { return false }
        return name.allSatisfy { character in
            (character >= "a" && character <= "z")
                || (character >= "0" && character <= "9")
                || character == "."
        }
    }

    // MARK: - Preview

    /// Renders the artwork the way the sidebar will: a monochrome template, fitted
    /// the same way `synthesizeTemplate` fits it, so what the user approves in the
    /// picker is what Finder ends up drawing.
    ///
    /// Colour is not an option anywhere in this pipeline - a sidebar icon is always
    /// a template, so the artwork becomes a silhouette. Showing it in colour in the
    /// UI would be a lie.
    /// How much horizontal room the slot drawing this preview has, as a multiple
    /// of its height.
    enum PreviewSlot {
        /// A square slot. Artwork wider than tall is scaled down to fit rather
        /// than clipped, which understates it - the right trade for a fixed-size
        /// thumbnail whose job is identification.
        case square
        /// Room to overhang, the way Finder lets a wide symbol overhang the
        /// sidebar's icon column.
        ///
        /// Required anywhere the *size* is being judged. In a square slot any mark
        /// wider than about 1.16:1 is width-bound, and a width-bound preview shows
        /// the same picture at every scale - so a size control previewed in a
        /// square slot appears to do nothing for exactly the wide artwork that
        /// needs correcting most.
        case overhanging

        /// The overhanging allowance is chosen against two limits, in this order.
        ///
        /// It must never bind before the glyph's own `maximumWidth` ceiling does:
        /// if it did, widening the artwork would start *shrinking* the preview,
        /// and a control that runs backwards is worse than one that stands still.
        /// Measured against that, anything from about 4.75 downwards is unsafe at
        /// 100% and about 5.4 is the limit at 50%.
        ///
        /// Below that it is simply how wide a mark still previews at exactly its
        /// compiled size: 4.1 covers everything up to 6:1. Past 6:1 the width
        /// ceiling has frozen the glyph anyway - the preview stops matching in
        /// absolute size but still, correctly, stops responding to the slider.
        var widthAllowance: CGFloat {
            switch self {
            case .square: return 1
            case .overhanging: return 4.1
            }
        }
    }

    /// - Parameter iconScale: the same correction `synthesizeTemplate` is given.
    ///   Both sides get their fit from `capBandScale`, so a preview and the
    ///   compiled glyph cannot end up at different sizes.
    /// - Parameter slot: see `PreviewSlot`. The returned image is `size` tall and
    ///   as wide as the artwork needs, up to the slot's allowance.
    static func previewImage(for path: CGPath,
                             fillRule: CGPathFillRule,
                             size: CGFloat,
                             iconScale: CGFloat = CGFloat(Favorite.defaultIconScale),
                             slot: PreviewSlot = .square) -> NSImage {
        renderPreview(
            artwork: glyphPath(from: path, fillRule: fillRule),
            size: size,
            iconScale: iconScale,
            slot: slot
        )
    }

    /// Preview straight from a parse result - the same geometry
    /// `synthesizeTemplate` compiles, so the picker cannot show something the
    /// sidebar will not draw.
    static func previewImage(for geometry: SVGGeometry,
                             size: CGFloat,
                             iconScale: CGFloat = CGFloat(Favorite.defaultIconScale),
                             slot: PreviewSlot = .square) -> NSImage {
        previewImage(
            for: geometry.path,
            fillRule: geometry.fillRule,
            size: size,
            iconScale: iconScale,
            slot: slot
        )
    }

    private static func renderPreview(artwork: CGPath,
                                      size: CGFloat,
                                      iconScale: CGFloat,
                                      slot: PreviewSlot) -> NSImage {
        let side = max(size, 1)
        // 2x, so the silhouette stays crisp on a Retina display.
        let pixels = Int((side * 2).rounded())
        let image = NSImage(size: NSSize(width: side, height: side))

        if let rendered = renderBitmap(
            artwork: artwork,
            pixels: pixels,
            iconScale: iconScale,
            slot: slot
        ) {
            let representation = NSBitmapImageRep(cgImage: rendered.image)
            let pointSize = NSSize(width: side * rendered.aspect, height: side)
            representation.size = pointSize
            image.addRepresentation(representation)
            // After the representation, not before: an explicit size set first can
            // be recomputed from the rep that follows it. Callers lay their slot
            // out from `size`, so it has to be the size actually drawn.
            image.size = pointSize
        }

        image.isTemplate = true
        return image
    }

    /// Fills `artwork` into a bitmap `pixels` tall at the same size relative to its
    /// box that `emitTemplate` gives the compiled glyph, so the preview and the
    /// sidebar are two renderings of one silhouette rather than two near-misses.
    ///
    /// Returns the bitmap and its aspect, because the canvas is only square when
    /// the slot says it has to be - see `PreviewSlot`.
    private static func renderBitmap(
        artwork: CGPath,
        pixels: Int,
        iconScale: CGFloat,
        slot: PreviewSlot
    ) -> (image: CGImage, aspect: CGFloat)? {
        let side = CGFloat(max(pixels, 1))

        // Degenerate artwork previews as the same placeholder frame the template
        // would compile, so the picker never shows an empty square for something
        // that will not be empty.
        var artwork = artwork
        if !artwork.boundingBoxOfPath.width.isFinite || artwork.boundingBoxOfPath.isEmpty {
            artwork = placeholderArtwork()
        }

        let box = artwork.boundingBoxOfPath
        guard box.width > 0, box.height > 0, box.width.isFinite, box.height.isFinite else {
            return nil
        }

        // The compiled glyph's own proportions, asked of the function that
        // computes them for `emitTemplate` rather than restated here. This is what
        // carries the width ceiling into the preview: artwork the ceiling holds
        // back reports a smaller ink fraction, and so previews smaller, without
        // this function knowing a ceiling exists.
        let metrics = glyphMetrics(forArtworkBox: box.size, iconScale: iconScale)
        // The sidebar fits the symbol's image box to the row's icon height, so the
        // preview's height IS that image height and the ink takes its fraction.
        let heightFit = side * metrics.inkHeightFraction / box.height
        // Only ever scales down, and only when the artwork would outrun the room
        // the slot has. `.overhanging` sets the allowance high enough that this
        // never binds before the glyph's own ceiling does, so it cannot invert the
        // size control; `.square` accepts that it binds early, because a fixed
        // square thumbnail has nowhere else to put the overhang.
        let widthFit = side * slot.widthAllowance / box.width
        let fit = min(heightFit, widthFit)

        let canvasWidth = max(side, min(box.width * fit, side * slot.widthAllowance))
        let width = Int(canvasWidth.rounded())
        let height = Int(side.rounded())

        guard width > 0, height > 0, let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }

        context.setAllowsAntialiasing(true)
        context.setShouldAntialias(true)
        context.interpolationQuality = .high
        // Work in y-down space so the same fitting maths as the template applies.
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)

        let placement = CGAffineTransform(
            a: fit, b: 0, c: 0, d: fit,
            tx: CGFloat(width) / 2 - box.midX * fit,
            ty: CGFloat(height) / 2 - box.midY * fit
        )
        var transform = placement
        if let placed = artwork.copy(using: &transform) {
            context.addPath(placed)
            context.setFillColor(NSColor.black.cgColor)
            // Normalized geometry is correct under nonzero - which is the only
            // rule the symbol rasterizer has.
            context.fillPath(using: .winding)
        }

        guard let image = context.makeImage() else { return nil }
        return (image, CGFloat(width) / CGFloat(height))
    }
}

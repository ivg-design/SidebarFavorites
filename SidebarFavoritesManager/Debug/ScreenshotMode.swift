#if DEBUG
import SwiftUI
import AppKit

// MARK: - Offscreen screenshot mode (Debug builds only)
//
//   SBF_SCREENSHOTS=<dir> SBF_SUPPORT_DIR=<sandbox dir> "SidebarFavorites Manager"
//
// Renders every window the app has on sample data, far outside all displays, without ever
// activating the app, making a window key, or touching the real sidebar / config.
// Each window is captured by id (screencapture -l, then CGWindowListCreateImage, then an
// in-process cacheDisplay at 2x), written as <name>.png, and the app quits.
// scripts/docs-screenshots.sh drives it and frames the results.

enum ScreenshotMode {
    static var isActive: Bool { ProcessInfo.processInfo.environment["SBF_SCREENSHOTS"] != nil }
    static var symbolBrowserQuery = ""
    static var newFavoriteCustom = false
    /// What the Finder Sync helper rows report in screenshots (the sandbox has no real helper).
    static var helperStatus: FinderSyncAppGenerator.HelperStatus = .enabled
    static let samplesRoot = "/private/tmp/SBF-samples"

    /// ~/Name as the user would see it  ->  the sandbox copy that really exists.
    static func sandboxedPath(_ path: String) -> String {
        guard isActive else { return path }
        let home = NSHomeDirectory() + "/"
        return path.hasPrefix(home) ? samplesRoot + "/" + path.dropFirst(home.count) : path
    }
    /// Display only: the sandbox support folder shown as the real ~/Library location.
    static func displayPath(_ path: String) -> String {
        guard isActive, let r = path.range(of: "/Application Support/") else { return path }
        return "~/Library" + path[r.lowerBound...]
    }
}

@main
struct DebugEntry {
    static func main() {
        if ScreenshotMode.isActive {
            MainActor.assumeIsolated { ScreenshotRunner.start() }
        } else {
            SidebarFavoritesManagerApp.main()
        }
    }
}

/// A window that never becomes key, is never pulled back onto a screen, and draws as the
/// active window (coloured traffic lights) without being it.
private final class OffscreenWindow: NSWindow {
    var drawsActive = true
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
    override var isKeyWindow: Bool { drawsActive }
    override var isMainWindow: Bool { drawsActive }
    // Private AppKit hooks the title bar and controls consult to pick the coloured (active) look.
    @objc(_hasActiveAppearance) func hasActiveAppearanceHook() -> Bool { drawsActive }
    @objc(_hasKeyAppearance) func hasKeyAppearanceHook() -> Bool { drawsActive }
    @objc(hasKeyAppearance) func hasKeyAppearanceHook2() -> Bool { drawsActive }
    @objc(hasMainAppearance) func hasMainAppearanceHook() -> Bool { drawsActive }
    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect { frameRect }
}

private final class OffscreenPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect { frameRect }
}

@MainActor
private final class RunnerDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        Task { @MainActor in
            await ScreenshotRunner.runAll()
            exit(0)
        }
    }
}

@MainActor
enum ScreenshotRunner {
    private static let delegate = RunnerDelegate()
    private static let origin = NSPoint(x: -30000, y: -30000)

    static func start() {
        UserDefaults.standard.set("WhenScrolling", forKey: "AppleShowScrollBars")   // overlay scrollers, no bars in shots
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)   // no Dock icon, no menu bar, never frontmost
        app.delegate = delegate
        app.run()
    }

    // MARK: Sample data

    private static var samplesRoot: String { ScreenshotMode.samplesRoot }

    private static func fav(_ name: String, _ path: String, _ symbol: String, enabled: Bool = true,
                            mode: Favorite.Mode = .regular, custom: String? = nil) -> Favorite {
        Favorite(name: name, folderPath: path, iconType: custom == nil ? .sfSymbol : .custom,
                 iconValue: symbol, customSVGPath: custom, enabled: enabled,
                 sidebarProvenance: .managed, mode: mode)
    }

    private static func sampleFavorites(advanced: Bool = true) -> [Favorite] {
        var list = [
            fav("Projects", "~/Projects", "hammer.fill"),
            fav("Clients", "~/Clients", "person.2.fill"),
            fav("Invoices", "~/Invoices", "doc.text.fill"),
            fav("Screenshots", "~/Screenshots", "camera.viewfinder"),
            fav("Brand Assets", "~/Brand Assets", "square.on.circle", custom: "brand-mark.svg"),
            fav("Music", "~/Music", "music.note", mode: advanced ? .advanced : .regular),
            fav("Archive", "~/Archive", "archivebox.fill", enabled: false),
        ]
        list[3].sidebarProvenance = .adopted
        return list
    }

    private static func install(_ favorites: [Favorite], restartBanner: Bool = false, warnings: [String] = []) {
        var cfg = Config()
        cfg.favorites = favorites
        ConfigManager.shared.debugReplaceConfig(cfg)
        var bound: [UUID: UInt32] = [:]
        for (i, f) in favorites.enumerated() where f.enabled && f.name != "Screenshots" { bound[f.id] = UInt32(100 + i) }
        // "Screenshots" is the row Finder already had (adopted): bound too.
        if let s = favorites.first(where: { $0.name == "Screenshots" }) { bound[s.id] = 90 }
        FavoriteSyncCoordinator.shared.debugSetState(boundItems: bound, warnings: warnings, needsFinderRestart: restartBanner)
    }

    private static func writeSampleFiles() {
        let fm = FileManager.default
        let icons = ConfigManager.shared.iconsDirectoryURL
        // A simple one-colour mark.
        let svg = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
          <path d="M32 6l7.4 15.6 17.1 2.2-12.6 11.8 3.2 16.9L32 44.1 16.9 52.5l3.2-16.9L7.5 23.8l17.1-2.2z" fill="#000000"/>
          <circle cx="32" cy="30" r="5" fill="#ffffff"/>
        </svg>
        """
        try? svg.write(to: icons.appendingPathComponent("brand-mark.svg"), atomically: true, encoding: .utf8)
        // A folder that carries its own icon, for the "custom icon of its own" notice.
        let own = samplesRoot + "/Client Files"
        try? fm.createDirectory(atPath: own, withIntermediateDirectories: true)
        let img = NSImage(systemSymbolName: "briefcase.fill", accessibilityDescription: nil) ?? NSImage()
        NSWorkspace.shared.setIcon(img, forFile: own, options: [])
    }

    // MARK: Shot list

    private struct Shot {
        enum Chrome { case main, titled(String), sheet }
        let name: String
        var dark = false
        var chrome: Chrome
        var landing = false              // bare, square window capture for the landing page (site name, no framing)
        var size: NSSize? = nil          // nil -> the view's fitting size
        var settle: Double = 1.2
        var prepare: () -> Void
        let view: () -> AnyView
    }

    private static func env<V: View>(_ v: V) -> AnyView {
        AnyView(v.environmentObject(ConfigManager.shared).environmentObject(FavoriteSyncCoordinator.shared))
    }
    private static func editor(_ fav: Favorite?) -> AnyView {
        env(AddEditFavoriteSheet(favorite: fav, onApply: { _ in nil }, onSave: { _ in }))
    }
    private static func mainView() -> AnyView {
        env(ContentView(showingAddSheet: .constant(false)))
    }

    private static func shots() -> [Shot] {
        let populated = sampleFavorites()
        var projectsBefore = fav("Projects", "~/Projects", "folder.fill")
        projectsBefore.sidebarProvenance = .managed
        var projectsAfter = projectsBefore; projectsAfter.iconValue = "hammer.fill"
        var both = fav("Music", "~/Music", "music.note", mode: .advanced)
        both.sidebarProvenance = .managed
        let custom = populated[4]
        let own = fav("Client Files", "~/Client Files", "briefcase.fill")

        let plan = MigrationService.MigrationPlan(
            legacyApps: [
                .init(url: URL(fileURLWithPath: "/Users/you/Library/Application Support/SidebarFavorites/Apps/Projects.app"),
                      displayName: "Projects", bundleIdentifier: "com.ivg-design.sbf.projects", extensionIdentifier: "com.ivg-design.sbf.projects.IconAppSync"),
            ],
            entriesLeftInPlace: [], favoritesCarriedOver: 3, codesToAssign: 3, fromVersion: 1, toVersion: 3,
            configURL: URL(fileURLWithPath: "/Users/you/Library/Application Support/SidebarFavorites/config.json"),
            configBackupURL: URL(fileURLWithPath: "/Users/you/Library/Application Support/SidebarFavorites/config.pre-1.0.json"),
            configExists: true)

        var list: [Shot] = []
        func add(_ s: Shot) { list.append(s) }

        add(Shot(name: "main-window", chrome: .main, size: NSSize(width: 520, height: 600), prepare: { install(populated) }, view: mainView))
        add(Shot(name: "main-window-dark", dark: true, chrome: .main, size: NSSize(width: 520, height: 600), prepare: { install(populated) }, view: mainView))
        add(Shot(name: "main-window-empty", chrome: .main, size: NSSize(width: 520, height: 400), prepare: { install([]) }, view: mainView))
        add(Shot(name: "main-window-notices", chrome: .main, size: NSSize(width: 520, height: 690),
                 prepare: { install(populated, restartBanner: true,
                                    warnings: ["'Archive' points at ~/Archive, which no longer exists. The link was cleared."]) }, view: mainView))
        add(Shot(name: "editor-add", chrome: .titled("Add Favorite"), size: NSSize(width: 480, height: 900), prepare: { install(populated) }, view: { editor(nil) }))
        add(Shot(name: "editor-icon-before", chrome: .titled("Edit Favorite"), size: NSSize(width: 480, height: 900), prepare: { install([projectsBefore]) }, view: { editor(projectsBefore) }))
        add(Shot(name: "editor-icon-after", chrome: .titled("Edit Favorite"), size: NSSize(width: 480, height: 900), prepare: { install([projectsAfter]) }, view: { editor(projectsAfter) }))
        add(Shot(name: "editor-icon-after-dark", dark: true, chrome: .titled("Edit Favorite"), size: NSSize(width: 480, height: 900), prepare: { install([projectsAfter]) }, view: { editor(projectsAfter) }))
        add(Shot(name: "editor-both-icons", chrome: .titled("Edit Favorite"), size: NSSize(width: 480, height: 1010), prepare: { install([both]) }, view: { editor(both) }))
        add(Shot(name: "editor-own-icon", chrome: .titled("Edit Favorite"), size: NSSize(width: 480, height: 1090), prepare: { install([own]) }, view: { editor(own) }))
        add(Shot(name: "editor-custom-svg", chrome: .titled("Edit Favorite"), size: NSSize(width: 480, height: 960), prepare: { install([custom]) }, view: { editor(custom) }))
        add(Shot(name: "symbol-browser", chrome: .sheet, size: nil, settle: 4,
                 prepare: { ScreenshotMode.symbolBrowserQuery = "hammer" }, view: { env(SymbolBrowserSheet(currentSymbol: "hammer.fill", onPick: { _ in })) }))
        add(Shot(name: "symbol-browser-search", chrome: .sheet, size: nil, settle: 4,
                 prepare: { ScreenshotMode.symbolBrowserQuery = "folder" }, view: { env(SymbolBrowserSheet(currentSymbol: "folder.fill", onPick: { _ in })) }))
        add(Shot(name: "symbol-browser-dark", dark: true, chrome: .sheet, size: nil, settle: 4,
                 prepare: { ScreenshotMode.symbolBrowserQuery = "music" }, view: { env(SymbolBrowserSheet(currentSymbol: "music.note", onPick: { _ in })) }))
        add(Shot(name: "settings", chrome: .titled("Settings"), prepare: { install(sampleFavorites(advanced: false)) }, view: { env(SettingsView()) }))
        add(Shot(name: "settings-helpers", chrome: .titled("Settings"), prepare: { ScreenshotMode.helperStatus = .enabled; install(populated) }, view: { env(SettingsView()) }))
        add(Shot(name: "settings-helper-not-registered", chrome: .titled("Settings"), prepare: { ScreenshotMode.helperStatus = .notRegistered; install(populated) }, view: { env(SettingsView()) }))
        add(Shot(name: "migration-consent", chrome: .sheet, prepare: { install(populated) },
                 view: { env(MigrationConsentSheet(plan: plan, onUpgrade: {}, onDecline: {})) }))
        add(Shot(name: "menu-bar-menu", chrome: .sheet, size: NSSize(width: 270, height: 302), prepare: { install(populated) }, view: { AnyView(MenuMock(favorites: populated)) }))

        // ---- Landing-page set: dark, bare square window captures under the site's own file names ----
        // (design/assets/<name>.png -> web/scripts/generate-images.mjs). Sizes follow the old captures' point size.
        let darkCustom: Favorite = { var f = custom; f.iconScale = 0.9; return f }()
        var ownAdvanced = own; ownAdvanced.mode = .advanced
        func L(_ name: String, _ chrome: Shot.Chrome, _ size: NSSize?, settle: Double = 1.4, favs: [Favorite]? = nil,
               view: @escaping () -> AnyView) {
            add(Shot(name: name, dark: true, chrome: chrome, landing: true, size: size, settle: settle,
                     prepare: { ScreenshotMode.helperStatus = .enabled; install(favs ?? populated) }, view: view))
        }
        // Five rows, none in Both-icons mode: at the default 400 pt the chip makes the name wrap mid-word (noted for the owner).
        let five = [populated[0], populated[1], populated[2], populated[4], populated[6]]
        L("SBFMainWindow", .main, NSSize(width: 400, height: 532), favs: five, view: mainView)
        L("SBFAddFavoriteWindow", .titled("Add Favorite"), NSSize(width: 441, height: 894), view: { editor(nil) })
        L("SBFSettings", .titled("Settings"), nil, view: { env(SettingsView()) })
        L("SFSymbolBrowser", .sheet, NSSize(width: 520, height: 560), settle: 4, view: { env(SymbolBrowserSheet(currentSymbol: "folder.fill", onPick: { _ in })) })
        L("SBFUpdateNotification", .main, NSSize(width: 401, height: 533), favs: five, view: { env(UpdateOverlay(base: mainView())) })
        L("custom-svg-settings", .titled("Edit Favorite"), NSSize(width: 468, height: 985), favs: [darkCustom], view: { editor(darkCustom) })
        L("SVGImport", .titled("Add Favorite"), NSSize(width: 470, height: 790), view: { editor(nil) })
        L("SBFAddFavoriteWithExistingIcon", .titled("Add Favorite"), NSSize(width: 465, height: 1071), favs: [own], view: { editor(own) })
        L("SBFAddFavoriteAdvancedSuccess", .titled("Add Favorite"), NSSize(width: 441, height: 987), favs: [ownAdvanced], view: { editor(ownAdvanced) })
        return list
    }

    private static let alerts: [(name: String, title: String, text: String, buttons: [String], style: NSAlert.Style)] = [
        ("alert-update", "A new version is available",
         "SidebarFavorites 1.2.3 is out. You have \(UpdateChecker.runningVersion).", ["Download", "Later"], .informational),
        ("alert-remove-favorite", "Remove \"Projects\"?",
         "This removes it from Finder's sidebar.", ["Remove", "Cancel"], .warning),
        ("alert-turn-off", "Turn Off \"Projects\"?",
         "This app added this row to Finder's sidebar. Turning it off removes the row entirely; turning it back on re-adds it at the bottom of the list, not its original position.",
         ["Turn Off and Remove Row", "Cancel"], .warning),
        ("alert-remove-all", "Remove All Sidebar Icons?",
         "Removes 5 rows this app added to Finder's sidebar.\nClears the custom icon on 1 row you added yourself; the row stays in Finder.\nDeletes the icon helper bundle.\nThis cannot be undone.",
         ["Remove All Sidebar Icons", "Cancel"], .warning),
    ]

    // MARK: Run

    static func runAll() async {
        let outDir = ProcessInfo.processInfo.environment["SBF_SCREENSHOTS"]!
        try? FileManager.default.createDirectory(atPath: outDir + "/landing", withIntermediateDirectories: true)
        NSLog("[sbf-shots] support dir: %@", ConfigManager.shared.appSupportURL.path)
        guard ProcessInfo.processInfo.environment["SBF_SUPPORT_DIR"] != nil else {
            print("[sbf-shots] refusing to run without SBF_SUPPORT_DIR (sandbox)"); return
        }
        writeSampleFiles()
        let onlyRaw = ProcessInfo.processInfo.environment["SBF_ONLY"] ?? ""
        let only: [String]? = onlyRaw.isEmpty ? nil : onlyRaw.split(separator: ",").map(String.init)

        for shot in shots() where only == nil || only!.contains(shot.name) {
            shot.prepare()
            ScreenshotMode.newFavoriteCustom = shot.name == "SVGImport"
            let window = makeWindow(for: shot)
            let radius: Int
            switch shot.chrome { case .main, .titled: radius = 16; case .sheet: radius = shot.name == "menu-bar-menu" ? 10 : 26 }
            await present(window, name: shot.name, settle: shot.settle, outDir: shot.landing ? outDir + "/landing" : outDir, radius: radius, dark: shot.dark)
        }
        for a in alerts where only == nil || only!.contains(a.name) {
            let alert = NSAlert()
            alert.messageText = a.title; alert.informativeText = a.text; alert.alertStyle = a.style
            a.buttons.forEach { alert.addButton(withTitle: $0) }
            alert.layout()
            // Re-home the alert's real content view in an offscreen window we control.
            let src = alert.window
            let content = src.contentView!
            let size = content.frame.size
            src.contentView = NSView()
            let w = OffscreenWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.titled, .fullSizeContentView],
                                    backing: .buffered, defer: false)
            w.titlebarAppearsTransparent = true; w.titleVisibility = .hidden
            [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton].forEach { w.standardWindowButton($0)?.isHidden = true }
            w.contentView = content
            w.isReleasedWhenClosed = false
            w.setContentSize(size)
            w.appearance = NSAppearance(named: .aqua)
            await present(w, name: a.name, settle: 0.6, outDir: outDir, radius: 26, dark: false)
        }
    }

    private static func makeWindow(for shot: Shot) -> NSWindow {
        var root = shot.view()
        if case .sheet = shot.chrome { root = AnyView(root.ignoresSafeArea()) }   // sheets have no title bar inset
        let host = NSHostingController(rootView: root)
        if case .sheet = shot.chrome { host.sizingOptions = [] }   // frame is set explicitly below
        let w: NSWindow
        switch shot.chrome {
        case .main:
            w = OffscreenWindow(contentRect: .zero, styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                                backing: .buffered, defer: false)
            w.titlebarAppearsTransparent = true; w.titleVisibility = .hidden
        case .titled(let title):
            w = OffscreenWindow(contentRect: .zero, styleMask: [.titled, .closable, .miniaturizable, .resizable],
                                backing: .buffered, defer: false)
            w.title = title
        case .sheet:
            w = OffscreenWindow(contentRect: .zero, styleMask: [.titled, .fullSizeContentView], backing: .buffered, defer: false)
            w.titlebarAppearsTransparent = true; w.titleVisibility = .hidden
            [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton].forEach { w.standardWindowButton($0)?.isHidden = true }
        }
        w.contentViewController = host
        if shot.dark { w.appearance = NSAppearance(named: .darkAqua) } else { w.appearance = NSAppearance(named: .aqua) }
        w.isReleasedWhenClosed = false
        let size = shot.size ?? NSHostingView(rootView: root).fittingSize
        if case .sheet = shot.chrome { w.setFrame(NSRect(origin: .zero, size: size), display: false) } else { w.setContentSize(size) }
        return w
    }

    private static func present(_ w: NSWindow, name: String, settle: Double, outDir: String, radius: Int, dark: Bool) async {
        w.setFrameOrigin(origin)
        let onScreen = NSScreen.screens.contains { $0.frame.intersects(w.frame) }
        precondition(!onScreen, "window would be visible on a display")
        w.orderFrontRegardless()      // orders in without activating the app or making it key
        w.setFrameOrigin(origin)
        if let ow = w as? OffscreenWindow, ow.drawsActive {
            // Controls pick their coloured look from these notifications; no real key change happens.
            NotificationCenter.default.post(name: NSWindow.didBecomeKeyNotification, object: w)
            NotificationCenter.default.post(name: NSWindow.didBecomeMainNotification, object: w)
        }
        precondition(!NSScreen.screens.contains { $0.frame.intersects(w.frame) }, "AppKit moved the window onto a display")
        try? await Task.sleep(nanoseconds: UInt64(settle * 1_000_000_000))
        w.makeFirstResponder(nil)   // no text selection / caret in fields (does not make the window key)
        try? await Task.sleep(nanoseconds: 300_000_000)
        let out = outDir + "/" + name + ".png"
        let method = await capture(w, to: out)
        // Window corners are applied by the window server on screen, so the raw pixels are square: record the radius
        // so the compositor can round them the way macOS does.
        let meta = "{\"radius\":\(radius),\"appearance\":\"\(dark ? "dark" : "light")\",\"width\":\(Int(w.frame.width)),\"height\":\(Int(w.frame.height)),\"method\":\"\(method)\"}"
        try? meta.write(toFile: outDir + "/" + name + ".json", atomically: true, encoding: .utf8)
        fputs("[sbf-shots] \(name): \(method) frame=\(Int(w.frame.width))x\(Int(w.frame.height))pt\n", stderr)
        w.orderOut(nil)
        w.close()
    }

    // MARK: Capture

    private static func capture(_ w: NSWindow, to path: String) async -> String {
        let id = CGWindowID(w.windowNumber)
        let wantW = Int(w.frame.width * 2), wantH = Int(w.frame.height * 2)

        // (a) screencapture by window id
        let ok = await runScreencapture(id: id, path: path)
        if ok, let why = validate(path: path, wantW: wantW, wantH: wantH) {
            NSLog("[sbf-shots] screencapture rejected: %@", why)
        } else if ok {
            return "screencapture"
        }
        // (b) CGWindowListCreateImage (looked up at run time: the SDK marks it unavailable)
        if let cg = windowListImage(id), let png = pngData(cg) {
            try? png.write(to: URL(fileURLWithPath: path))
            if let why = validate(path: path, wantW: wantW, wantH: wantH) {
                NSLog("[sbf-shots] CGWindowListCreateImage rejected: %@", why)
            } else { return "CGWindowListCreateImage" }
        }
        // (c) in-process render at 2x
        if let png = cacheDisplayPNG(w) {
            try? png.write(to: URL(fileURLWithPath: path))
            return "cacheDisplay@2x" + (validate(path: path, wantW: wantW, wantH: wantH).map { " (UNVERIFIED: \($0))" } ?? "")
        }
        return "FAILED"
    }

    private static func runScreencapture(id: CGWindowID, path: String) async -> Bool {
        try? FileManager.default.removeItem(atPath: path)
        return await withCheckedContinuation { cont in
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
            p.arguments = ["-l", String(id), "-o", "-x", path]
            p.terminationHandler = { proc in cont.resume(returning: proc.terminationStatus == 0 && FileManager.default.fileExists(atPath: path)) }
            do { try p.run() } catch { cont.resume(returning: false) }
        }
    }

    private typealias WLCI = @convention(c) (CGRect, UInt32, CGWindowID, UInt32) -> Unmanaged<CGImage>?
    private static func windowListImage(_ id: CGWindowID) -> CGImage? {
        guard let h = dlopen(nil, RTLD_NOW), let sym = dlsym(h, "CGWindowListCreateImage") else { return nil }
        let fn = unsafeBitCast(sym, to: WLCI.self)
        // null rect, optionIncludingWindow (8), bestResolution (1) | boundsIgnoreFraming (2)
        return fn(.null, 8, id, 1 | 2)?.takeRetainedValue()
    }

    private static func pngData(_ cg: CGImage) -> Data? {
        NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])
    }

    private static func cacheDisplayPNG(_ w: NSWindow) -> Data? {
        guard let frameView = w.contentView?.superview else { return nil }
        let b = frameView.bounds
        guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(b.width * 2), pixelsHigh: Int(b.height * 2),
                                         bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                         colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { return nil }
        rep.size = b.size
        frameView.cacheDisplay(in: b, to: rep)
        return rep.representation(using: .png, properties: [:])
    }

    /// nil when the image looks right; otherwise the reason it does not.
    private static func validate(path: String, wantW: Int, wantH: Int) -> String? {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: path)), let rep = NSBitmapImageRep(data: data) else { return "unreadable" }
        if abs(rep.pixelsWide - wantW) > 8 || abs(rep.pixelsHigh - wantH) > 8 {
            return "size \(rep.pixelsWide)x\(rep.pixelsHigh), wanted \(wantW)x\(wantH)"
        }
        // Blank / flat: sample a grid, require some variance among opaque pixels.
        var seen = Set<UInt32>(); var opaque = 0; var samples = 0
        let cols = 40, rows = 40
        for yi in 0..<rows { for xi in 0..<cols {
            let x = (rep.pixelsWide - 1) * xi / (cols - 1), y = (rep.pixelsHigh - 1) * yi / (rows - 1)
            guard let c = rep.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else { continue }
            samples += 1
            if c.alphaComponent > 0.5 { opaque += 1 }
            seen.insert(UInt32(c.redComponent * 15) << 8 | UInt32(c.greenComponent * 15) << 4 | UInt32(c.blueComponent * 15))
        } }
        if opaque < samples / 2 { return "mostly transparent" }
        if seen.count < 4 { return "flat/blank (\(seen.count) tones)" }
        return nil
    }
}

// The manager window with the update alert over it, as the app shows it. The alert's own AppKit content view is
// hosted here, so its text, buttons and icon are the system's.
private struct UpdateOverlay: View {
    let base: AnyView
    private let card: NSView = {
        let alert = NSAlert()
        alert.messageText = "A new version is available"
        alert.informativeText = "SidebarFavorites 1.2.3 is out. You have 1.2.2."
        ["Download", "Later"].forEach { alert.addButton(withTitle: $0) }
        alert.layout()
        let v = alert.window.contentView!
        alert.window.contentView = NSView()
        return v
    }()
    var body: some View {
        ZStack(alignment: .top) {
            base
            Color.black.opacity(0.3)
            HostedNSView(view: card)
                .frame(width: card.frame.width, height: card.frame.height)
                .background(Color(nsColor: .windowBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                .shadow(color: .black.opacity(0.35), radius: 24, y: 8)
                .padding(.top, 150)
        }
    }
}
private struct HostedNSView: NSViewRepresentable {
    let view: NSView
    func makeNSView(context: Context) -> NSView { view }
    func updateNSView(_ nsView: NSView, context: Context) {}
}

// MARK: - The menu bar menu, drawn as a view
//
// The real menu is an NSMenu (MenuBarExtra .menu style) that only exists on screen while
// tracking. This mirrors MenuBarView's items (same labels, order, symbols) on a menu-like surface.
private struct MenuMock: View {
    let favorites: [Favorite]
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(favorites) { f in
                row(HStack(spacing: 8) {
                    Image(systemName: f.iconType == .custom ? "square.on.circle" : f.iconValue).frame(width: 18)
                    Text(f.name)
                })
            }
            divider
            row(Text("Open SidebarFavorites..."), key: "⌘O")
            row(Text("Refresh All"))
            row(Text("Preferences..."), key: "⌘,")
            divider
            row(Text("SidebarFavorites \(AppVersion.display)").foregroundColor(.secondary))
            row(Text("Quit SidebarFavorites"), key: "⌘Q")
        }
        .font(.system(size: 13))
        .padding(.vertical, 6).padding(.horizontal, 6)
        .frame(width: 270)
        .background(.regularMaterial)
    }
    private var divider: some View { Divider().padding(.vertical, 5).padding(.horizontal, 6) }
    private func row<C: View>(_ c: C, key: String? = nil) -> some View {
        HStack { c; Spacer(); if let key { Text(key).foregroundColor(.secondary) } }
            .padding(.horizontal, 10).padding(.vertical, 3)
    }
}
#endif

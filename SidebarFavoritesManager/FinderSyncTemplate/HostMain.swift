//
//  HostMain.swift — advanced-mode per-favorite host app.
//
//  The host exists only to carry CFBundleIcons (the sidebar glyph Finder reads
//  for the embedded Finder Sync extension) and to register that extension with
//  PlugInKit by being launched once. It must NOT stay resident: measured cost is
//  ~30 MB RSS per host, and the glyph persists after the host exits because
//  Finder caches the containing-app icon per extension host.
//

import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ note: Notification) {
        NSLog("SBFAdvHost: launched \(Bundle.main.bundleIdentifier ?? "?") — registering extension, exiting in 8s")
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) {
            NSLog("SBFAdvHost: registration window elapsed, exiting")
            NSApp.terminate(nil)
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()

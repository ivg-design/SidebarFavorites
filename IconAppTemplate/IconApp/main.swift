import Cocoa

// Minimal background app that hosts the Finder Sync extension
// This app runs in background only (LSBackgroundOnly) and has no UI
// The Finder Sync extension provides the actual sidebar icon functionality

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Nothing to do - the extension handles everything
        NSLog("IconApp: Started")
    }

    func applicationWillTerminate(_ notification: Notification) {
        NSLog("IconApp: Terminating")
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()

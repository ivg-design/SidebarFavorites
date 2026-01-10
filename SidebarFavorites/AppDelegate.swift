import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSLog("SidebarFavorites: App launched - extension should be running")

        // This app runs in background only (LSBackgroundOnly)
        // The Finder Sync extension handles all the work
        // The app just needs to be running for the extension to work
    }

    func applicationWillTerminate(_ notification: Notification) {
        NSLog("SidebarFavorites: App terminating")
    }
}

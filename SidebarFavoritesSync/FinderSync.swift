import Cocoa
import FinderSync

class FinderSync: FIFinderSync {

    override init() {
        super.init()

        // Hardcode the path for testing
        let githubURL = URL(fileURLWithPath: "/Users/ivg/github")
        FIFinderSyncController.default().directoryURLs = [githubURL]
        NSLog("SidebarFavoritesSync: INIT - Registered directory: \(githubURL.path)")
    }

    override func beginObservingDirectory(at url: URL) {
        NSLog("SidebarFavoritesSync: beginObservingDirectory: \(url.path)")
    }

    override func endObservingDirectory(at url: URL) {
        NSLog("SidebarFavoritesSync: endObservingDirectory: \(url.path)")
    }

    override func requestBadgeIdentifier(for url: URL) {
        // No badges needed - this is just for sidebar icon
    }
}

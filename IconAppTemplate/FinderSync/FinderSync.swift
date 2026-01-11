import Cocoa
import FinderSync

class FinderSync: FIFinderSync {

    override init() {
        super.init()

        // Read folder paths from URLs file
        if let urlsFileURL = Bundle.main.url(forResource: "URLs", withExtension: nil),
           let content = try? String(contentsOf: urlsFileURL, encoding: .utf8) {

            let paths = content.components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }

            let urls = Set(paths.map { path -> URL in
                let expandedPath = (path as NSString).expandingTildeInPath
                return URL(fileURLWithPath: expandedPath)
            })

            FIFinderSyncController.default().directoryURLs = urls
            NSLog("FinderSync: Registered directories: \(urls.map { $0.path })")
        } else {
            NSLog("FinderSync: Could not read URLs file")
        }
    }

    override func beginObservingDirectory(at url: URL) {
        NSLog("FinderSync: beginObservingDirectory: \(url.path)")
    }

    override func endObservingDirectory(at url: URL) {
        NSLog("FinderSync: endObservingDirectory: \(url.path)")
    }

    override func requestBadgeIdentifier(for url: URL) {
        // No badges needed - this is just for sidebar icon
    }
}

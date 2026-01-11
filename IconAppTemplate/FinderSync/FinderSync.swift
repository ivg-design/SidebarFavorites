import Cocoa
import FinderSync

class FinderSync: FIFinderSync {

    override init() {
        super.init()

        let bundle = Bundle(for: type(of: self))

        // Read folder path from a simple text file in Resources
        let pathFile = bundle.bundlePath + "/Contents/Resources/FolderPath.txt"
        if let pathString = try? String(contentsOfFile: pathFile, encoding: .utf8) {
            let path = pathString.trimmingCharacters(in: .whitespacesAndNewlines)
            let url = URL(fileURLWithPath: path)
            FIFinderSyncController.default().directoryURLs = [url]
        }
    }

    override func beginObservingDirectory(at url: URL) { }
    override func endObservingDirectory(at url: URL) { }
    override func requestBadgeIdentifier(for url: URL) { }
}

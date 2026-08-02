//
//  FinderSyncExt.swift — advanced-mode Finder Sync extension.
//
//  Monitored roots come from Contents/Resources/Roots.txt (one absolute path per
//  line). The extension exists solely so Finder decorates those roots' sidebar
//  rows with the host app's CFBundleIcons symbol; it does no badging and no menu
//  work.
//
//  Remount healing (measured on 26.6/25G72): after a monitored volume is
//  unmounted and remounted, Finder drops the extension's icon claim and the row
//  falls back to its OverrideIcon.OSType glyph. Re-asserting the SAME
//  directoryURLs set is a no-op — Finder only re-registers when the set changes.
//  Clearing to [] and then setting the real set forces re-registration and
//  restores the glyph in both the Favorites and Locations sections with no
//  Finder relaunch. Re-apply on a small delay ladder because the mount needs a
//  moment to settle.
//

import Cocoa
import FinderSync

final class FinderSyncExt: FIFinderSync {

    private var roots: [URL] = []

    override init() {
        super.init()
        let resources = Bundle(for: type(of: self)).bundlePath + "/Contents/Resources"
        if let text = try? String(contentsOfFile: resources + "/Roots.txt", encoding: .utf8) {
            roots = text.split(separator: "\n")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
                .map { URL(fileURLWithPath: $0) }
        }
        NSLog("SBFAdvSync: init, roots = \(roots.map(\.path))")
        apply()

        let center = NSWorkspace.shared.notificationCenter
        for name: NSNotification.Name in [NSWorkspace.didMountNotification,
                                          NSWorkspace.didUnmountNotification,
                                          NSWorkspace.didRenameVolumeNotification] {
            center.addObserver(self, selector: #selector(volumeEvent(_:)), name: name, object: nil)
        }
    }

    @objc private func volumeEvent(_ note: Notification) {
        NSLog("SBFAdvSync: volume event \(note.name.rawValue), re-asserting roots")
        for delay in [0.4, 1.5, 3.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.apply() }
        }
    }

    private func apply() {
        // [] first: an identical set is a no-op and would not re-register.
        FIFinderSyncController.default().directoryURLs = []
        FIFinderSyncController.default().directoryURLs = Set(roots)
    }

    override func beginObservingDirectory(at url: URL) {}
    override func endObservingDirectory(at url: URL) {}
    override func requestBadgeIdentifier(for url: URL) {}
}

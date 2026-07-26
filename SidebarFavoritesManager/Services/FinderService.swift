import Foundation
import AppKit

/// The two Finder-facing side effects the app still needs.
///
/// Everything else in 0.6.0's `LifecycleManager` existed to launch, poll and
/// terminate one generated icon app per favorite and to read FinderSync extension
/// state out of `pluginkit`. None of that exists any more, so only these survive.
enum FinderService {
    /// Restart Finder so it redraws sidebar rows whose icon override changed.
    ///
    /// Only rows that were already in the sidebar need this: a row inserted with
    /// its `OverrideIcon.OSType` already set draws with the custom icon straight
    /// away (measured).
    ///
    /// DESTRUCTIVE, AND ONLY EVER USER-INITIATED. `killall` SIGTERMs Finder: an
    /// in-flight copy is aborted part-written, and every open window, tab, sort
    /// order and unfinished rename is lost. Nothing may call this as a side effect
    /// of syncing. The single caller is
    /// `FavoriteSyncCoordinator.restartFinder()`, which runs only when the user
    /// clicks Restart Finder in Settings or on the "needs a restart" banner; a
    /// reconcile that changed an on-screen row publishes
    /// `FavoriteSyncCoordinator.needsFinderRestart` and stops there.
    static func restart() {
        ProcessRunner.run("/usr/bin/killall", ["Finder"])
    }

    /// Reveal a folder in Finder, selecting it inside its parent.
    static func reveal(_ path: String) {
        let expandedPath = (path as NSString).expandingTildeInPath
        onMain {
            NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: expandedPath)
        }
    }

    /// Reveal a folder in Finder, selecting it inside its parent.
    static func reveal(_ url: URL) {
        reveal(url.path)
    }

    /// Run a block on the main thread, synchronously when already there.
    /// `NSWorkspace` UI calls arrive from menu-bar items as well as from the
    /// coordinator's `nonisolated` facade.
    private static func onMain(_ block: @escaping @Sendable () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.async(execute: block)
        }
    }
}

import Foundation

/// The running build's identity, in the one place every surface reads it from.
///
/// The main window, the menu bar popover and Settings all show this, so a bug
/// report can name the exact build no matter which one the user was looking at.
enum AppVersion {
    /// "1.2.0"
    static var short: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    /// "41"
    static var build: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
    }

    /// "1.2.0 (41)", or just "1.2.0" when the build number carries no extra
    /// information.
    static var display: String {
        build == short ? short : "\(short) (\(build))"
    }
}

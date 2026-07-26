import Foundation

/// Detects code signing identities and signs the generated icon helper bundle.
///
/// Signing the helper is deliberately best-effort. An *unsigned* helper registers
/// with Launch Services and its exported UTIs resolve normally, so signing buys
/// nothing but a quiet `syspolicy` - which makes a codesign failure a warning
/// rather than an error. The helper carries no executable logic, no nested code
/// and no entitlements, so it needs neither an entitlements file, the hardened
/// runtime, nor a secure timestamp: one plain `codesign --force --sign` is the
/// whole operation.
final class CodeSigner {
    static let shared = CodeSigner()

    private static let codesignPath = "/usr/bin/codesign"
    private static let securityPath = "/usr/bin/security"

    /// Cached list of available signing identities
    private var cachedIdentities: [String]?

    /// Guards `cachedIdentities` - the helper is rebuilt from detached tasks while
    /// Settings may be reading the same list on the main thread.
    private let cacheLock = NSLock()

    private init() {}

    /// Detect available code signing identities from the keychain
    func availableIdentities() -> [String] {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        if let cached = cachedIdentities {
            return cached
        }

        // Every argument here is a literal, and the deadline is the keychain one:
        // `find-identity` reaches the login keychain, which can be locked.
        let result = ProcessRunner.run(
            Self.securityPath,
            ["find-identity", "-v", "-p", "codesigning"],
            timeout: ProcessRunner.keychainTimeout
        )

        // Parse identities from output like:
        // 1) ABC123... "Apple Development: Name (TEAM)"
        // 2) DEF456... "Developer ID Application: Name (TEAM)"
        var identities: [String] = []
        for line in result.output.components(separatedBy: "\n") {
            if line.contains("Apple Development") {
                identities.append("Apple Development")
            } else if line.contains("Developer ID Application") {
                identities.append("Developer ID Application")
            }
        }

        // Remove duplicates while preserving order
        var seen = Set<String>()
        let unique = identities.filter { seen.insert($0).inserted }

        cachedIdentities = unique
        return unique
    }

    /// Get the best available signing identity based on user preference
    func resolve(_ preference: SigningIdentity) -> String {
        switch preference {
        case .automatic:
            // Try Apple Development first, then Developer ID, then ad-hoc
            let available = availableIdentities()
            if available.contains("Apple Development") {
                return "Apple Development"
            } else if available.contains("Developer ID Application") {
                return "Developer ID Application"
            } else {
                return "-"  // Ad-hoc signing
            }

        case .adHoc:
            return "-"

        case .appleDevelopment, .developerID:
            // Check if the requested identity is actually available
            let available = availableIdentities()
            if available.contains(preference.rawValue) {
                return preference.rawValue
            } else {
                // Fall back to ad-hoc if requested identity not available
                NSLog("CodeSigner: Requested identity '\(preference.rawValue)' not found, falling back to ad-hoc signing")
                return "-"
            }
        }
    }

    /// Signs a bundle in place. No entitlements, no nested code, no hardened
    /// runtime, no --timestamp: the helper contains no executable logic.
    /// NEVER throws - an unsigned helper registers and renders icons correctly,
    /// so a signing failure is a warning, not an error.
    /// Returns nil on success, or a user-facing warning string.
    func signBundle(at url: URL, using preference: SigningIdentity) -> String? {
        // `identity` is never user text: `resolve` returns one of exactly three
        // literals ("-", "Apple Development", "Developer ID Application"), and the
        // two named ones are only returned after `availableIdentities` - which
        // itself only ever appends those same two literals - has confirmed them.
        // `url` is the app's own fixed helper path. Nothing here is interpolated
        // into a shell either: `ProcessRunner` execs the tool directly with an
        // argument vector.
        let identity = resolve(preference)

        // A short deadline, and specifically for the SecurityAgent prompt: signing
        // with a real identity behind a locked keychain blocks on a dialog this app
        // cannot see. Timing out degrades exactly the way a signing failure already
        // does - an unsigned helper, which registers and renders icons fine, plus a
        // warning - instead of wedging the whole sync pipeline.
        if let failure = ProcessRunner.failureDescription(
            Self.codesignPath,
            ["--force", "--sign", identity, url.path],
            timeout: ProcessRunner.keychainTimeout
        ) {
            let message = "Could not sign \(url.lastPathComponent) with '\(identity)': \(failure). "
                + "Sidebar icons still work; the bundle is simply unsigned."
            NSLog("CodeSigner: \(message)")
            return message
        }

        if identity == "-" {
            NSLog("CodeSigner: Signed \(url.lastPathComponent) with an ad-hoc signature")
        } else {
            NSLog("CodeSigner: Signed \(url.lastPathComponent) with '\(identity)'")
        }
        return nil
    }
}

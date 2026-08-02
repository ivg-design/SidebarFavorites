import Foundation

/// Asks GitHub once per launch whether a newer release exists.
///
/// Deliberately the smallest thing that answers the question: one unauthenticated
/// GET against the public releases endpoint, no framework, no background activity,
/// no automatic download or install. The app has no updater and users asked for
/// one (issue #20); telling them a version exists and linking to it is the honest
/// minimum, and it keeps the "nothing runs in the background" promise intact.
///
/// Failure is silence. A version check that cannot reach the network is not
/// something to interrupt anybody about.
enum UpdateChecker {
    /// The newest release, when it is newer than what is running.
    struct Update: Equatable {
        let version: String
        let pageURL: URL
    }

    private static let releasesAPI = URL(string: "https://api.github.com/repos/ivg-design/SidebarFavorites/releases/latest")!
    static let releasesPage = URL(string: "https://github.com/ivg-design/SidebarFavorites/releases/latest")!

    /// `CFBundleShortVersionString` of the running app.
    static var runningVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
    }

    /// The newest release if it is newer than `currentVersion`, otherwise nil.
    ///
    /// Never throws: every failure - offline, rate limited, malformed payload, a
    /// tag that is not a version - resolves to "nothing to report".
    static func checkForUpdate(currentVersion: String = runningVersion) async -> Update? {
        var request = URLRequest(url: releasesAPI, timeoutInterval: 10)
        // Asking for the versioned media type keeps the response shape stable, and
        // GitHub wants a User-Agent on unauthenticated calls.
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("SidebarFavorites/\(currentVersion)", forHTTPHeaderField: "User-Agent")
        // A version check must never serve a stale answer from a previous launch.
        request.cachePolicy = .reloadIgnoringLocalCacheData

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let tag = payload["tag_name"] as? String else {
            return nil
        }

        let latest = tag.hasPrefix("v") ? String(tag.dropFirst()) : tag
        guard isVersion(latest, newerThan: currentVersion) else { return nil }

        let page = (payload["html_url"] as? String).flatMap(URL.init(string:)) ?? releasesPage
        return Update(version: latest, pageURL: page)
    }

    /// Numeric, component-wise comparison: "1.10.0" is newer than "1.9.0", which
    /// string ordering gets wrong.
    ///
    /// Anything non-numeric in either version makes this answer false rather than
    /// guess - a prerelease tag should not nag someone running a newer build.
    static func isVersion(_ candidate: String, newerThan current: String) -> Bool {
        let lhs = candidate.split(separator: ".").map { Int($0) }
        let rhs = current.split(separator: ".").map { Int($0) }
        guard !lhs.contains(nil), !rhs.contains(nil), !lhs.isEmpty, !rhs.isEmpty else { return false }

        let left = lhs.compactMap { $0 }
        let right = rhs.compactMap { $0 }
        for index in 0..<max(left.count, right.count) {
            let l = index < left.count ? left[index] : 0
            let r = index < right.count ? right[index] : 0
            if l != r { return l > r }
        }
        return false
    }
}

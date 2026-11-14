import Foundation

/// The filesystem, generated plists, binaries and signatures are real. Only the
/// two callbacks that touch the user's Launch Services/PlugInKit state are replaced.
@main
struct HelperUpgrade {
    struct Failure: LocalizedError {
        let errorDescription: String?
        init(_ message: String) { errorDescription = message }
    }

    static func check(_ condition: Bool, _ message: String) throws {
        if !condition { throw Failure(message) }
    }

    static func main() async {
        do {
            try await run()
        } catch {
            FileHandle.standardError.write(Data("FAIL: \(error.localizedDescription)\n".utf8))
            exit(1)
        }
    }

    static func run() async throws {
        let templates = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let work = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        let target = work.appendingPathComponent("AdvancedApps")
        let fm = FileManager.default
        let favorite = Favorite(id: UUID(uuidString: "01234567-89AB-CDEF-0123-456789ABCDEF")!,
                                name: "Example", folderPath: work.appendingPathComponent("Example").path,
                                mode: .advanced)
        let host = target.appendingPathComponent("SBF-Example-01234567.app")
        let appex = host.appendingPathComponent("Contents/PlugIns/SBF-Example-01234567Sync.appex")
        let resources = host.appendingPathComponent("Contents/Resources")
        let marker = resources.appendingPathComponent("SBFState.txt")
        let oldState = ["v1", favorite.expandedFolderPath, "Example", "sfSymbol", "folder.fill", "", "1.000"]
            .joined(separator: "\u{1f}")
        try fm.createDirectory(at: resources, withIntermediateDirectories: true)
        try oldState.write(to: marker, atomically: true, encoding: .utf8)

        // A failed build must leave the old helper exactly where it was.
        let broken = FinderSyncAppGenerator(advancedAppsDirectory: target,
                                            templateDirectory: work.appendingPathComponent("missing"),
                                            isRegistered: { _, _ in false },
                                            register: { _, _, _ in fatalError("registered a failed build") })
        try check(!(await broken.sync(favorites: [favorite])).isEmpty, "missing templates were accepted")
        try check(try String(contentsOf: marker, encoding: .utf8) == oldState, "lost the old helper on failure")

        var registered = false
        var enableRequests: [Bool] = []
        let generator = FinderSyncAppGenerator(advancedAppsDirectory: target, templateDirectory: templates,
                                               isRegistered: { _, _ in registered }, register: { _, _, enable in
            enableRequests.append(enable)
            if enableRequests.count == 1 { return ["simulated host registration failure"] }
            registered = true
            return []
        })
        try check(await generator.sync(favorites: [favorite]) == ["simulated host registration failure"],
                  "registration failure was not reported")
        try check(try String(contentsOf: marker, encoding: .utf8) != oldState, "v1 helper was not upgraded")
        let installed = try fm.attributesOfItem(atPath: host.path)[.systemFileNumber] as? NSNumber
        try check(installed != nil, "missing helper after upgrade")
        try check((await generator.sync(favorites: [favorite])).isEmpty && registered, "registration was not retried")
        try check((await generator.sync(favorites: [favorite])).isEmpty && enableRequests == [false, false],
                  "upgrade/retry changed the election or re-registered an unchanged helper")
        try check(try fm.attributesOfItem(atPath: host.path)[.systemFileNumber] as? NSNumber == installed,
                  "unchanged helper rebuilt during retry or later sync")

        let prefix = "com.ivg-design.SidebarFavorites.adv.01234567"
        for (bundle, id) in [(host, prefix), (appex, prefix + ".Sync")] {
            let data = try Data(contentsOf: bundle.appendingPathComponent("Contents/Info.plist"))
            let plist = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
            try check(plist?["CFBundleIdentifier"] as? String == id, "helper identity changed")
            try check(plist?["CFBundleVersion"] as? String != "1", "old helper build number retained")
            let checkSignature = ProcessRunner.run("/usr/bin/codesign", ["--verify", "--strict", "--deep", "--all-architectures", bundle.path])
            try check(checkSignature.succeeded, "broken helper signature: \(checkSignature.output)")
            guard let name = plist?["CFBundleExecutable"] as? String else { throw Failure("missing executable") }
            let binary = bundle.appendingPathComponent("Contents/MacOS/" + name)
            let archs = ProcessRunner.run("/usr/bin/lipo", ["-archs", binary.path])
            try check(archs.succeeded && Set(archs.output.split(whereSeparator: \.isWhitespace)) == ["x86_64", "arm64"],
                      "generated helper architectures: \(archs.output)")
        }
        let roots = try String(contentsOf: appex.appendingPathComponent("Contents/Resources/Roots.txt"), encoding: .utf8)
        try check(roots == favorite.expandedFolderPath + "\n", "monitored root changed from \(favorite.expandedFolderPath) to \(roots)")
        // A newly opted-in favorite still requests enablement exactly once.
        try fm.removeItem(at: host)
        registered = false
        try check((await generator.sync(favorites: [favorite])).isEmpty && enableRequests == [false, false, true],
                  "a new installation did not request enablement")
        print("PASS: v1 helper survived a failed build, upgraded in place, retried registration, and stayed unchanged on the next sync. Both generated binaries are universal and strictly signed; both bundle identifiers and the monitored root are preserved.")
    }
}

import Foundation
import AppKit
import Combine

/// Manages the lifecycle of icon apps (launch, stop, status)
final class LifecycleManager: ObservableObject {
    static let shared = LifecycleManager()

    @Published private(set) var runningApps: Set<UUID> = []

    private let configManager = ConfigManager.shared
    private let generator = IconAppGenerator.shared
    private let workspace = NSWorkspace.shared
    private var cancellables = Set<AnyCancellable>()

    private init() {
        // Monitor for app terminations
        workspace.notificationCenter.publisher(for: NSWorkspace.didTerminateApplicationNotification)
            .sink { [weak self] notification in
                self?.handleAppTermination(notification)
            }
            .store(in: &cancellables)

        // Initial status check
        updateRunningApps()
    }

    /// Start all enabled icon apps
    func startAllEnabled() async throws {
        for favorite in configManager.config.enabledFavorites {
            try await ensureIconAppRunning(for: favorite)
        }
    }

    /// Ensure an icon app is running for a favorite (generate if needed)
    func ensureIconAppRunning(for favorite: Favorite) async throws {
        // Generate or update if needed
        if !generator.isIconAppCurrent(for: favorite) {
            try generator.generateIconApp(for: favorite)
        }

        // Launch if not running
        if !isRunning(favorite.id) {
            try await launchIconApp(for: favorite)
        }
    }

    /// Launch an icon app
    func launchIconApp(for favorite: Favorite) async throws {
        let appURL = configManager.iconAppURL(for: favorite)
        guard FileManager.default.fileExists(atPath: appURL.path) else {
            throw LifecycleError.appNotFound
        }

        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        configuration.hides = true

        try await workspace.openApplication(at: appURL, configuration: configuration)

        await MainActor.run {
            runningApps.insert(favorite.id)
        }
    }

    /// Stop an icon app
    func stopIconApp(for favorite: Favorite) {
        let bundleId = favorite.bundleIdentifier

        for app in workspace.runningApplications {
            if app.bundleIdentifier == bundleId {
                app.terminate()
                break
            }
        }

        runningApps.remove(favorite.id)
    }

    /// Stop all icon apps
    func stopAll() {
        for favorite in configManager.config.favorites {
            stopIconApp(for: favorite)
        }
    }

    /// Check if an icon app is running
    func isRunning(_ favoriteId: UUID) -> Bool {
        guard let favorite = configManager.getFavorite(id: favoriteId) else {
            return false
        }

        let bundleId = favorite.bundleIdentifier
        return workspace.runningApplications.contains { $0.bundleIdentifier == bundleId }
    }

    /// Update the set of running apps
    private func updateRunningApps() {
        var running = Set<UUID>()

        for favorite in configManager.config.favorites {
            if isRunning(favorite.id) {
                running.insert(favorite.id)
            }
        }

        runningApps = running
    }

    /// Handle app termination notification
    private func handleAppTermination(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
              let bundleId = app.bundleIdentifier,
              bundleId.hasPrefix("com.ivg-design.SidebarFavorites.") else {
            return
        }

        // Find and update the favorite
        if let favorite = configManager.config.favorites.first(where: { $0.bundleIdentifier == bundleId }) {
            runningApps.remove(favorite.id)
        }
    }

    /// Restart Finder (use with caution)
    func restartFinder() {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/killall")
        process.arguments = ["Finder"]
        try? process.run()
    }

    /// Open System Settings to Login Items & Extensions pane
    func openExtensionsSettings() {
        // macOS 13+ uses this URL for Login Items & Extensions
        if let url = URL(string: "x-apple.systempreferences:com.apple.LoginItems-Settings.extension") {
            workspace.open(url)
        }
    }

    /// Check if a FinderSync extension is enabled
    /// Returns: true if enabled, false if disabled or not found
    func isExtensionEnabled(bundleIdentifier: String) -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/pluginkit")
        process.arguments = ["-m", "-i", bundleIdentifier]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        do {
            try process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8) {
                // "+" prefix means enabled, "-" means disabled
                return output.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("+")
            }
        } catch {
            NSLog("Failed to check extension status: \(error)")
        }

        return false
    }

    /// Check if an extension is enabled for a favorite
    func isExtensionEnabled(for favorite: Favorite) -> Bool {
        return isExtensionEnabled(bundleIdentifier: favorite.extensionBundleIdentifier)
    }

    /// Get extension status for all favorites
    func getExtensionStatuses() -> [UUID: Bool] {
        var statuses: [UUID: Bool] = [:]
        for favorite in configManager.config.favorites {
            statuses[favorite.id] = isExtensionEnabled(for: favorite)
        }
        return statuses
    }

    /// Reveal folder in Finder (to help user drag to sidebar)
    func revealInFinder(_ folderPath: String) {
        let expandedPath = (folderPath as NSString).expandingTildeInPath
        workspace.selectFile(nil, inFileViewerRootedAtPath: expandedPath)
    }

    enum LifecycleError: LocalizedError {
        case appNotFound

        var errorDescription: String? {
            switch self {
            case .appNotFound:
                return "Icon app not found"
            }
        }
    }
}

import SwiftUI
import ServiceManagement

struct SettingsView: View {
    @EnvironmentObject var configManager: ConfigManager
    @State private var launchAtLogin: Bool = false
    @State private var launchAtLoginCaption: String?
    // Last-known system value for launchAtLogin, recorded whenever we read it from
    // SMAppService. A programmatic sync always leaves launchAtLogin == this value, so
    // onChange can tell a real user edit (which differs) from its own assignment (which
    // doesn't) without depending on when SwiftUI happens to deliver onChange.
    @State private var systemLaunchAtLogin = false
    @State private var showInMenuBar: Bool = true

    @State private var settingsErrorMessage: String?
    @State private var removeAllSidebarIconsMessage: String?
    // Gates removeAllSidebarIcons() behind an explicit confirm. The existing
    // "Remove All Sidebar Icons" alert (removeAllSidebarIconsMessage) is a report
    // shown *after* the work is done - this is the confirmation shown *before*.
    @State private var showingRemoveAllSidebarIconsConfirmation = false
    // Re-entrancy guard, matching AddEditFavoriteSheet.isApplying and
    // ContentView.deletingFavoriteIDs: without it, a repeat tap (or a second
    // confirm) while a prior removeAllSidebarIcons() Task is still awaiting the
    // coordinator starts an overlapping run. Both would write the single
    // @State removeAllSidebarIconsMessage, so whichever finishes last silently
    // overwrites the other's result text.
    @State private var isRemovingAllSidebarIcons = false

    var body: some View {
        Form {
            Section {
                Toggle("Launch at Login", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { newValue in
                        // Only react when the toggle differs from the last value we read
                        // from the system - that's what distinguishes a user edit from a
                        // programmatic sync, regardless of when onChange is delivered.
                        guard newValue != systemLaunchAtLogin else { return }
                        setLaunchAtLogin(newValue)
                    }

                if let caption = launchAtLoginCaption {
                    Text(caption)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Toggle("Show in Menu Bar", isOn: $showInMenuBar)
                    .onChange(of: showInMenuBar) { _ in
                        updateSettings()
                    }
            }

            Section("About") {
                aboutHeader

                LabeledContent("Version") {
                    Text(versionString)
                }

                LabeledContent("Helper App") {
                    Button(action: openHelperAppLocation) {
                        Text(configManager.helperAppURL.path)
                            .lineLimit(1)
                            .truncationMode(.head)
                    }
                    .buttonStyle(.link)
                }

                if let diagnostic = configManager.loadDiagnostic {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Configuration Issue", systemImage: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text(diagnostic)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        if configManager.corruptBackupURL != nil {
                            Button("Reveal Backup") {
                                revealCorruptBackup()
                            }
                            .buttonStyle(.link)
                        }
                    }
                }
            }

            Section("Actions") {
                Button("Restart Finder") {
                    FavoriteSyncCoordinator.shared.restartFinder()
                }
                .foregroundColor(.orange)

                Button("Remove All Sidebar Icons") {
                    showingRemoveAllSidebarIconsConfirmation = true
                }
                .foregroundColor(.red)
                .disabled(isRemovingAllSidebarIcons)
            }
        }
        .formStyle(.grouped)
        .frame(width: 400, height: 420)
        .onAppear {
            showInMenuBar = configManager.config.settings.showInMenuBar
            syncLaunchAtLoginFromSystem()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            syncLaunchAtLoginFromSystem()
        }
        .alert(
            "Couldn't Save Settings",
            isPresented: Binding(
                get: { settingsErrorMessage != nil },
                set: { if !$0 { settingsErrorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { settingsErrorMessage = nil }
        } message: {
            Text(settingsErrorMessage ?? "")
        }
        .alert(
            "Remove All Sidebar Icons",
            isPresented: Binding(
                get: { removeAllSidebarIconsMessage != nil },
                set: { if !$0 { removeAllSidebarIconsMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { removeAllSidebarIconsMessage = nil }
        } message: {
            Text(removeAllSidebarIconsMessage ?? "")
        }
        // The confirmation shown BEFORE removeAllSidebarIcons() runs. States exactly
        // what will happen, since the action is irreversible (rows the app added are
        // deleted outright, not trashed) and sits right below "Restart Finder" with
        // only red text distinguishing it.
        .confirmationDialog(
            "Remove All Sidebar Icons?",
            isPresented: $showingRemoveAllSidebarIconsConfirmation,
            titleVisibility: .visible
        ) {
            Button("Remove All Sidebar Icons", role: .destructive) {
                removeAllSidebarIcons()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(removeAllSidebarIconsConfirmationMessage)
        }
    }

    /// Describes the concrete effect of removeAllSidebarIcons() using the current
    /// favorites, so the confirmation names counts instead of speaking abstractly.
    private var removeAllSidebarIconsConfirmationMessage: String {
        let favorites = configManager.config.favorites
        let managedCount = favorites.filter { $0.sidebarProvenance == .managed }.count
        let adoptedCount = favorites.filter { $0.sidebarProvenance == .adopted }.count

        var lines: [String] = []
        if managedCount > 0 {
            lines.append(managedCount == 1
                ? "Removes 1 row this app added to Finder's sidebar."
                : "Removes \(managedCount) rows this app added to Finder's sidebar.")
        }
        if adoptedCount > 0 {
            lines.append(adoptedCount == 1
                ? "Clears the custom icon on 1 row you added yourself; the row stays in Finder."
                : "Clears the custom icon on \(adoptedCount) rows you added yourself; the rows stay in Finder.")
        }
        lines.append("Deletes the icon helper bundle.")
        lines.append("This cannot be undone.")
        return lines.joined(separator: "\n")
    }

    /// App icon, name and attribution at the top of the About section.
    private var aboutHeader: some View {
        HStack(spacing: 12) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 2) {
                Text("SidebarFavorites")
                    .font(.headline)
                Text("by IVG-Design")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Button("MIT License") {
                    NSWorkspace.shared.open(
                        URL(string: "https://github.com/ivg-design/SidebarFavorites/blob/main/LICENSE")!
                    )
                }
                .buttonStyle(.link)
                .font(.caption)
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }

    /// "1.0.0 (10)" - the marketing version with the build number, so a bug
    /// report can name the exact build rather than just the release.
    private var versionString: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        guard let build = info?["CFBundleVersion"] as? String, build != short else {
            return short
        }
        return "\(short) (\(build))"
    }

    /// Reads the authoritative launch-at-login state from `SMAppService` and reconciles
    /// both the toggle and the persisted config with it, rather than trusting whatever was
    /// last written to config.json (which can drift if changed in System Settings).
    private func syncLaunchAtLoginFromSystem() {
        let status = SMAppService.mainApp.status
        let systemEnabled: Bool
        switch status {
        case .enabled:
            systemEnabled = true
            launchAtLoginCaption = nil
        case .requiresApproval:
            systemEnabled = true
            launchAtLoginCaption = "Waiting for approval in System Settings → Login Items"
        case .notRegistered, .notFound:
            systemEnabled = false
            launchAtLoginCaption = nil
        @unknown default:
            systemEnabled = false
            launchAtLoginCaption = nil
        }

        systemLaunchAtLogin = systemEnabled
        launchAtLogin = systemEnabled

        if configManager.config.settings.launchAtLogin != systemEnabled {
            var settings = configManager.config.settings
            settings.launchAtLogin = systemEnabled
            do {
                try configManager.updateSettings(settings)
            } catch {
                settingsErrorMessage = "Couldn't save Launch at Login setting: \(error.localizedDescription)"
            }
        }
    }

    private func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            var settings = configManager.config.settings
            settings.launchAtLogin = enabled
            try configManager.updateSettings(settings)
        } catch {
            settingsErrorMessage = "Couldn't change Launch at Login: \(error.localizedDescription)"
        }
        // Re-read the authoritative system state regardless of success or failure so the
        // toggle always reflects reality instead of whatever the user just picked.
        syncLaunchAtLoginFromSystem()
    }

    private func updateSettings() {
        do {
            var settings = configManager.config.settings
            settings.showInMenuBar = showInMenuBar
                try configManager.updateSettings(settings)
        } catch {
            settingsErrorMessage = "Couldn't save settings: \(error.localizedDescription)"
        }
    }

    private func openHelperAppLocation() {
        NSWorkspace.shared.selectFile(configManager.helperAppURL.path, inFileViewerRootedAtPath: configManager.appSupportURL.path)
    }

    private func revealCorruptBackup() {
        NSWorkspace.shared.selectFile(
            configManager.corruptBackupURL?.path,
            inFileViewerRootedAtPath: configManager.appSupportURL.path
        )
    }

    private func removeAllSidebarIcons() {
        // Ignore a repeat tap (or a second confirm reached some other way) while a
        // prior run is still in flight, rather than starting an overlapping
        // FavoriteSyncCoordinator.removeAllSidebarIcons() call that would race the
        // first one to `removeAllSidebarIconsMessage`.
        guard !isRemovingAllSidebarIcons else { return }
        isRemovingAllSidebarIcons = true
        Task {
            // removeAllSidebarIcons() runs its blocking work (sidebar patches, helper
            // teardown, Finder restart) off the main actor internally and only
            // suspends here - it does not block the UI.
            let warnings = await FavoriteSyncCoordinator.shared.removeAllSidebarIcons()
            removeAllSidebarIconsMessage = warnings.isEmpty
                ? "All sidebar icons were removed."
                : "Some sidebar icons could not be fully removed:\n\n" + warnings.joined(separator: "\n")
            isRemovingAllSidebarIcons = false
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(ConfigManager.shared)
}

import SwiftUI
import ServiceManagement

struct SettingsView: View {
    @EnvironmentObject var configManager: ConfigManager
    @State private var launchAtLogin: Bool = false
    @State private var showInMenuBar: Bool = true

    var body: some View {
        Form {
            Section {
                Toggle("Launch at Login", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { newValue in
                        setLaunchAtLogin(newValue)
                    }

                Toggle("Show in Menu Bar", isOn: $showInMenuBar)
                    .onChange(of: showInMenuBar) { _ in
                        updateSettings()
                    }
            }

            Section("About") {
                LabeledContent("Version") {
                    Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                }

                LabeledContent("Icon Apps Location") {
                    Button(action: openAppsFolder) {
                        Text(configManager.appsDirectoryURL.path)
                            .lineLimit(1)
                            .truncationMode(.head)
                    }
                    .buttonStyle(.link)
                }
            }

            Section("Actions") {
                Button("Open Extensions Settings") {
                    LifecycleManager.shared.openExtensionsSettings()
                }

                Button("Restart Finder") {
                    LifecycleManager.shared.restartFinder()
                }
                .foregroundColor(.orange)

                Button("Remove All Icon Apps") {
                    removeAllIconApps()
                }
                .foregroundColor(.red)
            }
        }
        .formStyle(.grouped)
        .frame(width: 400, height: 350)
        .onAppear {
            launchAtLogin = configManager.config.settings.launchAtLogin
            showInMenuBar = configManager.config.settings.showInMenuBar
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
            // Reset toggle on failure
            launchAtLogin = !enabled
        }
    }

    private func updateSettings() {
        do {
            var settings = configManager.config.settings
            settings.showInMenuBar = showInMenuBar
            try configManager.updateSettings(settings)
        } catch {
            // Ignore
        }
    }

    private func openAppsFolder() {
        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: configManager.appsDirectoryURL.path)
    }

    private func removeAllIconApps() {
        LifecycleManager.shared.stopAll()
        for favorite in configManager.config.favorites {
            try? IconAppGenerator.shared.removeIconApp(for: favorite)
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(ConfigManager.shared)
}

import SwiftUI
import ServiceManagement

@main
struct SidebarFavoritesManagerApp: App {
    @StateObject private var configManager = ConfigManager.shared
    @StateObject private var lifecycleManager = LifecycleManager.shared
    @State private var showingAddSheet = false

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(configManager)
                .environmentObject(lifecycleManager)
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Add Favorite...") {
                    showingAddSheet = true
                }
                .keyboardShortcut("n", modifiers: .command)
            }
        }

        Settings {
            SettingsView()
                .environmentObject(configManager)
        }

        // Menu bar icon - always visible, controlled by isInserted
        MenuBarExtra("SidebarFavorites", systemImage: "sidebar.left", isInserted: .constant(configManager.config.settings.showInMenuBar)) {
            MenuBarView()
                .environmentObject(configManager)
                .environmentObject(lifecycleManager)
        }
        .menuBarExtraStyle(.menu)
    }
}

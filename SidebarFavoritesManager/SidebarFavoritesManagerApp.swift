import SwiftUI
import ServiceManagement

@main
struct SidebarFavoritesManagerApp: App {
    @StateObject private var configManager = ConfigManager.shared
    @StateObject private var coordinator = FavoriteSyncCoordinator.shared
    @State private var showingAddSheet = false

    init() {
        // Warm the menu bar icon store so custom icons are ready before the menu first opens.
        _ = MenuBarIconStore.shared
    }

    var body: some Scene {
        Window("Sidebar Favorites", id: "main") {
            ContentView(showingAddSheet: $showingAddSheet)
                .environmentObject(configManager)
                .environmentObject(coordinator)
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        .commands {
            AppCommands(showingAddSheet: $showingAddSheet)
        }

        Settings {
            SettingsView()
                .environmentObject(configManager)
        }

        // Menu bar icon - always visible, controlled by isInserted
        MenuBarExtra("SidebarFavorites", systemImage: "sidebar.left", isInserted: .constant(configManager.config.settings.showInMenuBar)) {
            MenuBarView()
                .environmentObject(configManager)
                .environmentObject(coordinator)
        }
        .menuBarExtraStyle(.menu)
    }
}

/// Menu commands that need access to app-level state, kept separate from the App's
/// scene body so `Cmd-N` reaches the same `showingAddSheet` binding `ContentView` reads.
struct AppCommands: Commands {
    @Binding var showingAddSheet: Bool
    @Environment(\.openWindow) private var openWindow

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("Add Favorite...") {
                // Ensure the main window is open before flipping the sheet flag,
                // so Cmd-N works even if the window was closed.
                openWindow(id: "main")
                showingAddSheet = true
            }
            .keyboardShortcut("n", modifiers: .command)
        }
    }
}

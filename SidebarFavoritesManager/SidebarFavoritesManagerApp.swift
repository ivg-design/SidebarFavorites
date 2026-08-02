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
        // `.contentSize` pinned the window to its content, so a list longer than
        // the window could only be scrolled, never given more room.
        .windowResizability(.contentMinSize)
        .defaultSize(width: 400, height: 560)
        .commands {
            AppCommands(showingAddSheet: $showingAddSheet)
        }

        // The favorite editor. A window rather than a sheet so it can be moved
        // and resized, and so it does not cover the list it is describing.
        // One window per value: re-editing the same favorite focuses the window
        // already showing it.
        WindowGroup(id: "editor", for: String.self) { $token in
            FavoriteEditorWindow(token: token ?? FavoriteEditorWindow.newFavoriteToken)
                .environmentObject(configManager)
                .environmentObject(coordinator)
        }
        .defaultSize(width: 480, height: 720)
        .windowResizability(.contentMinSize)

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
                // The editor is its own window now, so this no longer depends on
                // the main window being open.
                openWindow(id: "editor", value: FavoriteEditorWindow.newFavoriteToken)
            }
            .keyboardShortcut("n", modifiers: .command)
        }
    }
}

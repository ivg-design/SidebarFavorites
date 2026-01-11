import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject var configManager: ConfigManager
    @EnvironmentObject var lifecycleManager: LifecycleManager

    var body: some View {
        // Show favorites
        if configManager.config.favorites.isEmpty {
            Text("No Favorites")
                .foregroundColor(.secondary)
        } else {
            ForEach(configManager.config.favorites) { favorite in
                Button(action: {
                    lifecycleManager.revealInFinder(favorite.folderPath)
                }) {
                    Label(favorite.name, systemImage: favorite.iconType == .sfSymbol ? favorite.iconValue : "folder")
                }
            }
        }

        Divider()

        Button("Open SidebarFavorites...") {
            NSApp.activate(ignoringOtherApps: true)
            if let window = NSApp.windows.first(where: { $0.title.contains("Sidebar") || $0.contentView != nil }) {
                window.makeKeyAndOrderFront(nil)
            } else {
                // Open a new window if none exists
                NSApp.windows.first?.makeKeyAndOrderFront(nil)
            }
        }
        .keyboardShortcut("o", modifiers: .command)

        Button("Refresh All") {
            Task {
                lifecycleManager.stopAll()
                try? await lifecycleManager.startAllEnabled()
                lifecycleManager.restartFinder()
            }
        }

        Divider()

        Button("Extensions Settings...") {
            lifecycleManager.openExtensionsSettings()
        }

        Button("Preferences...") {
            NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
        }
        .keyboardShortcut(",", modifiers: .command)

        Divider()

        Button("Quit SidebarFavorites") {
            NSApp.terminate(nil)
        }
        .keyboardShortcut("q", modifiers: .command)
    }
}

#Preview {
    MenuBarView()
        .environmentObject(ConfigManager.shared)
        .environmentObject(LifecycleManager.shared)
}

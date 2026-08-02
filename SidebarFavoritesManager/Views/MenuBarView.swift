import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject var configManager: ConfigManager
    @EnvironmentObject var coordinator: FavoriteSyncCoordinator
    @ObservedObject private var iconStore = MenuBarIconStore.shared
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        // Show favorites
        if configManager.config.favorites.isEmpty {
            Text("No Favorites")
                .foregroundColor(.secondary)
        } else {
            ForEach(configManager.config.favorites) { favorite in
                Button(action: {
                    coordinator.revealInFinder(favorite.folderPath)
                }) {
                    Label {
                        Text(favorite.name)
                    } icon: {
                        if let image = iconStore.icons[favorite.id] {
                            Image(nsImage: image)
                                .renderingMode(.template)
                        } else {
                            Image(systemName: favorite.iconType == .sfSymbol ? favorite.iconValue : "folder")
                        }
                    }
                }
            }
        }

        Divider()

        Button("Open SidebarFavorites...") {
            NSApp.activate(ignoringOtherApps: true)
            openWindow(id: "main")
        }
        .keyboardShortcut("o", modifiers: .command)

        Button("Refresh All") {
            Task { await coordinator.syncAll(force: true) }
        }

        if #available(macOS 14.0, *) {
            SettingsLink {
                Text("Preferences...")
            }
            .keyboardShortcut(",", modifiers: .command)
        } else {
            Button("Preferences...") {
                NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
            }
            .keyboardShortcut(",", modifiers: .command)
        }

        Divider()

        // Same build string the main window's footer shows, so the version is
        // readable without opening anything.
        Text("SidebarFavorites \(AppVersion.display)")

        Button("Quit SidebarFavorites") {
            NSApp.terminate(nil)
        }
        .keyboardShortcut("q", modifiers: .command)
    }
}

#Preview {
    MenuBarView()
        .environmentObject(ConfigManager.shared)
        .environmentObject(FavoriteSyncCoordinator.shared)
}

import SwiftUI

/// Hosts the favorite editor in its own window.
///
/// The editor used to be a sheet, which meant it could be neither moved nor
/// resized and covered the list it was describing. A window scene fixes all
/// three, and SwiftUI reuses one window per value - so editing the same
/// favorite twice brings the existing window forward instead of stacking a
/// second copy of it.
///
/// The scene value is a string rather than an optional UUID: `WindowGroup(for:)`
/// hands back a binding to an optional of whatever it is given, and an optional
/// UUID would arrive as a double optional. `newFavoriteToken` means "add".
struct FavoriteEditorWindow: View {
    static let newFavoriteToken = "new"

    let token: String

    @EnvironmentObject private var configManager: ConfigManager
    @EnvironmentObject private var coordinator: FavoriteSyncCoordinator
    @Environment(\.dismiss) private var dismiss

    /// The favorite being edited, read live from the config: the window may have
    /// been left open while a reconcile rewrote the binding underneath it.
    private var favorite: Favorite? {
        guard token != Self.newFavoriteToken, let id = UUID(uuidString: token) else { return nil }
        return configManager.getFavorite(id: id)
    }

    var body: some View {
        AddEditFavoriteSheet(
            favorite: favorite,
            onApply: { updated in await persist(updated, restartFinder: true) }
        ) { updated in
            Task { _ = await persist(updated, restartFinder: false) }
        }
        .navigationTitle(favorite == nil ? "Add Favorite" : "Edit Favorite")
    }

    /// Writes the favorite and lets the coordinator reconcile it.
    ///
    /// Same order the sheet used: the previous copy is read before the write so
    /// the coordinator can compare old against new. Failures are published on
    /// the coordinator rather than shown here - the main window already alerts
    /// on `lastError`, and this window may be closed by the time one arrives.
    @discardableResult
    private func persist(_ favorite: Favorite, restartFinder: Bool) async -> String? {
        let previous = configManager.getFavorite(id: favorite.id)
        do {
            if previous != nil {
                try configManager.updateFavorite(favorite)
            } else {
                try configManager.addFavorite(favorite)
            }
        } catch {
            coordinator.report(error: error.localizedDescription)
            return error.localizedDescription
        }

        if let previous {
            await coordinator.favoriteUpdated(favorite, previous: previous)
        } else {
            await coordinator.favoriteAdded(favorite)
        }

        if restartFinder {
            await coordinator.restartFinderAndWait()
            return coordinator.lastError
        }
        return nil
    }
}

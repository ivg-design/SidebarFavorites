import Foundation
import AppKit
import Combine

/// Caches rendered custom-icon thumbnails for the menu bar, keyed by favorite id.
///
/// SwiftUI's `.menu`-style `MenuBarExtra` content is built synchronously, so it can't
/// `await` an SVG render inline. This store proactively renders and republishes an
/// `NSImage` for every custom-icon favorite whenever the configuration changes, so
/// `MenuBarView` can simply read `icons[favorite.id]` when building its menu items.
@MainActor
final class MenuBarIconStore: ObservableObject {
    static let shared = MenuBarIconStore()

    @Published private(set) var icons: [UUID: NSImage] = [:]

    private var cancellables = Set<AnyCancellable>()

    /// In-flight render task per favorite id. Tracking these lets a superseded
    /// render (the favorite switched away from a custom icon, or was edited again
    /// before the previous render finished) be cancelled so it can't complete late
    /// and clobber `icons` with stale data.
    private var renderTasks: [UUID: Task<Void, Never>] = [:]

    private init() {
        ConfigManager.shared.$config
            .sink { [weak self] config in
                self?.refresh(for: config.favorites)
            }
            .store(in: &cancellables)
    }

    private func refresh(for favorites: [Favorite]) {
        // Drop icons (and cancel any in-flight render) for favorites that no longer
        // exist *or* no longer use a custom icon. Pruning only by id let a favorite
        // that switched back to an SF Symbol keep rendering its stale cached
        // NSImage for the rest of the session, since MenuBarView prefers this dict
        // whenever an entry is present.
        let customFavorites = favorites.filter { $0.iconType == .custom && $0.customSVGPath != nil }
        let customIds = Set(customFavorites.map(\.id))

        icons = icons.filter { customIds.contains($0.key) }
        for (id, task) in renderTasks where !customIds.contains(id) {
            task.cancel()
            renderTasks.removeValue(forKey: id)
        }

        for favorite in customFavorites {
            guard let relativePath = favorite.customSVGPath else { continue }
            let url = ConfigManager.shared.customIconURL(relativePath: relativePath)

            // Cancel any still-running render for this favorite before starting a
            // new one, so an older edit can't finish after a newer one and
            // overwrite it with stale art.
            renderTasks[favorite.id]?.cancel()
            renderTasks[favorite.id] = Task { [weak self] in
                // A re-import can overwrite the SVG file at this exact relative
                // path (e.g. the destination name is derived from the favorite's
                // name), which the URL-keyed thumbnail cache can't detect on its
                // own. Invalidate first so every render reflects what's on disk
                // right now rather than whatever was rendered under this URL
                // previously.
                await SVGThumbnailCache.shared.invalidate(for: url)
                guard let image = await SVGThumbnailCache.shared.thumbnail(
                          for: url,
                          size: 16,
                          iconScale: CGFloat(favorite.effectiveIconScale)
                      ),
                      !Task.isCancelled else {
                    return
                }
                self?.icons[favorite.id] = image
                self?.renderTasks.removeValue(forKey: favorite.id)
            }
        }
    }
}

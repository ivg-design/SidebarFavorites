import SwiftUI

struct ContentView: View {
    @EnvironmentObject var configManager: ConfigManager
    @EnvironmentObject var lifecycleManager: LifecycleManager
    @State private var showingAddSheet = false
    @State private var editingFavorite: Favorite?
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var extensionStatuses: [UUID: Bool] = [:]
    @State private var showingExtensionAlert = false
    @State private var alertFavoriteName = ""

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Sidebar Favorites")
                    .font(.title2)
                    .fontWeight(.semibold)

                Spacer()

                Button(action: { showingAddSheet = true }) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 22))
                }
                .buttonStyle(.plain)
                .foregroundColor(.accentColor)
                .help("Add Favorite")
            }
            .padding()
            .background(Color(NSColor.windowBackgroundColor))

            Divider()

            // Favorites list
            if configManager.config.favorites.isEmpty {
                emptyState
            } else {
                favoritesList
            }

            Divider()

            // Footer with actions
            footer
        }
        .frame(width: 400, height: 500)
        .sheet(isPresented: $showingAddSheet) {
            AddEditFavoriteSheet(favorite: nil) { newFavorite in
                addFavorite(newFavorite)
            }
        }
        .sheet(item: $editingFavorite) { favorite in
            AddEditFavoriteSheet(favorite: favorite) { updatedFavorite in
                updateFavorite(updatedFavorite)
            }
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
        .alert("Extension Not Enabled", isPresented: $showingExtensionAlert) {
            Button("Open Settings") {
                lifecycleManager.openExtensionsSettings()
            }
            Button("Later", role: .cancel) {}
        } message: {
            Text("The extension for '\(alertFavoriteName)' needs to be enabled in System Settings → Login Items & Extensions → Finder Extensions.")
        }
        .task {
            await startEnabledApps()
            refreshExtensionStatuses()
        }
        .onReceive(Timer.publish(every: 3, on: .main, in: .common).autoconnect()) { _ in
            refreshExtensionStatuses()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "sidebar.left")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text("No Favorites")
                .font(.headline)
            Text("Add folders to display custom icons in Finder's sidebar")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Button("Add Favorite") {
                showingAddSheet = true
            }
            .buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding()
    }

    private var favoritesList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(configManager.config.favorites) { favorite in
                    FavoriteRow(
                        favorite: favorite,
                        isRunning: lifecycleManager.runningApps.contains(favorite.id),
                        isExtensionEnabled: extensionStatuses[favorite.id] ?? false,
                        onEdit: { editingFavorite = favorite },
                        onDelete: { deleteFavorite(favorite) },
                        onToggle: { toggleFavorite(favorite) },
                        onReveal: { lifecycleManager.revealInFinder(favorite.folderPath) },
                        onOpenExtensions: { lifecycleManager.openExtensionsSettings() }
                    )
                    Divider()
                }
            }
        }
    }

    private var footer: some View {
        HStack {
            Button(action: { lifecycleManager.openExtensionsSettings() }) {
                Label("Extensions", systemImage: "gearshape")
            }
            .buttonStyle(.borderless)
            .help("Open System Settings to enable Finder extensions")

            Spacer()

            Button(action: refreshAll) {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderless)
            .help("Restart all icon apps and refresh Finder")
        }
        .padding()
        .background(Color(NSColor.windowBackgroundColor))
    }

    private func addFavorite(_ favorite: Favorite) {
        do {
            try configManager.addFavorite(favorite)
            Task {
                do {
                    try await lifecycleManager.ensureIconAppRunning(for: favorite)
                    // Restart Finder to refresh sidebar icons
                    lifecycleManager.restartFinder()

                    // Wait a moment then check if extension is enabled
                    try await Task.sleep(nanoseconds: 1_500_000_000) // 1.5 seconds
                    await MainActor.run {
                        refreshExtensionStatuses()
                        if !lifecycleManager.isExtensionEnabled(for: favorite) {
                            alertFavoriteName = favorite.name
                            showingExtensionAlert = true
                        }
                    }
                } catch {
                    await MainActor.run { showError(error) }
                }
            }
        } catch {
            showError(error)
        }
    }

    private func updateFavorite(_ favorite: Favorite) {
        do {
            try configManager.updateFavorite(favorite)
            Task {
                do {
                    lifecycleManager.stopIconApp(for: favorite)
                    try await lifecycleManager.ensureIconAppRunning(for: favorite)
                    // Restart Finder to refresh sidebar icons
                    lifecycleManager.restartFinder()
                } catch {
                    await MainActor.run { showError(error) }
                }
            }
        } catch {
            showError(error)
        }
    }

    private func deleteFavorite(_ favorite: Favorite) {
        do {
            lifecycleManager.stopIconApp(for: favorite)
            try IconAppGenerator.shared.removeIconApp(for: favorite)
            try configManager.removeFavorite(id: favorite.id)
        } catch {
            showError(error)
        }
    }

    private func toggleFavorite(_ favorite: Favorite) {
        var updated = favorite
        updated.enabled.toggle()
        do {
            try configManager.updateFavorite(updated)
            if updated.enabled {
                Task {
                    try await lifecycleManager.ensureIconAppRunning(for: updated)
                }
            } else {
                lifecycleManager.stopIconApp(for: updated)
            }
        } catch {
            showError(error)
        }
    }

    private func refreshAll() {
        Task {
            lifecycleManager.stopAll()
            try await lifecycleManager.startAllEnabled()
            lifecycleManager.restartFinder()
        }
    }

    private func startEnabledApps() async {
        do {
            try await lifecycleManager.startAllEnabled()
        } catch {
            showError(error)
        }
    }

    private func showError(_ error: Error) {
        errorMessage = error.localizedDescription
        showingError = true
    }

    private func refreshExtensionStatuses() {
        extensionStatuses = lifecycleManager.getExtensionStatuses()
    }
}

#Preview {
    ContentView()
        .environmentObject(ConfigManager.shared)
        .environmentObject(LifecycleManager.shared)
}

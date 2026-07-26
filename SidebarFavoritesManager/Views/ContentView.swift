import SwiftUI

struct ContentView: View {
    @EnvironmentObject var configManager: ConfigManager
    @EnvironmentObject var coordinator: FavoriteSyncCoordinator
    @Binding var showingAddSheet: Bool
    @State private var editingFavorite: Favorite?
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var deletingFavoriteIDs: Set<UUID> = []
    @State private var warningsExpanded = false
    // Names the favorite about to be removed; the confirmationDialog's isPresented
    // binding is derived from this being non-nil.
    @State private var favoritePendingDeletion: Favorite?
    // Set only when disabling would delete a row this app added to Finder's
    // sidebar (see toggleFavorite/performToggle below). Adopted/unbound rows never
    // populate this - disabling them only clears an icon override, which is not
    // destructive and needs no confirmation.
    @State private var favoritePendingDisableConfirmation: Favorite?
    // Local shadow of coordinator.lastError so the alert's "OK" button can actually
    // dismiss it - coordinator.lastError is private(set), so the UI cannot clear the
    // published property directly.
    @State private var coordinatorErrorMessage: String?

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

            if !coordinator.warnings.isEmpty {
                warningsBanner
                Divider()
            }

            if needsFinderRestart {
                finderRestartBanner
                Divider()
            }

            // Footer with actions
            footer
        }
        .frame(width: 400, height: 500)
        .sheet(isPresented: $showingAddSheet) {
            AddEditFavoriteSheet(
                favorite: nil,
                onApply: { favorite in await applyFavorite(favorite) }
            ) { newFavorite in
                Task { _ = await persistFavorite(newFavorite) }
            }
        }
        .sheet(item: $editingFavorite) { favorite in
            AddEditFavoriteSheet(
                favorite: favorite,
                onApply: { updated in await applyFavorite(updated) }
            ) { updatedFavorite in
                Task { _ = await persistFavorite(updatedFavorite) }
            }
        }
        // Consent, not progress: nothing has happened yet when this appears.
        // Dismissing by any route (Esc, "Not Now") is a decline, which leaves the
        // machine exactly as it was and re-offers on the next launch.
        .sheet(isPresented: Binding(
            get: { coordinator.isShowingMigrationConsent },
            set: { isPresented in
                if !isPresented { coordinator.declineMigration() }
            }
        )) {
            if let plan = coordinator.migrationPlan {
                MigrationConsentSheet(
                    plan: plan,
                    onUpgrade: { await coordinator.approveMigration() },
                    onDecline: { coordinator.declineMigration() }
                )
            }
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
        // Names the favorite being removed; the trash button is hover-revealed and
        // sits right next to the enable toggle, so a single unconfirmed click here
        // is too easy to fire by accident.
        .confirmationDialog(
            "Remove \"\(favoritePendingDeletion?.name ?? "")\"?",
            isPresented: Binding(
                get: { favoritePendingDeletion != nil },
                set: { isPresented in if !isPresented { favoritePendingDeletion = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) {
                if let favorite = favoritePendingDeletion {
                    deleteFavorite(favorite)
                }
                favoritePendingDeletion = nil
            }
            Button("Cancel", role: .cancel) {
                favoritePendingDeletion = nil
            }
        } message: {
            Text(deletionConsequenceMessage)
        }
        // Disabling a favorite this app added to Finder's sidebar deletes that row
        // outright (FavoriteSyncCoordinator's withdraw only spares rows it did not
        // insert itself), and re-enabling reinserts it at the bottom of the list,
        // not its original position. The coordinator has no non-destructive path
        // for a managed row today - favoriteToggled() funnels into the same
        // reconcile/withdraw logic used for delete - so this confirms instead of
        // silently losing the row's place. Adopted/unbound rows are already
        // non-destructive on disable (only the icon override is cleared) and never
        // reach this dialog.
        .confirmationDialog(
            "Turn Off \"\(favoritePendingDisableConfirmation?.name ?? "")\"?",
            isPresented: Binding(
                get: { favoritePendingDisableConfirmation != nil },
                set: { isPresented in if !isPresented { favoritePendingDisableConfirmation = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Turn Off and Remove Row", role: .destructive) {
                if let favorite = favoritePendingDisableConfirmation {
                    performToggle(favorite)
                }
                favoritePendingDisableConfirmation = nil
            }
            Button("Cancel", role: .cancel) {
                favoritePendingDisableConfirmation = nil
            }
        } message: {
            Text("This app added this row to Finder's sidebar. Turning it off removes the row entirely; turning it back on re-adds it at the bottom of the list, not its original position.")
        }
        .alert("Error", isPresented: Binding(
            get: { coordinatorErrorMessage != nil },
            set: { isPresented in
                if !isPresented { coordinatorErrorMessage = nil }
            }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(coordinatorErrorMessage ?? "")
        }
        .onChange(of: coordinator.lastError) { newValue in
            coordinatorErrorMessage = newValue
        }
        .task {
            await coordinator.bootstrap()
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
            Text("Add folders to Finder's sidebar with custom icons")
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
                        inSidebar: coordinator.boundItems[favorite.id] != nil,
                        isAdopted: favorite.sidebarProvenance == .adopted,
                        onEdit: { editingFavorite = favorite },
                        onDelete: { favoritePendingDeletion = favorite },
                        onToggle: { toggleFavorite(favorite) },
                        onReveal: { coordinator.revealInFinder(favorite.folderPath) }
                    )
                    // Reconciling a delete can take a moment (helper rebuild, sidebar
                    // patch, possible Finder restart); disable the row's controls while
                    // it's in flight so a double-delete or an edit mid-removal can't race.
                    .disabled(deletingFavoriteIDs.contains(favorite.id))
                    Divider()
                }
            }
        }
    }

    private var warningsBanner: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button(action: { withAnimation { warningsExpanded.toggle() } }) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.yellow)
                    Text(coordinator.warnings.count == 1 ? "1 Warning" : "\(coordinator.warnings.count) Warnings")
                        .font(.caption)
                        .fontWeight(.medium)
                    Spacer()
                    Image(systemName: warningsExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if warningsExpanded {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(coordinator.warnings, id: \.self) { warning in
                        Text(warning)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                HStack {
                    Spacer()
                    Button("Dismiss") {
                        coordinator.dismissWarnings()
                        warningsExpanded = false
                    }
                    .buttonStyle(.borderless)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.yellow.opacity(0.12))
    }

    // Reconcile no longer restarts Finder automatically (that work belongs to
    // another change to FavoriteSyncCoordinator) - it instead publishes that a
    // restart is owed, and this offers the explicit, user-initiated way to do it.
    //
    // The coordinator publishes this when a reconcile changed icons but Finder
    // has not redrawn yet. It never restarts Finder on its own - the banner
    // below offers it, and `restartFinder()` clears the flag.
    private var needsFinderRestart: Bool {
        coordinator.needsFinderRestart
    }

    private var finderRestartBanner: some View {
        HStack {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundColor(.orange)
            Text("Some icon changes need Finder to restart before they appear.")
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Button("Restart Finder") {
                coordinator.restartFinder()
            }
            .buttonStyle(.borderless)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.orange.opacity(0.12))
    }

    private var footer: some View {
        HStack {
            Text(statusText)
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()

            // An outstanding upgrade blocks every sync, so offer the way out of
            // that state rather than a Refresh button that only re-asks.
            if coordinator.migrationPlan != nil {
                Button("Upgrade…") {
                    coordinator.presentMigrationConsent()
                }
                .buttonStyle(.borderless)
                .help("Review and finish the upgrade to version 1.0")
            } else {
                Button(action: { Task { await coordinator.syncAll(force: true) } }) {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .help("Rebuild the helper icons and refresh the sidebar")
            }
        }
        .padding()
        .background(Color(NSColor.windowBackgroundColor))
    }

    private var statusText: String {
        // Takes precedence over the phase: while an upgrade is outstanding the
        // coordinator is idle by design, and "Ready" would be a lie.
        if coordinator.migrationPlan != nil, coordinator.phase == .idle {
            return "Upgrade to 1.0 not finished"
        }
        return phaseStatusText
    }

    private var phaseStatusText: String {
        switch coordinator.phase {
        case .idle:
            return "Ready"
        case .migrating:
            return "Upgrading…"
        case .building:
            return "Updating icons…"
        case .reconciling:
            return "Updating sidebar…"
        case .restartingFinder:
            return "Restarting Finder…"
        }
    }

    /// Write the favorite and let the coordinator reconcile it, returning a message
    /// if that failed.
    ///
    /// Add or update is decided by whether the config already holds this id, NOT by
    /// which sheet is on screen. The Add sheet's Apply button writes the new
    /// favorite while the sheet is still open, so the Save that follows from that
    /// same sheet is an update - deciding by sheet would insert a duplicate.
    @discardableResult
    private func persistFavorite(_ favorite: Favorite) async -> String? {
        // Captured before the write overwrites it, so the coordinator can compare
        // old vs. new (folder path, icon) against the live sidebar snapshot.
        let previous = configManager.getFavorite(id: favorite.id)
        do {
            if previous != nil {
                try configManager.updateFavorite(favorite)
            } else {
                try configManager.addFavorite(favorite)
            }
        } catch {
            showError(error)
            return error.localizedDescription
        }

        if let previous {
            await coordinator.favoriteUpdated(favorite, previous: previous)
        } else {
            await coordinator.favoriteAdded(favorite)
        }
        return nil
    }

    /// The Apply button: persist, wait for the helper rebuild and the sidebar pass,
    /// then restart Finder.
    ///
    /// The restart is still explicitly user-initiated and still goes through the
    /// coordinator's single entry point, which is also what clears
    /// `needsFinderRestart` - so the banner does not linger claiming a restart is
    /// owed after one has just happened.
    private func applyFavorite(_ favorite: Favorite) async -> String? {
        if let failure = await persistFavorite(favorite) {
            return failure
        }
        await coordinator.restartFinderAndWait()
        return coordinator.lastError
    }

    private func deleteFavorite(_ favorite: Favorite) {
        guard !deletingFavoriteIDs.contains(favorite.id) else { return }
        deletingFavoriteIDs.insert(favorite.id)

        Task {
            // The coordinator needs the favorite's osType/binding to tear down its
            // sidebar row and helper declaration, so it must run before the favorite
            // is removed from config.
            await coordinator.favoriteRemoved(favorite)
            do {
                try configManager.removeFavorite(id: favorite.id)
            } catch {
                showError(error)
            }
            deletingFavoriteIDs.remove(favorite.id)
        }
    }

    private func toggleFavorite(_ favorite: Favorite) {
        // Only turning OFF a row this app added is destructive (it deletes the
        // sidebar row rather than just hiding the icon - see the confirmationDialog
        // above for why). Turning on, and turning off an adopted/unbound favorite,
        // proceed immediately.
        if favorite.enabled, favorite.sidebarProvenance == .managed {
            favoritePendingDisableConfirmation = favorite
            return
        }
        performToggle(favorite)
    }

    private func performToggle(_ favorite: Favorite) {
        var updated = favorite
        updated.enabled.toggle()
        do {
            try configManager.updateFavorite(updated)
            Task { await coordinator.favoriteToggled(updated) }
        } catch {
            showError(error)
        }
    }

    /// What deleting this favorite will actually do to its sidebar row, so the
    /// confirmation doesn't just repeat the favorite's name.
    private var deletionConsequenceMessage: String {
        guard let favorite = favoritePendingDeletion else { return "" }
        if favorite.sidebarProvenance == .adopted {
            return "This clears its custom icon. The row stays in Finder's sidebar - it was already there before this app touched it."
        }
        return "This removes it from Finder's sidebar."
    }

    private func showError(_ error: Error) {
        errorMessage = error.localizedDescription
        showingError = true
    }
}

#Preview {
    ContentView(showingAddSheet: .constant(false))
        .environmentObject(ConfigManager.shared)
        .environmentObject(FavoriteSyncCoordinator.shared)
}

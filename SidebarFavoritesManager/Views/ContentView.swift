import SwiftUI

struct ContentView: View {
    @EnvironmentObject var configManager: ConfigManager
    @EnvironmentObject var coordinator: FavoriteSyncCoordinator
    @Binding var showingAddSheet: Bool
    @Environment(\.openWindow) private var openWindow
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var deletingFavoriteIDs: Set<UUID> = []
    @State private var warningsExpanded = false
    @State private var showingSpacerNotice = false
    // Once the user has read the spacer notice and asked not to see it again.
    @AppStorage("spacerNoticeAcknowledged") private var spacerNoticeAcknowledged = false

    /// A newer release found at launch, if any. Drives the update alert.
    @State private var availableUpdate: UpdateChecker.Update?
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

                Button(action: addSpacer) {
                    Image(systemName: "rectangle.dashed")
                        .font(.system(size: 18))
                }
                .buttonStyle(.plain)
                .foregroundColor(.accentColor)
                .help("Add Spacer - a blank row in Finder's sidebar, opened by a do-nothing helper app")

                Button(action: { openEditor(FavoriteEditorWindow.newFavoriteToken) }) {
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

            // Spacers are the one thing positioned from here rather than in Finder,
            // so while one is in the sidebar the window says so, pointing at the
            // arrows. No spacer, no notice.
            if configManager.config.favorites.contains(where: { $0.isSpacer && $0.enabled }) {
                spacerMoveNotice
                Divider()
            }

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
        // A floor, not a fixed size: the list scrolls, but a long list is much
        // easier to work with in a taller window, so the window is resizable and
        // this only stops it being shrunk past usefulness.
        .frame(minWidth: 400, idealWidth: 400, maxWidth: .infinity,
               minHeight: 380, idealHeight: 560, maxHeight: .infinity)
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
        // Spacers put a generated app on disk and point a sidebar row at it -
        // say so plainly before the first one is made, not after.
        .alert("Spacers use a do-nothing helper app", isPresented: $showingSpacerNotice) {
            Button("Add Spacer") { createSpacer() }
            Button("Add, and Don't Show Again") {
                spacerNoticeAcknowledged = true
                createSpacer()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("""
                A sidebar row has to point at something, and a row pointing at a folder opens it when clicked. So each spacer is an empty, blank-named file that only one small helper app, "SidebarFavorites Spacer", can open - and the helper does nothing: clicking a spacer starts it and it quits at once, with no window, no Dock icon and nothing left running.

                SidebarFavorites creates the helper in ~/Library/Application Support/SidebarFavorites/Spacers.noindex, ad-hoc signs it and registers it as the only app for that private file type. Removing the last spacer deletes it.

                How to place a spacer:
                1. The new spacer appears at the bottom of Finder's sidebar.
                2. In this window, find its row - it is labelled "Spacer".
                3. Click the up or down arrow on that row. Each click moves the spacer one place in Finder's sidebar.

                Finder itself can't drag a spacer: a blank row has nothing to grab.
                """)
        }
        .confirmationDialog(
            "Remove \"\(favoritePendingDeletion?.listTitle ?? "")\"?",
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
            "Turn Off \"\(favoritePendingDisableConfirmation?.listTitle ?? "")\"?",
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
            #if DEBUG
            // Screenshot mode must never reconcile the real sidebar or hit the network.
            if ScreenshotMode.isActive { return }
            #endif
            await coordinator.bootstrap()

            // After the sidebar is in order, not before: a version check must
            // never delay the app doing its job, and it is fine for it to finish
            // long after the window is usable.
            availableUpdate = await UpdateChecker.checkForUpdate()
        }
        .alert("A new version is available", isPresented: Binding(
            get: { availableUpdate != nil },
            set: { if !$0 { availableUpdate = nil } }
        )) {
            Button("Download") {
                if let update = availableUpdate {
                    NSWorkspace.shared.open(update.pageURL)
                }
                availableUpdate = nil
            }
            Button("Later", role: .cancel) { availableUpdate = nil }
        } message: {
            if let update = availableUpdate {
                Text("SidebarFavorites \(update.version) is out. You have \(UpdateChecker.runningVersion).")
            }
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
                openEditor(FavoriteEditorWindow.newFavoriteToken)
            }
            .buttonStyle(.borderedProminent)
            Spacer()
        }
        .padding()
    }

    private var spacerMoveNotice: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: "arrow.up.arrow.down")
                .foregroundColor(.accentColor)
            Text("Finder can't drag a spacer. To move one, use the \(Image(systemName: "chevron.up")) \(Image(systemName: "chevron.down")) arrows on its row below - each click moves it one place in Finder's sidebar.")
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.accentColor.opacity(0.08))
    }

    private var favoritesList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(configManager.config.favorites) { favorite in
                    FavoriteRow(
                        favorite: favorite,
                        inSidebar: coordinator.boundItems[favorite.id] != nil,
                        isAdopted: favorite.sidebarProvenance == .adopted,
                        onEdit: { openEditor(favorite.id.uuidString) },
                        onDelete: { favoritePendingDeletion = favorite },
                        onToggle: { toggleFavorite(favorite) },
                        onReveal: { coordinator.revealInFinder(favorite.folderPath) },
                        onMove: { offset in Task { await coordinator.moveInSidebar(favorite, by: offset) } }
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
            // The build, always - "Ready" said nothing a user could act on, and
            // this is the number a bug report needs. Transient phases still take
            // the slot while work is in flight.
            Text(coordinator.phase == .idle && coordinator.migrationPlan == nil
                 ? AppVersion.display
                 : statusText)
                .font(.caption)
                .foregroundColor(.secondary)
                .help("SidebarFavorites \(AppVersion.display)")

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
    /// Opens (or focuses) the editor window for a favorite id, or for a new
    /// favorite. The main window is no longer involved: the editor is its own
    /// window, so it can be moved, resized and left open beside the list.
    private func openEditor(_ token: String) {
        openWindow(id: "editor", value: token)
    }

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

    private func addSpacer() {
        if spacerNoticeAcknowledged {
            createSpacer()
        } else {
            showingSpacerNotice = true
        }
    }

    /// A spacer needs no choices, so it skips the editor: its app and blank
    /// artwork are made here (off the main thread - that runs `codesign`) and it
    /// goes through the same path as any new favorite. Its row is added at the
    /// bottom of the sidebar, inserted with its icon already set, so no Finder
    /// restart is owed.
    private func createSpacer() {
        Task {
            do {
                let spacer = try await Task.detached { try SpacerStore.makeSpacer() }.value
                _ = await persistFavorite(spacer)
            } catch {
                showError(error)
            }
        }
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
                SpacerStore.removeFiles(for: favorite)
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

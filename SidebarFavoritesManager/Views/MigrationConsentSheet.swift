import SwiftUI

/// Asks for explicit permission before the 1.0 upgrade changes anything.
///
/// Every fact on this sheet comes from `MigrationService.preflight()`, which only
/// reads: the apps are named because they were actually found on disk and
/// identified themselves as ours, not because they were guessed from config.json.
/// If the list is empty, that is because nothing was found - not because the scan
/// was skipped.
struct MigrationConsentSheet: View {
    let plan: MigrationService.MigrationPlan

    /// Runs the upgrade. Returns once the teardown has finished; the coordinator
    /// takes the sheet down from there.
    let onUpgrade: () async -> Void

    /// "Not Now". Nothing is written, and the upgrade is offered again next launch.
    let onDecline: () -> Void

    @State private var showingDetails = false
    @State private var isUpgrading = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    removalSection
                    extensionSection
                    keepSection
                    detailsDisclosure
                }
                .padding(20)
            }
            .frame(maxHeight: 340)

            Divider()

            actions
        }
        .frame(width: 440)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Upgrade to Sidebar Favorites 1.0")
                .font(.title3)
                .fontWeight(.semibold)

            Text("Version 1.0 replaces the old setup - a separate helper app and Finder extension for every favorite - with a single icon helper. Nothing has been changed yet.")
                .font(.callout)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(20)
    }

    // MARK: - Sections

    private var removalSection: some View {
        PlanSection(
            title: "What will be removed",
            symbol: "trash",
            tint: .red
        ) {
            if plan.legacyApps.isEmpty {
                bullet("No old helper apps were found on this Mac, so nothing will be deleted.")
            } else {
                bullet("\(countPhrase(plan.legacyApps.count, "old helper app", "old helper apps")) in your Application Support folder:")

                VStack(alignment: .leading, spacing: 6) {
                    ForEach(plan.legacyApps) { app in
                        VStack(alignment: .leading, spacing: 1) {
                            Text(app.displayName)
                                .font(.callout)
                            Text(app.bundleIdentifier)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .help(app.url.path)
                    }
                }
                .padding(.leading, 18)
                .padding(.top, 2)

                bullet("These were only ever icon carriers. Removing them doesn't remove any favorite.")
            }
        }
    }

    @ViewBuilder
    private var extensionSection: some View {
        if !plan.legacyApps.isEmpty {
            PlanSection(
                title: "What will change",
                symbol: "puzzlepiece.extension",
                tint: .orange
            ) {
                if plan.extensionIdentifiers.isEmpty {
                    bullet("No Finder extension could be read inside those apps. You may need to switch a leftover one off yourself in System Settings > Extensions.")
                } else {
                    bullet("\(countPhrase(plan.extensionIdentifiers.count, "Finder extension", "Finder extensions")) will be unregistered. Version 1.0 doesn't use Finder extensions at all, so there is nothing left to enable in System Settings.")
                }

                if plan.willRewriteConfig {
                    bullet(configChangeSentence)
                }
            }
        }
    }

    private var keepSection: some View {
        PlanSection(
            title: "What will be kept",
            symbol: "checkmark.shield",
            tint: .green
        ) {
            bullet("\(countPhrase(plan.favoritesCarriedOver, "favorite", "favorites")) - names, folders and icons all carry over unchanged.")
            bullet("Custom artwork you imported. The Icons folder is never touched.")
            bullet("Sidebar rows you added yourself. The upgrade never removes a row from Finder's sidebar.")

            if plan.configExists {
                bullet("A copy of your current settings, saved as \(plan.configBackupURL.lastPathComponent) before anything changes.")
            }
        }
    }

    // MARK: - Details

    private var detailsDisclosure: some View {
        DisclosureGroup("What will change?", isExpanded: $showingDetails) {
            VStack(alignment: .leading, spacing: 10) {
                if !plan.legacyApps.isEmpty {
                    detailBlock("Apps to delete") {
                        ForEach(plan.legacyApps) { app in
                            detailLine(app.url.path)
                        }
                    }
                }

                if !plan.extensionIdentifiers.isEmpty {
                    detailBlock("Extensions to unregister") {
                        ForEach(plan.extensionIdentifiers, id: \.self) { identifier in
                            detailLine(identifier)
                        }
                    }
                }

                detailBlock("Settings file") {
                    detailLine(plan.configURL.path)
                    detailLine(plan.willRewriteConfig
                        ? configChangeSentence
                        : "Not modified.")
                    if plan.configExists {
                        detailLine("Copied to \(plan.configBackupURL.lastPathComponent) first.")
                    }
                }

                if !plan.entriesLeftInPlace.isEmpty {
                    detailBlock("Left alone") {
                        ForEach(plan.entriesLeftInPlace, id: \.self) { reason in
                            detailLine(reason)
                        }
                    }
                }

                detailBlock("Never touched") {
                    detailLine("Finder sidebar rows - the upgrade removes none.")
                    detailLine("Imported icon artwork in the Icons folder.")
                    detailLine("Anything outside the SidebarFavorites/Apps folder.")
                }

                Text("If you choose Not Now, nothing is changed and Sidebar Favorites will ask again the next time you open it.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 8)
        }
        .font(.callout)
    }

    private var configChangeSentence: String {
        var parts: [String] = []
        if plan.upgradesSchema {
            parts.append("its format is updated from version \(plan.fromVersion) to \(plan.toVersion)")
        }
        if plan.codesToAssign > 0 {
            parts.append("\(countPhrase(plan.codesToAssign, "favorite gets", "favorites get")) an internal icon code filled in")
        }
        guard !parts.isEmpty else { return "Your settings file isn't modified." }
        return "Your settings file is updated in place: \(parts.joined(separator: ", and ")). No favorite is added or removed."
    }

    // MARK: - Actions

    private var actions: some View {
        HStack {
            if isUpgrading {
                ProgressView()
                    .controlSize(.small)
                Text("Upgrading...")
                    .font(.callout)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button("Not Now") {
                onDecline()
            }
            .keyboardShortcut(.cancelAction)
            .disabled(isUpgrading)

            Button("Upgrade") {
                isUpgrading = true
                Task { await onUpgrade() }
            }
            .keyboardShortcut(.defaultAction)
            .buttonStyle(.borderedProminent)
            .disabled(isUpgrading)
        }
        .padding(20)
    }

    // MARK: - Building blocks

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Text("-")
                .font(.callout)
                .foregroundColor(.secondary)
            Text(text)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func detailBlock<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
            content()
        }
    }

    private func detailLine(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundColor(.secondary)
            .textSelection(.enabled)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func countPhrase(_ count: Int, _ singular: String, _ plural: String) -> String {
        "\(count) \(count == 1 ? singular : plural)"
    }

    /// A titled group of bullets. Deliberately not SwiftUI's `Section`, which
    /// would pick up List/Form styling this sheet does not want.
    private struct PlanSection<Content: View>: View {
        let title: String
        let symbol: String
        let tint: Color
        @ViewBuilder let content: Content

        init(title: String, symbol: String, tint: Color, @ViewBuilder content: () -> Content) {
            self.title = title
            self.symbol = symbol
            self.tint = tint
            self.content = content()
        }

        var body: some View {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: symbol)
                        .foregroundColor(tint)
                    Text(title)
                        .font(.headline)
                }
                VStack(alignment: .leading, spacing: 6) {
                    content
                }
            }
        }
    }
}

#Preview {
    MigrationConsentSheet(
        plan: MigrationService.MigrationPlan(
            legacyApps: [
                .init(
                    url: URL(fileURLWithPath: "/Users/me/Library/Application Support/SidebarFavorites/Apps/Downloads.app"),
                    displayName: "Downloads",
                    bundleIdentifier: "com.ivg-design.SidebarFavorites.Downloads",
                    extensionIdentifier: "com.ivg-design.SidebarFavorites.Downloads.IconAppSync"
                ),
                .init(
                    url: URL(fileURLWithPath: "/Users/me/Library/Application Support/SidebarFavorites/Apps/Projects.app"),
                    displayName: "Projects",
                    bundleIdentifier: "com.ivg-design.SidebarFavorites.Projects",
                    extensionIdentifier: "com.ivg-design.SidebarFavorites.Projects.IconAppSync"
                )
            ],
            entriesLeftInPlace: ["Notes.app (com.example.Notes) wasn't created by Sidebar Favorites, so it was left alone."],
            favoritesCarriedOver: 2,
            codesToAssign: 2,
            fromVersion: 1,
            toVersion: 3,
            configURL: URL(fileURLWithPath: "/Users/me/Library/Application Support/SidebarFavorites/config.json"),
            configBackupURL: URL(fileURLWithPath: "/Users/me/Library/Application Support/SidebarFavorites/config.pre-1.0.json"),
            configExists: true
        ),
        onUpgrade: {},
        onDecline: {}
    )
}

import SwiftUI

struct FavoriteRow: View {
    let favorite: Favorite
    let inSidebar: Bool     // coordinator.boundItems[favorite.id] != nil
    let isAdopted: Bool     // favorite.sidebarProvenance == .adopted
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onToggle: () -> Void
    let onReveal: () -> Void

    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.accentColor.opacity(0.1))
                    .frame(width: 40, height: 40)

                iconImage
                    .font(.system(size: 20))
                    .foregroundColor(.accentColor)
            }

            // Info
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(favorite.name)
                        .font(.headline)
                    if favorite.mode == .advanced {
                        Text("BOTH ICONS")
                            // Hovering reveals the row's action buttons, and
                            // SwiftUI answered the tighter HStack by wrapping
                            // the chip onto a second line. The chip is two words
                            // and always fits - it just has to be told it is not
                            // the flexible one.
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                            .font(.system(size: 9, weight: .semibold))
                            .tracking(0.5)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .overlay(
                                Capsule().strokeBorder(Color.accentColor.opacity(0.6))
                            )
                            .foregroundColor(.accentColor)
                            .help("The folder keeps its own icon; a Finder Sync helper draws the sidebar glyph")
                    }
                }

                Text(favorite.folderPath)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Spacer()

            // Status and actions
            if isHovering {
                HStack(spacing: 8) {
                    Button(action: onReveal) {
                        Image(systemName: "folder")
                    }
                    .buttonStyle(.borderless)
                    .help("Reveal in Finder")

                    Button(action: onEdit) {
                        Image(systemName: "pencil")
                    }
                    .buttonStyle(.borderless)
                    .help("Edit")

                    Button(action: onDelete) {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.borderless)
                    .foregroundColor(.red)
                    .help("Delete")
                }
            } else {
                statusIndicator
            }

            // Enable/disable toggle
            Toggle("", isOn: Binding(
                get: { favorite.enabled },
                set: { _ in onToggle() }
            ))
            .toggleStyle(.switch)
            .labelsHidden()
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(isHovering ? Color(NSColor.selectedContentBackgroundColor).opacity(0.3) : Color.clear)
        .contentShape(Rectangle())
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovering = hovering
            }
        }
    }

    @ViewBuilder
    private var statusIndicator: some View {
        let dot = HStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(statusText)
                .font(.caption)
                .foregroundColor(.secondary)
        }

        if isAdopted {
            dot.help("This row was already in your sidebar. Removing this favorite restores its normal icon but keeps the row.")
        } else {
            dot
        }
    }

    private var statusColor: Color {
        if !favorite.enabled {
            return .gray
        }
        return inSidebar ? .green : .orange
    }

    private var statusText: String {
        if !favorite.enabled {
            return "Disabled"
        }
        return inSidebar ? "In Sidebar" : "Not in Sidebar"
    }

    @ViewBuilder
    private var iconImage: some View {
        if favorite.iconType == .custom, let svgPath = favorite.customSVGPath {
            let url = ConfigManager.shared.customIconURL(relativePath: svgPath)
            SVGThumbnailView(
                url: url,
                size: 36,
                iconScale: CGFloat(favorite.effectiveIconScale)
            )
        } else {
            Image(systemName: favorite.iconValue)
        }
    }
}

#Preview {
    VStack(spacing: 0) {
        FavoriteRow(
            favorite: Favorite(name: "GitHub", folderPath: "~/github", iconValue: "folder.fill.badge.gearshape"),
            inSidebar: true,
            isAdopted: false,
            onEdit: {},
            onDelete: {},
            onToggle: {},
            onReveal: {}
        )
        Divider()
        FavoriteRow(
            favorite: Favorite(name: "Documents", folderPath: "~/Documents", iconValue: "doc.fill"),
            inSidebar: true,
            isAdopted: true,
            onEdit: {},
            onDelete: {},
            onToggle: {},
            onReveal: {}
        )
        Divider()
        FavoriteRow(
            favorite: Favorite(name: "Projects", folderPath: "~/Projects", iconValue: "star.fill", enabled: false),
            inSidebar: false,
            isAdopted: false,
            onEdit: {},
            onDelete: {},
            onToggle: {},
            onReveal: {}
        )
    }
    .frame(width: 400)
}

import SwiftUI

struct FavoriteRow: View {
    let favorite: Favorite
    let isRunning: Bool
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
                Text(favorite.name)
                    .font(.headline)

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
                // Status indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)
                    Text(statusText)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
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

    private var statusColor: Color {
        if !favorite.enabled {
            return .gray
        }
        return isRunning ? .green : .orange
    }

    private var statusText: String {
        if !favorite.enabled {
            return "Disabled"
        }
        return isRunning ? "Active" : "Starting..."
    }

    @ViewBuilder
    private var iconImage: some View {
        if favorite.iconType == .custom {
            customIconView
        } else {
            Image(systemName: favorite.iconValue)
        }
    }

    private var customIconView: some View {
        // Force unwrap - we know it's not nil from earlier test
        Image(loadCustomIconCG()!, scale: 1.0, label: Text("icon"))
            .frame(width: 40, height: 40)
            .border(Color.red) // Debug border to see if frame exists
    }

    private func loadCustomIconCG() -> CGImage? {
        guard let svgPath = favorite.customSVGPath else { return nil }
        let url = ConfigManager.shared.customIconURL(relativePath: svgPath)
        return SymbolValidator.renderPreviewCG(from: url, size: 40)
    }
}

#Preview {
    VStack(spacing: 0) {
        FavoriteRow(
            favorite: Favorite(name: "GitHub", folderPath: "~/github", iconValue: "folder.fill.badge.gearshape"),
            isRunning: true,
            onEdit: {},
            onDelete: {},
            onToggle: {},
            onReveal: {}
        )
        Divider()
        FavoriteRow(
            favorite: Favorite(name: "Projects", folderPath: "~/Projects", iconValue: "star.fill", enabled: false),
            isRunning: false,
            onEdit: {},
            onDelete: {},
            onToggle: {},
            onReveal: {}
        )
    }
    .frame(width: 400)
}

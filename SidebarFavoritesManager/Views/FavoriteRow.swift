import SwiftUI

struct FavoriteRow: View {
    let favorite: Favorite
    let isRunning: Bool
    let isExtensionEnabled: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onToggle: () -> Void
    let onReveal: () -> Void
    let onOpenExtensions: () -> Void

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
                if !isExtensionEnabled && favorite.enabled {
                    // Show clickable warning when extension is not enabled
                    Button(action: onOpenExtensions) {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text("Enable Extension")
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                    }
                    .buttonStyle(.borderless)
                    .help("Click to open System Settings and enable the extension")
                } else {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(statusColor)
                            .frame(width: 8, height: 8)
                        Text(statusText)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
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
        if !isExtensionEnabled {
            return .red
        }
        return isRunning ? .green : .orange
    }

    private var statusText: String {
        if !favorite.enabled {
            return "Disabled"
        }
        if !isExtensionEnabled {
            return "Extension Off"
        }
        return isRunning ? "Active" : "Starting..."
    }

    @ViewBuilder
    private var iconImage: some View {
        if favorite.iconType == .custom, let svgPath = favorite.customSVGPath {
            let url = ConfigManager.shared.customIconURL(relativePath: svgPath)
            SVGThumbnailView(url: url, size: 36)
        } else {
            Image(systemName: favorite.iconValue)
        }
    }
}

#Preview {
    VStack(spacing: 0) {
        FavoriteRow(
            favorite: Favorite(name: "GitHub", folderPath: "~/github", iconValue: "folder.fill.badge.gearshape"),
            isRunning: true,
            isExtensionEnabled: true,
            onEdit: {},
            onDelete: {},
            onToggle: {},
            onReveal: {},
            onOpenExtensions: {}
        )
        Divider()
        FavoriteRow(
            favorite: Favorite(name: "Projects", folderPath: "~/Projects", iconValue: "star.fill", enabled: false),
            isRunning: false,
            isExtensionEnabled: false,
            onEdit: {},
            onDelete: {},
            onToggle: {},
            onReveal: {},
            onOpenExtensions: {}
        )
    }
    .frame(width: 400)
}

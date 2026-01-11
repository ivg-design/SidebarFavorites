import SwiftUI
import UniformTypeIdentifiers

struct AddEditFavoriteSheet: View {
    let existingFavorite: Favorite?
    let onSave: (Favorite) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var folderPath: String = ""
    @State private var iconType: Favorite.IconType = .sfSymbol
    @State private var iconValue: String = "folder.fill"
    @State private var customSVGPath: String?

    @State private var showingSVGPicker = false
    @State private var validationErrors: [SymbolValidator.ValidationError] = []
    @State private var showingValidationError = false

    private var isEditing: Bool { existingFavorite != nil }

    init(favorite: Favorite?, onSave: @escaping (Favorite) -> Void) {
        self.existingFavorite = favorite
        self.onSave = onSave
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text(isEditing ? "Edit Favorite" : "Add Favorite")
                    .font(.headline)
                Spacer()
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.borderless)
            }
            .padding()

            Divider()

            // Form
            Form {
                Section {
                    TextField("Name", text: $name)
                        .textFieldStyle(.roundedBorder)

                    HStack {
                        TextField("Folder Path", text: $folderPath)
                            .textFieldStyle(.roundedBorder)
                        Button("Browse...") {
                            openFolderPicker()
                        }
                    }
                }

                Section("Icon") {
                    Picker("Type", selection: $iconType) {
                        Text("SF Symbol").tag(Favorite.IconType.sfSymbol)
                        Text("Custom SVG").tag(Favorite.IconType.custom)
                    }
                    .pickerStyle(.segmented)

                    if iconType == .sfSymbol {
                        sfSymbolPicker
                    } else {
                        customSVGPicker
                    }
                }

                Section("Preview") {
                    previewSection
                }
            }
            .formStyle(.grouped)
            .scrollContentBackground(.hidden)

            Divider()

            // Actions
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)

                Spacer()

                Button(isEditing ? "Save" : "Add") {
                    save()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!isValid)
            }
            .padding()
        }
        .frame(width: 450, height: 500)
        .onAppear {
            if let favorite = existingFavorite {
                name = favorite.name
                folderPath = favorite.folderPath
                iconType = favorite.iconType
                iconValue = favorite.iconValue
                customSVGPath = favorite.customSVGPath
            }
        }
        .fileImporter(
            isPresented: $showingSVGPicker,
            allowedContentTypes: [UTType(filenameExtension: "svg")!],
            allowsMultipleSelection: false
        ) { result in
            if case .success(let urls) = result, let url = urls.first {
                importCustomSVG(from: url)
            }
        }
        .alert("Invalid SVG", isPresented: $showingValidationError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(validationErrors.compactMap { $0.errorDescription }.joined(separator: "\n"))
        }
    }

    private var sfSymbolPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Symbol Name", text: $iconValue)
                .textFieldStyle(.roundedBorder)

            Text("Enter an SF Symbol name (e.g., folder.fill, star.circle)")
                .font(.caption)
                .foregroundColor(.secondary)

            // Quick picks
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 8), spacing: 8) {
                ForEach(commonSymbols, id: \.self) { symbol in
                    Button(action: { iconValue = symbol }) {
                        Image(systemName: symbol)
                            .font(.system(size: 18))
                            .frame(width: 32, height: 32)
                            .background(iconValue == symbol ? Color.accentColor.opacity(0.2) : Color.clear)
                            .cornerRadius(6)
                    }
                    .buttonStyle(.borderless)
                    .help(symbol)
                }
            }
        }
    }

    private var customSVGPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let path = customSVGPath {
                HStack {
                    Image(systemName: "doc.text")
                    Text(path)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    Button("Change") {
                        showingSVGPicker = true
                    }
                }
                .padding(8)
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(6)
            } else {
                Button(action: { showingSVGPicker = true }) {
                    Label("Import Custom SVG...", systemImage: "square.and.arrow.down")
                }
            }

            Text("Import an SF Symbol template SVG with proper structure")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private var previewSection: some View {
        HStack {
            Spacer()
            HStack(spacing: 8) {
                previewIcon
                    .font(.system(size: 16))
                    .foregroundColor(.accentColor)
                Text(name.isEmpty ? "Folder Name" : name)
                    .foregroundColor(name.isEmpty ? .secondary : .primary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(6)
            Spacer()
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var previewIcon: some View {
        if iconType == .custom, let svgPath = customSVGPath {
            let url = ConfigManager.shared.customIconURL(relativePath: svgPath)
            if let nsImage = SymbolValidator.renderPreview(from: url) {
                Image(nsImage: nsImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 16, height: 16)
            } else {
                Image(systemName: "square.on.square")
            }
        } else {
            Image(systemName: iconValue)
        }
    }

    private var commonSymbols: [String] {
        [
            "folder.fill",
            "folder.fill.badge.gearshape",
            "star.fill",
            "heart.fill",
            "bookmark.fill",
            "flag.fill",
            "tag.fill",
            "archivebox.fill",
            "tray.full.fill",
            "briefcase.fill",
            "doc.fill",
            "doc.text.fill",
            "book.fill",
            "books.vertical.fill",
            "magazine.fill",
            "newspaper.fill",
            "photo.fill",
            "camera.fill",
            "video.fill",
            "music.note",
            "waveform",
            "gamecontroller.fill",
            "terminal.fill",
            "hammer.fill"
        ]
    }

    private var isValid: Bool {
        !name.isEmpty && !folderPath.isEmpty && !iconValue.isEmpty
    }

    private func openFolderPicker() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.resolvesAliases = false  // Preserve symlink paths, don't resolve to target
        panel.message = "Select a folder to add to Finder sidebar"
        panel.prompt = "Select"

        if panel.runModal() == .OK, let url = panel.url {
            folderPath = url.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")
            if name.isEmpty {
                name = url.lastPathComponent
            }
        }
    }

    private func importCustomSVG(from url: URL) {
        let result = SymbolValidator.validate(at: url)
        if result.isValid {
            do {
                let symbolName = url.deletingPathExtension().lastPathComponent
                let relativePath = try SymbolValidator.importSymbol(from: url, named: symbolName)
                customSVGPath = relativePath
                iconValue = symbolName
            } catch {
                validationErrors = []
                showingValidationError = true
            }
        } else {
            validationErrors = result.errors
            showingValidationError = true
        }
    }

    private func save() {
        var favorite: Favorite
        if let existing = existingFavorite {
            favorite = existing
            favorite.name = name
            favorite.folderPath = folderPath
            favorite.iconType = iconType
            favorite.iconValue = iconValue
            favorite.customSVGPath = customSVGPath
            favorite.markUpdated()
        } else {
            favorite = Favorite(
                name: name,
                folderPath: folderPath,
                iconType: iconType,
                iconValue: iconValue,
                customSVGPath: customSVGPath
            )
        }
        onSave(favorite)
        dismiss()
    }
}

#Preview {
    AddEditFavoriteSheet(favorite: nil) { _ in }
}

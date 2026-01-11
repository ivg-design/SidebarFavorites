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
    @State private var showingSVGSavePanel = false
    @State private var showingTemplateGuidelines = false
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
        .alert("Template Saved", isPresented: $showingTemplateGuidelines) {
            Button("Open in SF Symbols App") {
                NSWorkspace.shared.open(URL(string: "sfsymbols://")!)
            }
            Button("OK", role: .cancel) {}
        } message: {
            Text("""
            Your blank template has been saved.

            To create a custom icon:
            1. Open the template in a vector editor (Illustrator, Figma, etc.)
            2. Replace the placeholder rectangle with your icon design
            3. Keep your icon within the "Regular-S" bounds
            4. The icon should use a single color (template tinting)
            5. Save as SVG and import it here

            Tip: Use SF Symbols app to export existing symbols as templates for reference.
            """)
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
                HStack(spacing: 12) {
                    Button(action: { showingSVGPicker = true }) {
                        Label("Import Custom SVG...", systemImage: "square.and.arrow.down")
                    }

                    Button(action: { saveBlankTemplate() }) {
                        Label("Save Blank Template...", systemImage: "doc.badge.plus")
                    }
                }
            }

            Text("Import an existing SVG or save a blank template to create your own")
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

    private func saveBlankTemplate() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [UTType(filenameExtension: "svg")!]
        panel.nameFieldStringValue = "custom-icon-template.svg"
        panel.message = "Choose where to save the blank SF Symbol template"
        panel.prompt = "Save Template"

        if panel.runModal() == .OK, let url = panel.url {
            do {
                try blankTemplateSVG.write(to: url, atomically: true, encoding: .utf8)
                showingTemplateGuidelines = true
            } catch {
                validationErrors = []
                showingValidationError = true
            }
        }
    }

    private var blankTemplateSVG: String {
        """
        <?xml version="1.0" encoding="UTF-8"?>
        <!--Generator: SF Symbol template for SidebarFavorites-->
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="3300" height="2200">
          <defs>
            <style>
              .guide { fill: none; stroke: #27AAE1; stroke-width: 1; opacity: 0.5; }
              .symbol { fill: #000000; }
            </style>
          </defs>

          <g id="Notes">
            <text id="descriptive-name" x="100" y="100" font-size="40" fill="#999">custom.icon.name</text>
            <text x="100" y="150" font-size="24" fill="#999">Replace the rectangle below with your icon design</text>
            <text x="100" y="180" font-size="24" fill="#999">Keep design within the guide lines</text>
          </g>

          <g id="Guides">
            <line id="Baseline-S" class="guide" x1="258" y1="1796" x2="858" y2="1796"/>
            <line id="Capline-S" class="guide" x1="258" y1="1484" x2="858" y2="1484"/>
            <line id="left-margin-S" class="guide" x1="258" y1="1484" x2="258" y2="1796"/>
            <line id="right-margin-S" class="guide" x1="858" y1="1484" x2="858" y2="1796"/>
          </g>

          <g id="Symbols">
            <!--
              Replace this placeholder rectangle with your icon paths.
              Your icon should fill the area between the guides.
              Use solid fills only - the color will be tinted by the system.
            -->
            <g id="Regular-S">
              <rect class="symbol" x="358" y="1534" width="400" height="212" rx="20" ry="20"/>
            </g>
          </g>
        </svg>
        """
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

import SwiftUI
import UniformTypeIdentifiers

struct AddEditFavoriteSheet: View {
    let existingFavorite: Favorite?
    let onSave: (Favorite) -> Void

    /// Persist, rebuild and restart Finder without dismissing - see `apply()`.
    /// Returns a message when something went wrong, because the window's own error
    /// alert sits behind this sheet and would never be seen. Optional so a caller
    /// that has nothing to apply against (the SwiftUI preview) can omit it.
    let onApply: ((Favorite) async -> String?)?

    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var folderPath: String = ""
    @State private var locationsOnly: Bool = false

    /// How the sidebar glyph is delivered - see `Favorite.Mode`. Advanced adds
    /// a per-favorite Finder Sync helper so the folder may keep its own icon.
    @State private var mode: Favorite.Mode = .regular

    /// Locations only makes sense for a mounted volume, so the toggle is offered
    /// only when the chosen path is one.
    private var targetIsVolume: Bool {
        let expanded = (folderPath as NSString).expandingTildeInPath
        guard !expanded.isEmpty else { return false }
        return (try? URL(fileURLWithPath: expanded).resourceValues(forKeys: [.isVolumeKey]).isVolume) == true
    }

    /// The custom icon this target carries itself, when it has one. Present means
    /// the sidebar icon will keep vanishing until it is dealt with.
    @State private var iconAuthority: IconAuthority.Detection?

    /// Where its icon was backed up to, once removed - shown so the user knows a
    /// copy exists and where.
    @State private var iconAuthorityBackup: URL?
    @State private var iconAuthorityError: String?
    @State private var iconType: Favorite.IconType = .sfSymbol
    @State private var iconValue: String = "folder.fill"
    @State private var customSVGPath: String?

    /// Optical size correction for a custom icon, as a fraction. Drives the
    /// preview directly and nothing else until the user commits: see `apply()`
    /// for why this deliberately does not persist as it moves.
    @State private var iconScale: Double = Favorite.defaultIconScale

    /// Identity of the favorite this sheet edits, decided once.
    ///
    /// Needed as its own piece of state because Apply can persist a *new* favorite
    /// while the sheet is still open: every later Apply, and the final Save, have
    /// to land on that same favorite rather than inserting another one.
    @State private var favoriteID = UUID()

    /// The form as it was last written to disk, or nil for a favorite that has
    /// never been written. What Apply compares against to know whether there is
    /// anything to do.
    @State private var appliedSnapshot: FormSnapshot?

    /// True while an Apply is in flight. Latched around the whole await so a
    /// second click cannot queue a second `actool` run behind the first.
    @State private var isApplying = false

    @State private var showingSVGPicker = false
    @State private var validationErrors: [SymbolValidator.ValidationError] = []
    @State private var showingValidationError = false
    @State private var operationError: String?

    /// What the imported SVG produced: the previews built from its artwork, and
    /// anything the user should know about what was dropped or flattened.
    /// Rebuilt whenever the icon selection changes.
    @State private var artworkWarnings: [String] = []
    @State private var sidebarPreview: NSImage?
    @State private var enlargedPreview: NSImage?

    /// The parsed artwork behind the previews, held so the size slider can
    /// re-render without going back to the file. Reading and parsing an SVG on
    /// every tick of a continuous slider is exactly the kind of work this control
    /// must not do.
    @State private var artwork: SymbolValidator.Artwork?

    /// The size Finder actually draws a sidebar icon at.
    private let sidebarIconSize: CGFloat = 16
    private let enlargedIconSize: CGFloat = 48

    private var isEditing: Bool { existingFavorite != nil }

    /// Whether the favorite exists in the config - which it does from the first
    /// successful Apply onwards, even in the Add sheet. Only decides wording.
    private var isPersisted: Bool { isEditing || appliedSnapshot != nil }

    init(favorite: Favorite?,
         onApply: ((Favorite) async -> String?)? = nil,
         onSave: @escaping (Favorite) -> Void) {
        self.existingFavorite = favorite
        self.onApply = onApply
        self.onSave = onSave
    }

    /// Everything on this form that ends up in the favorite.
    ///
    /// Compared against the last state actually written so Apply can tell "there
    /// is a change waiting" from "nothing to do" - and, because it is taken from
    /// the favorite that was written rather than from the live form, so a slider
    /// nudged during a rebuild is not mistaken for having been applied.
    private struct FormSnapshot: Equatable {
        let name: String
        let folderPath: String
        let iconType: Favorite.IconType
        let iconValue: String
        let customSVGPath: String?
        let iconScale: Double
        // Both were once missing here, which left Apply disabled for a change
        // that only touched them - every field `buildFavorite` writes belongs
        // in this comparison.
        let locationsOnly: Bool
        let mode: Favorite.Mode

        init(_ favorite: Favorite) {
            self.init(
                name: favorite.name,
                folderPath: favorite.folderPath,
                iconType: favorite.iconType,
                iconValue: favorite.iconValue,
                customSVGPath: favorite.customSVGPath,
                iconScale: favorite.iconScale,
                locationsOnly: favorite.locationsOnly,
                mode: favorite.mode
            )
        }

        init(name: String,
             folderPath: String,
             iconType: Favorite.IconType,
             iconValue: String,
             customSVGPath: String?,
             iconScale: Double,
             locationsOnly: Bool,
             mode: Favorite.Mode) {
            self.name = name
            self.folderPath = folderPath
            self.iconType = iconType
            self.iconValue = iconValue
            self.customSVGPath = customSVGPath
            self.iconScale = iconScale
            self.locationsOnly = locationsOnly
            self.mode = mode
        }
    }

    private var snapshot: FormSnapshot {
        FormSnapshot(
            name: name,
            folderPath: folderPath,
            iconType: iconType,
            iconValue: iconValue,
            customSVGPath: customSVGPath,
            // Through the model's clamp, so this compares equal to the snapshot
            // taken from a saved favorite rather than differing by a rounding.
            iconScale: Favorite.clampedIconScale(iconScale),
            locationsOnly: locationsOnly,
            mode: mode
        )
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
                    LabeledContent("Name") {
                        Text(name.isEmpty ? "Choose a folder" : name)
                            .foregroundColor(name.isEmpty ? .secondary : .primary)
                    }

                    HStack {
                        TextField("Folder Path", text: $folderPath)
                            .textFieldStyle(.roundedBorder)
                        Button("Browse...") {
                            openFolderPicker()
                        }
                    }

                    Text("This folder will be added to Finder's sidebar automatically. The row is named after the folder - Finder always shows a favorite under its folder's real name.")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if targetIsVolume {
                        Toggle("Show in Locations only", isOn: $locationsOnly)
                        Text("Finder already lists mounted disks and servers under Locations. This icons that row instead of adding a second one under Favorites.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if let detection = iconAuthority {
                        ownIconWarning(detection)
                    }
                }
                .onChange(of: folderPath) { newPath in
                    name = Favorite.canonicalName(forFolderPath: newPath)
                    refreshIconAuthority(for: newPath)
                }

                Section("Sidebar Icon Mode") {
                    Picker("Mode", selection: $mode) {
                        Text("Sidebar icon only").tag(Favorite.Mode.regular)
                        Text("Both icons").tag(Favorite.Mode.advanced)
                    }
                    .pickerStyle(.segmented)

                    if mode == .advanced {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("The folder keeps its own icon everywhere — Desktop, windows, Dock — while the sidebar shows your glyph.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                            Label("Adds helper “SBF-\(name.isEmpty ? "…" : name)” to System Settings (~6 MB)", systemImage: "puzzlepiece.extension")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    } else {
                        // Says what the mode IS. The consequence of choosing it
                        // for a target that carries its own icon is stated once,
                        // at the choice above - not repeated here.
                        Text("Sets the sidebar glyph. Nothing runs in the background.")
                            .font(.caption)
                            .foregroundColor(.secondary)
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
                        customSVGSection
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
                // Deliberately not disabled while an Apply runs: the work is the
                // coordinator's and completes either way, and taking away the
                // escape hatch mid-operation is exactly when it is wanted most.
                Button("Cancel") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)

                Spacer()

                if onApply != nil {
                    applyButton
                }

                Button(isPersisted ? "Save" : "Add") {
                    save()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!isValid || isApplying)
            }
            .padding()
        }
        // Tall enough that the live preview is visible without scrolling in both
        // icon modes; the form still scrolls when an import raises several warnings.
        .frame(width: 470, height: 700)
        .onAppear {
            if let favorite = existingFavorite {
                favoriteID = favorite.id
                // Derived, not read back: a config written by a build that let
                // the name be edited may still carry a custom one.
                name = Favorite.canonicalName(forFolderPath: favorite.folderPath)
                folderPath = favorite.folderPath
                // Editing an existing favorite: the target may have acquired its
                // own icon since it was added, which is worth saying here too.
                locationsOnly = favorite.locationsOnly
                mode = favorite.mode
                refreshIconAuthority(for: favorite.folderPath)
                iconType = favorite.iconType
                iconValue = favorite.iconValue
                customSVGPath = favorite.customSVGPath
                iconScale = favorite.iconScale
                // Opened on something already on disk, so there is nothing to
                // apply until the user changes something.
                appliedSnapshot = FormSnapshot(favorite)
            }
            refreshArtwork()
        }
        .onChange(of: customSVGPath) { _ in refreshArtwork() }
        .onChange(of: iconType) { _ in refreshArtwork() }
        // Redraw only. Nothing on this path reads the file, builds a template or
        // goes anywhere near `actool` - see `renderPreviews`.
        .onChange(of: iconScale) { _ in renderPreviews() }
        .fileImporter(
            isPresented: $showingSVGPicker,
            allowedContentTypes: [UTType(filenameExtension: "svg") ?? .svg],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    importCustomSVG(from: url)
                }
            case .failure(let error):
                operationError = error.localizedDescription
            }
        }
        .alert("Can't Use This SVG", isPresented: $showingValidationError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(validationErrorMessage)
        }
        .alert("Couldn't Complete", isPresented: Binding(
            get: { operationError != nil },
            set: { if !$0 { operationError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(operationError ?? "")
        }
    }

    // MARK: - Apply

    /// Commit without closing, then relaunch Finder so the sidebar redraws.
    ///
    /// Tuning optical size is iterative and cannot be finished from the preview
    /// alone - the judgement is "does this sit right next to the other rows", and
    /// only Finder can answer that. Without this the loop is save, close, notice
    /// the banner, restart, reopen; with it, it is one button.
    private var applyButton: some View {
        Button(action: { Task { await apply() } }) {
            if isApplying {
                HStack(spacing: 6) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Applying…")
                }
            } else {
                Text("Apply")
            }
        }
        .disabled(!canApply)
        .help("Saves this favorite and restarts Finder so the sidebar redraws, leaving this window open")
    }

    /// There has to be something to write, it has to be valid, and the last one
    /// has to have finished.
    private var canApply: Bool {
        isValid && appliedSnapshot != snapshot && !isApplying
    }

    private func apply() async {
        guard canApply, let onApply else { return }

        isApplying = true
        // Built once, before the await: this exact value is what gets written and
        // what is recorded as applied, so moving the slider during the rebuild
        // cannot leave the form looking clean when it is not.
        let favorite = buildFavorite()
        let failure = await onApply(favorite)
        isApplying = false

        if let failure {
            operationError = failure
            return
        }
        appliedSnapshot = FormSnapshot(favorite)
    }

    // MARK: - SF Symbol picker

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

    // MARK: - Custom SVG import

    private var customSVGSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let path = customSVGPath {
                HStack(spacing: 8) {
                    Image(systemName: "doc")
                        .foregroundColor(.secondary)
                    Text((path as NSString).lastPathComponent)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    Button("Replace...") {
                        showingSVGPicker = true
                    }
                }
                .padding(8)
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(6)
            } else {
                Button(action: { showingSVGPicker = true }) {
                    Label("Import SVG...", systemImage: "square.and.arrow.down")
                }
            }

            Text("Any SVG works - a logo, an icon you drew, anything made of vector shapes. Nothing to prepare: the app builds the SF Symbol around your artwork.")
                .font(.caption)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if customSVGPath != nil {
                Divider()
                iconScaleControl
            }
        }
    }

    /// Manual optical-size correction.
    ///
    /// Offered for imported artwork only. A system SF Symbol is drawn by macOS
    /// from Apple's own outlines, each one hand-tuned to sit right beside the
    /// others - there is nothing of ours to rescale, and a control that silently
    /// did nothing would be worse than no control.
    private var iconScaleControl: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text("Size")
                Spacer(minLength: 0)
                Text(iconScalePercentText)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.secondary)
                    // Fixed width, so the slider does not shift sideways as the
                    // number goes from two digits to three while being dragged.
                    .frame(width: 40, alignment: .trailing)
                Button("Reset") {
                    iconScale = Favorite.defaultIconScale
                }
                .buttonStyle(.borderless)
                .disabled(isAtDefaultIconScale)
                .help("Back to 100%")
            }

            Slider(value: $iconScale, in: Favorite.iconScaleRange, step: 0.01) {
                Text("Icon size")
            } minimumValueLabel: {
                Text("50%")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            } maximumValueLabel: {
                Text("150%")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .labelsHidden()

            Text("100% puts your artwork at exactly the size of a system SF Symbol. That is the right measurement and not always the right look - a wide or busy mark reads heavier than a narrow one at the same size - so nudge it down until it sits comfortably beside the rest of the sidebar. The preview follows as you drag.")
                .font(.caption)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var iconScalePercentText: String {
        "\(Int((Favorite.clampedIconScale(iconScale) * 100).rounded()))%"
    }

    private var isAtDefaultIconScale: Bool {
        abs(Favorite.clampedIconScale(iconScale) - Favorite.defaultIconScale) < 0.0005
    }

    private func warningRow(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.orange)
            Text(text)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .font(.caption)
    }

    // MARK: - Preview

    private var previewSection: some View {
        // Stacked rather than side by side: a wide mark is drawn at its true
        // proportions here - overhanging, the way Finder draws one - and a column
        // narrow enough to sit beside the mock row would have had to shrink it
        // back down, which is the one thing that makes a size preview useless.
        VStack(alignment: .leading, spacing: 12) {
            // Enlarged silhouette, so the user can see what survived.
            VStack(alignment: .leading, spacing: 4) {
                previewIcon(customImage: enlargedPreview)
                    .frame(
                        width: previewWidth(for: enlargedPreview, height: enlargedIconSize),
                        height: enlargedIconSize
                    )
                    .foregroundColor(.primary)
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color(NSColor.textBackgroundColor))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(Color.secondary.opacity(0.25))
                    )

                Text("Enlarged")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            // The size it will really be drawn at, in a mock sidebar row.
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    previewIcon(customImage: sidebarPreview)
                        .frame(
                            width: previewWidth(for: sidebarPreview, height: sidebarIconSize),
                            height: sidebarIconSize
                        )
                        .foregroundColor(.accentColor)
                    Text(name.isEmpty ? "Folder Name" : name)
                        .font(.system(size: 13))
                        .foregroundColor(name.isEmpty ? .secondary : .primary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color(NSColor.controlBackgroundColor))
                )

                Text("Sidebar size - 16 pt tall, monochrome, tinted by macOS. A wide icon overhangs the column here because it does in Finder too.")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if iconType == .custom {
                Text("macOS draws sidebar icons as a flat monochrome silhouette, tinted to match the sidebar. Colour isn't possible there - that's a macOS rule, not ours.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                // What the artwork lost on the way in. Deliberately *below* the
                // preview: the user should see the silhouette first, then read
                // why it looks the way it does.
                ForEach(artworkWarnings, id: \.self) { warning in
                    warningRow(warning)
                }
            }
        }
        .padding(.vertical, 4)
    }

    /// The width to give a preview slot `height` points tall.
    ///
    /// Taken from the rendered image, which already carries the compiled symbol's
    /// proportions and is already capped at the slot's allowance - so the slot
    /// hugs the artwork instead of letter-boxing it, and a square icon still gets
    /// a square box.
    private func previewWidth(for image: NSImage?, height: CGFloat) -> CGFloat {
        guard let image, image.size.height > 0, image.size.width > 0 else { return height }
        return height * (image.size.width / image.size.height)
    }

    /// - Parameter customImage: the synthesized template preview rendered at the
    ///   size this slot draws at. Ignored for SF Symbol icons.
    @ViewBuilder
    private func previewIcon(customImage: NSImage?) -> some View {
        if iconType == .custom {
            if let image = customImage {
                Image(nsImage: image)
                    .resizable()
                    .renderingMode(.template)
                    .aspectRatio(contentMode: .fit)
            } else {
                Image(systemName: "square.dashed")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .foregroundColor(.secondary)
            }
        } else if isKnownSystemSymbol(iconValue) {
            Image(systemName: iconValue)
                .resizable()
                .aspectRatio(contentMode: .fit)
        } else {
            Image(systemName: "questionmark.square.dashed")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .foregroundColor(.secondary)
        }
    }

    private func isKnownSystemSymbol(_ name: String) -> Bool {
        !name.isEmpty && NSImage(systemSymbolName: name, accessibilityDescription: nil) != nil
    }

    // MARK: - Artwork loading

    /// Re-parse the selected SVG and rebuild both previews.
    ///
    /// Runs on the main thread: parsing an icon-sized SVG and rasterizing a 16 pt
    /// silhouette is sub-millisecond work, and doing it inline keeps the preview
    /// in step with the picker rather than flickering a frame behind it.
    private func refreshArtwork() {
        guard iconType == .custom, let relativePath = customSVGPath else {
            artwork = nil
            artworkWarnings = []
            renderPreviews()
            return
        }

        let url = ConfigManager.shared.customIconURL(relativePath: relativePath)
        let result = SymbolValidator.validate(at: url)

        // A stored icon can go bad between sessions (edited, truncated, replaced),
        // so a failure here is shown in place of the warnings rather than as an alert.
        artworkWarnings = result.isValid ? result.warnings : result.errors.map(describe)
        artwork = result.artwork
        renderPreviews()
    }

    /// Re-rasterize both previews from the artwork already in hand.
    ///
    /// Split out of `refreshArtwork` because this is what runs on every tick of
    /// the size slider, and what it must NOT do is as important as what it does:
    /// no file read, no XML parse, no template synthesis and above all no
    /// `actool`. Filling one cached `CGPath` into two small bitmaps is
    /// microseconds; compiling an asset catalog is not, and doing that per tick
    /// would run the compiler continuously for the length of a drag.
    private func renderPreviews() {
        guard iconType == .custom, let artwork else {
            sidebarPreview = nil
            enlargedPreview = nil
            return
        }
        sidebarPreview = templatePreview(artwork, size: sidebarIconSize)
        enlargedPreview = templatePreview(artwork, size: enlargedIconSize)
    }

    /// The **only** place in this file that names `SymbolTemplateSynthesizer`. If
    /// that type ships with a different call shape, this one function is what changes.
    private func templatePreview(_ artwork: SymbolValidator.Artwork, size: CGFloat) -> NSImage {
        let image = SymbolTemplateSynthesizer.previewImage(
            for: artwork.path,
            fillRule: artwork.fillRule,
            size: size,
            // The same number `buildFavorite` stores and the helper compiles with,
            // so what the user judges here is what Finder ends up drawing.
            iconScale: CGFloat(Favorite.clampedIconScale(iconScale)),
            // This sheet is where size is judged, so its previews get the room to
            // overhang that Finder gives a wide symbol. In a square slot a mark
            // wider than about 1.16:1 is width-bound and looks identical at every
            // setting of the slider - which would make the control appear broken
            // for precisely the artwork it exists to fix.
            slot: .overhanging
        )
        // Sidebar icons are templates; make sure the preview tints like one.
        image.isTemplate = true
        return image
    }

    // MARK: - Data

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

    /// "What went wrong" plus "what to do about it", as one sentence pair.
    private func describe(_ error: SymbolValidator.ValidationError) -> String {
        [error.errorDescription, error.recoverySuggestion]
            .compactMap { $0 }
            .joined(separator: " ")
    }

    private var validationErrorMessage: String {
        let lines = validationErrors.map(describe)
        return lines.isEmpty ? "This SVG can't be used as an icon." : lines.joined(separator: "\n\n")
    }

    private var isValid: Bool {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty,
              !folderPath.trimmingCharacters(in: .whitespaces).isEmpty else {
            return false
        }
        switch iconType {
        case .sfSymbol:
            return !iconValue.isEmpty
        case .custom:
            return customSVGPath != nil
        }
    }

    // MARK: - Actions

    /// Warns that the target carries its own icon, and offers to remove it.
    ///
    /// Deliberately inline and non-blocking rather than an alert on save: it is a
    /// real choice, not an error, and the favorite works either way - the icon
    /// just needs re-applying whenever the target changes.
    @ViewBuilder
    private func ownIconWarning(_ detection: IconAuthority.Detection) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if mode == .advanced {
                // The detection stops being a problem the moment the helper owns
                // the row - say so instead of warning about it.
                Label("This \(detection.isVolume ? "disk" : "folder") has its own icon — kept. The helper draws the sidebar glyph.", systemImage: "checkmark.seal.fill")
                    .foregroundColor(.green)
                    .font(.callout)
            } else {
                Label(detection.summary, systemImage: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)
                    .font(.callout)

                Text(detection.explanation)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                if let backup = iconAuthorityBackup {
                    Text("Removed. A copy is in \(backup.deletingLastPathComponent().path).")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else if let error = iconAuthorityError {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                } else {
                    // One row per choice, each with the consequence written next
                    // to it: three buttons in a line with a shared paragraph
                    // above them made the paragraph read as advice for whichever
                    // button the eye landed on first.
                    VStack(alignment: .leading, spacing: 8) {
                        choiceRow(
                            title: "Keep Both Icons",
                            detail: "Keeps this \(detection.isVolume ? "disk" : "folder")'s icon and the sidebar glyph. Adds a helper (~6 MB) listed in System Settings.",
                            prominent: true
                        ) { mode = .advanced }

                        choiceRow(
                            title: "Remove Its Icon",
                            detail: "The sidebar glyph stays put. This \(detection.isVolume ? "disk" : "folder") goes back to a plain icon everywhere; a copy is kept so you can put it back.",
                            prominent: false
                        ) { removeOwnIcon(detection) }

                        choiceRow(
                            title: "Leave As Is",
                            detail: "Change nothing. The sidebar glyph will keep disappearing until you press Refresh.",
                            prominent: false
                        ) { iconAuthority = nil }
                    }
                    .padding(.top, 4)
                }
            }
        }
        .padding(.vertical, 4)
    }

    /// One choice in the custom-icon block: what it is called, and what happens.
    @ViewBuilder
    private func choiceRow(title: String,
                           detail: String,
                           prominent: Bool,
                           action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if prominent {
                Button(title, action: action).buttonStyle(.borderedProminent)
            } else {
                Button(title, action: action).buttonStyle(.bordered)
            }
            Text(detail)
                .font(.caption)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func refreshIconAuthority(for path: String) {
        iconAuthorityBackup = nil
        iconAuthorityError = nil
        let expanded = (path as NSString).expandingTildeInPath
        iconAuthority = expanded.isEmpty ? nil : IconAuthority.detect(atPath: expanded)
    }

    private func removeOwnIcon(_ detection: IconAuthority.Detection) {
        do {
            let backup = try IconAuthority.remove(
                detection,
                backupDirectory: ConfigManager.shared.appSupportURL.appendingPathComponent("IconBackups")
            )
            iconAuthorityBackup = backup
            iconAuthorityError = nil
        } catch {
            iconAuthorityError = "Couldn't remove it: \(error.localizedDescription)"
        }
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
            // The name follows via the form's onChange(of: folderPath).
            folderPath = url.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")
        }
    }

    private func importCustomSVG(from url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        let result = SymbolValidator.validate(at: url)
        guard result.isValid else {
            validationErrors = result.errors
            showingValidationError = true
            return
        }

        do {
            let relativePath = try SymbolValidator.importSymbol(
                from: url,
                named: url.deletingPathExtension().lastPathComponent
            )
            // The stored file decides the symbol name - it may have been
            // de-duplicated against an icon another favorite already uses.
            customSVGPath = relativePath
            iconValue = (relativePath as NSString).deletingPathExtension
            refreshArtwork()
        } catch {
            operationError = error.localizedDescription
        }
    }

    /// The favorite this form describes, laid over whatever is currently stored
    /// for it.
    ///
    /// Reading the stored copy back rather than editing `existingFavorite` is what
    /// makes Apply safe to press twice. The reconcile Apply triggers writes
    /// `osType`, the sidebar binding and `updatedAt` while this sheet is still
    /// open; a second Apply built from the favorite as it looked when the sheet
    /// opened would hand all of that back as it was, unbinding a row that is now
    /// live. The form owns exactly the fields it shows - everything else comes
    /// from the config, whatever the reconcile has made of it since.
    private func buildFavorite() -> Favorite {
        var favorite = ConfigManager.shared.getFavorite(id: favoriteID)
            ?? existingFavorite
            ?? Favorite(id: favoriteID, name: name, folderPath: folderPath)
        favorite.name = name
        favorite.folderPath = folderPath
        favorite.iconType = iconType
        favorite.iconValue = iconValue
        favorite.customSVGPath = customSVGPath
        favorite.iconScale = iconScale
        // A folder can never live in Locations, so the flag is not allowed to
        // survive re-pointing a favorite at one.
        favorite.locationsOnly = locationsOnly && targetIsVolume
        favorite.mode = mode
        favorite.markUpdated()
        return favorite
    }

    private func save() {
        onSave(buildFavorite())
        dismiss()
    }
}

#Preview {
    AddEditFavoriteSheet(favorite: nil) { _ in }
}

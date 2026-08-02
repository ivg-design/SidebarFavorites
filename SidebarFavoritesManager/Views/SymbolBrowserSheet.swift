import SwiftUI

/// Search-and-pick over every SF Symbol this Mac can draw.
///
/// The 24 quick picks in the editor cover the common cases; this is the way to
/// the other ~8,000. Loading is deferred to `task` because rendering every name
/// once to test availability takes a moment, and it should not stall the sheet
/// that presents this.
struct SymbolBrowserSheet: View {
    /// Pre-filled with whatever the editor currently has, so the browser opens
    /// on the symbol being replaced rather than at the top of the catalog.
    @State private var query: String
    @State private var symbols: [SymbolCatalog.Symbol] = []
    @State private var isLoading = true
    @State private var selection: String?

    private let initialSymbol: String
    private let onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    init(currentSymbol: String, onPick: @escaping (String) -> Void) {
        self.initialSymbol = currentSymbol
        self.onPick = onPick
        _query = State(initialValue: "")
        _selection = State(initialValue: currentSymbol)
    }

    private var results: [SymbolCatalog.Symbol] {
        SymbolCatalog.search(query, in: symbols)
    }

    private let columns = Array(repeating: GridItem(.adaptive(minimum: 46), spacing: 10), count: 1)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("SF Symbols")
                    .font(.headline)
                Spacer()
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                }
                .buttonStyle(.borderless)
            }
            .padding()

            Divider()

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                TextField("Search \(symbols.count) symbols by name or keyword", text: $query)
                    .textFieldStyle(.plain)
                if !query.isEmpty {
                    Button(action: { query = "" }) {
                        Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                    }
                    .buttonStyle(.borderless)
                }
            }
            .padding(10)

            Divider()

            if isLoading {
                VStack(spacing: 10) {
                    ProgressView()
                    Text("Reading the system symbol catalog…")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if results.isEmpty {
                VStack(spacing: 6) {
                    Text("No symbols match “\(query)”")
                        .foregroundColor(.secondary)
                    Text("Try a shorter word, like “folder” or “star”.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(results) { symbol in
                            cell(symbol)
                        }
                    }
                    .padding(12)
                }
            }

            Divider()

            HStack {
                if let selection {
                    Image(systemName: selection)
                    Text(selection)
                        .font(.system(.caption, design: .monospaced))
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                Spacer()
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Use Symbol") {
                    if let selection { onPick(selection) }
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(selection == nil)
            }
            .padding()
        }
        .frame(width: 520, height: 560)
        .task {
            // `SymbolCatalog.all` is lazy and does the render test on first
            // touch; keep that off the main thread so the sheet appears at once.
            let loaded = await Task.detached(priority: .userInitiated) {
                SymbolCatalog.all
            }.value
            symbols = loaded
            isLoading = false
        }
    }

    @ViewBuilder
    private func cell(_ symbol: SymbolCatalog.Symbol) -> some View {
        let isSelected = selection == symbol.name
        Button(action: { selection = symbol.name }) {
            Image(systemName: symbol.name)
                .font(.system(size: 20))
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(isSelected ? Color.accentColor.opacity(0.25) : Color.secondary.opacity(0.08))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(isSelected ? Color.accentColor : .clear, lineWidth: 2)
                )
        }
        .buttonStyle(.plain)
        .help(symbol.name)
        // Double-click picks and closes, like a file browser.
        .simultaneousGesture(TapGesture(count: 2).onEnded {
            onPick(symbol.name)
            dismiss()
        })
    }
}

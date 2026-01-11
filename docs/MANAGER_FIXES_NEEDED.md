# Manager App - Analysis of Issues

## Comparison: Working Prototype vs Manager App IconAppGenerator

### Issue 1: Re-signing the Extension (CRITICAL)

**Working Prototype:**
- Xcode builds and signs the extension
- Custom icon added, only main app re-signed: `codesign --force --sign "Apple Development" "$APP_PATH"`
- Extension signature remains INTACT

**Manager App (IconAppGenerator.swift):**
```swift
// Line 204-213: Removes BOTH signatures
private func removeOldSignatures(at appURL: URL) throws {
    let mainCodeSig = appURL.appendingPathComponent("Contents/_CodeSignature")
    try? fileManager.removeItem(at: mainCodeSig)

    let extCodeSig = appURL.appendingPathComponent("Contents/PlugIns/IconAppSync.appex/Contents/_CodeSignature")
    try? fileManager.removeItem(at: extCodeSig)  // ← PROBLEM!
}

// Line 237-242: Re-signs BOTH
let extensionURL = appURL.appendingPathComponent("Contents/PlugIns/IconAppSync.appex")
try runCodesign(at: extensionURL, entitlements: entitlementsURL)  // ← PROBLEM!
try runCodesign(at: appURL, entitlements: nil)
```

**Fix:** Do NOT touch the extension's signature at all. Only re-sign the main app.

---

### Issue 2: Symbol Name Not Extracted from SVG

**Working Prototype:**
```bash
# Extract from SVG's descriptive-name field
SYMBOL_NAME=$(grep -o 'id="descriptive-name"[^>]*>[^<]*' "$SVG_PATH" | sed 's/.*>\([^<]*\)/\1/')
```
- Symbol name comes FROM the SVG file itself
- Example: SVG contains `sidebar.github.rectangle` in descriptive-name

**Manager App:**
```swift
// Line 45: Uses user-provided iconValue directly
try compileCustomSymbol(svgPath: svgPath, symbolName: favorite.iconValue, appURL: destinationURL)
```
- Symbol name comes from user input
- If user enters filename (e.g., `sidebar-github.rectangle.fixed`) instead of SVG's internal name, it breaks

**Fix:** Parse the SVG file and extract `descriptive-name` automatically.

---

### Issue 3: Incomplete lsregister Call

**Working Prototype (via Xcode):**
```bash
lsregister -f -R -trusted /path/to/app
```

**Manager App:**
```swift
// Line 274-278
process.arguments = ["-f", appURL.path]  // Missing -R and -trusted!
```

**Fix:** Use full flags: `["-f", "-R", "-trusted", appURL.path]`

---

### Issue 4: No Finder Restart

**Working Prototype:**
```bash
killall Finder  # Refreshes icon cache
```

**Manager App:**
- No Finder restart
- Icons remain cached with old/blank appearance

**Fix:** Call `killall Finder` after generating apps, or use NSWorkspace to restart Finder.

---

### Issue 5: Wrong Entitlements for Extension

**Working Prototype (Xcode-built):**
```xml
<key>com.apple.security.app-sandbox</key>
<true/>
<key>com.apple.security.files.user-selected.read-only</key>
<true/>
```

**Manager App:**
```swift
// Line 227-230
<key>com.apple.developer.finder-sync</key>
<true/>
<key>com.apple.security.app-sandbox</key>
<false/>  // ← Different!
```

**Note:** This may or may not be an issue. The original uses sandbox=true, Manager uses false.

---

## Summary of Required Fixes

| Issue | Current Behavior | Required Behavior |
|-------|-----------------|-------------------|
| Extension signature | Removed and re-signed | Leave intact |
| Main app signature | Re-signed | Re-signed (correct) |
| Symbol name | User-provided | Extract from SVG |
| lsregister flags | `-f` only | `-f -R -trusted` |
| Finder restart | None | Kill Finder after generation |
| Template build | May be Debug | Must be Release |

---

## Code Changes Needed

### 1. Remove `removeOldSignatures` extension handling:
```swift
private func removeOldSignatures(at appURL: URL) throws {
    // ONLY remove main app signature, NOT extension
    let mainCodeSig = appURL.appendingPathComponent("Contents/_CodeSignature")
    try? fileManager.removeItem(at: mainCodeSig)
    // DO NOT touch extension signature!
}
```

### 2. Remove extension re-signing from `signApp`:
```swift
private func signApp(at appURL: URL) throws {
    // ONLY sign the main app, NOT the extension
    try runCodesign(at: appURL, entitlements: nil)
}
```

### 3. Add symbol name extraction:
```swift
private func extractSymbolName(from svgPath: String) throws -> String {
    let svgContent = try String(contentsOfFile: svgPath, encoding: .utf8)
    // Look for: id="descriptive-name"...>symbol.name.here</text>
    let pattern = #"id="descriptive-name"[^>]*>([^<]+)<"#
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: svgContent, range: NSRange(svgContent.startIndex..., in: svgContent)),
          let range = Range(match.range(at: 1), in: svgContent) else {
        throw GeneratorError.symbolNameNotFound
    }
    return String(svgContent[range]).trimmingCharacters(in: .whitespaces)
}
```

### 4. Fix lsregister:
```swift
process.arguments = ["-f", "-R", "-trusted", appURL.path]
```

### 5. Add Finder restart:
```swift
private func restartFinder() {
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/bin/killall")
    task.arguments = ["Finder"]
    try? task.run()
}
```

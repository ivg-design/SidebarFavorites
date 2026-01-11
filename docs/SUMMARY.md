# SidebarFavorites - Summary of Working Implementation

## Quick Start (One Step)

```bash
# With custom icon:
./scripts/setup_prototype.sh /path/to/your-symbol.svg

# Without custom icon (uses default SF Symbol):
./scripts/setup_prototype.sh
```

---

## What Works Now

1. **Prototype app** (`SidebarFavorites.app`) successfully:
   - Shows custom github icon in Finder sidebar for `~/github`
   - Appears in System Settings → Extensions (both "By App" and "By Category > Finder Extensions")
   - Extension is properly registered with pluginkit

2. **One-step script** (`scripts/setup_prototype.sh`):
   - Builds, installs custom icon, signs, launches, and enables in one command
   - Automatically extracts symbol name from SVG's `descriptive-name` field
   - Only re-signs main app (preserves extension signature)

---

## Key Learnings

### 1. NEVER Re-sign the Extension
The biggest issue was re-signing the extension appex. When you re-sign the extension:
- pluginkit no longer recognizes it
- It disappears from "Finder Extensions" category
- It may appear as "File Provider" instead

**Correct approach:** Only re-sign the main app bundle, leave extension signature intact.

### 2. Symbol Name Must Match SVG's descriptive-name
The SF Symbol SVG template contains a `descriptive-name` field:
```xml
<text id="descriptive-name">sidebar.github.rectangle</text>
```
The `CFBundleSymbolName` in Info.plist MUST match this exactly.

### 3. Restart Finder After Icon Changes
Finder caches sidebar icons aggressively. After changing the icon, run:
```bash
killall Finder
```

### 4. Use Release Build (Not Debug)
Debug builds link to `@rpath/*.debug.dylib` which breaks when the app is moved.

---

## Manager App Issues to Fix

The `IconAppGenerator.swift` has these problems:

| Issue | Line | Problem | Fix |
|-------|------|---------|-----|
| Re-signs extension | 237-242 | Breaks pluginkit registration | Remove extension re-signing |
| Removes ext signature | 211-212 | Breaks pluginkit registration | Only remove main app signature |
| Wrong symbol name | 45 | Uses user input, not SVG | Extract from SVG's descriptive-name |
| Incomplete lsregister | 274-278 | Missing `-R -trusted` | Add full flags |
| No Finder restart | N/A | Icons remain cached | Add Finder restart |

See `MANAGER_FIXES_NEEDED.md` for detailed code changes.

---

## File Locations

- **Prototype app:** `build/Build/Products/Release/SidebarFavorites.app`
- **Manager app:** `build/Build/Products/Release/SidebarFavorites Manager.app`
- **Template:** `build/Build/Products/Release/IconAppTemplate.app`
- **Generated apps:** `~/Library/Application Support/SidebarFavorites/Apps/`
- **Custom icons:** `~/Library/Application Support/SidebarFavorites/Icons/`
- **Config:** `~/Library/Application Support/SidebarFavorites/config.json`

---

## Verification Commands

```bash
# Check extension is registered and enabled
pluginkit -m -p com.apple.FinderSync | grep sidebar
# Should show: +    com.ivg-design.SidebarFavorites.Sync(1.0)

# Check symbol name in app
/usr/libexec/PlistBuddy -c "Print :CFBundleIcons:CFBundlePrimaryIcon:CFBundleSymbolName" /path/to/app/Contents/Info.plist

# Check code signing
codesign -dv /path/to/app 2>&1 | grep Authority
```

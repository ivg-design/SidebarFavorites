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

## SF Symbol Icons

### System SF Symbols (Built-in)
System SF Symbols like `star.fill`, `hammer.fill`, `waveform` work with just `CFBundleSymbolName` in Info.plist - **no Assets.car compilation needed**.

### Custom SF Symbol SVGs
Custom SVGs (like the GitHub icon) require:
1. A properly formatted SF Symbol template SVG with `descriptive-name` field
2. Compilation to Assets.car via actool
3. `CFBundleSymbolName` set to match the SVG's `descriptive-name`

---

## Known Limitations

### CloudStorage Paths Not Supported
Finder sidebar icons **do not work** for paths in `~/Library/CloudStorage/` (Google Drive, iCloud, Dropbox, OneDrive, etc.).

**Why?** CloudStorage folders are FileProvider virtual mounts managed by the cloud provider's own extension. FinderSync extensions cannot provide sidebar icons for these paths.

**Workaround:**
1. Create a symlink to the CloudStorage folder: `ln -s ~/Library/CloudStorage/Provider/folder ~/Desktop/MyLink`
2. Use the symlink path as the favorite in the Manager app
3. The Browse button now preserves symlink paths (doesn't resolve to target)

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

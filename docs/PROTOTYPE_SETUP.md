# SidebarFavorites Prototype - Working Setup Documentation

## Summary
This document captures the exact steps to get a working Finder Sync extension with a custom SF Symbol icon in the macOS sidebar.

---

## What Works (Final State)

The prototype `SidebarFavorites.app` successfully:
1. Registers with `pluginkit` as a Finder Sync extension
2. Shows custom github icon in Finder sidebar for `~/github`
3. Appears in System Settings under BOTH "By App" and "By Category > Finder Extensions"

---

## Critical Steps (In Order)

### Step 1: Build with Xcode (Release configuration)
```bash
cd /Users/ivg/github/SidebarFavorites
rm -rf build
xcodebuild -scheme SidebarFavorites -configuration Release -derivedDataPath build
```

**Why Release?** Debug builds link to `@rpath/*.debug.dylib` which breaks when the app is moved or copied.

**What Xcode does automatically:**
- Signs the app AND extension with proper certificates
- Registers with Launch Services via `lsregister -f -R -trusted`
- Preserves extension signature integrity

### Step 2: Compile Custom SVG Symbol (if using custom icon)
```bash
SVG_PATH="/path/to/your-symbol.svg"
SYMBOL_NAME="sidebar.github.rectangle"  # MUST match descriptive-name in SVG!

TEMP_DIR=$(mktemp -d)
SYMBOLSET_DIR="$TEMP_DIR/${SYMBOL_NAME}.symbolset"
mkdir -p "$SYMBOLSET_DIR"
cp "$SVG_PATH" "$SYMBOLSET_DIR/${SYMBOL_NAME}.svg"

cat > "$SYMBOLSET_DIR/Contents.json" << EOF
{
  "info": { "author": "xcode", "version": 1 },
  "symbols": [{ "filename": "${SYMBOL_NAME}.svg", "idiom": "universal" }]
}
EOF

XCASSETS_DIR="$TEMP_DIR/CustomSymbols.xcassets"
mkdir -p "$XCASSETS_DIR"
mv "$SYMBOLSET_DIR" "$XCASSETS_DIR/"
cat > "$XCASSETS_DIR/Contents.json" << 'EOF'
{ "info": { "author": "xcode", "version": 1 } }
EOF

mkdir -p "$TEMP_DIR/output"
actool --compile "$TEMP_DIR/output" --platform macosx --minimum-deployment-target 13.0 "$XCASSETS_DIR"
```

**Critical:** The `SYMBOL_NAME` MUST match the `descriptive-name` field inside the SVG template!
To find it: `grep "descriptive-name" your-file.svg`

### Step 3: Install Custom Icon into App
```bash
APP_PATH="/path/to/SidebarFavorites.app"

# Copy Assets.car to Resources
cp "$TEMP_DIR/output/Assets.car" "$APP_PATH/Contents/Resources/"

# Update Info.plist with symbol name
/usr/libexec/PlistBuddy -c "Set :CFBundleIcons:CFBundlePrimaryIcon:CFBundleSymbolName $SYMBOL_NAME" "$APP_PATH/Contents/Info.plist"
```

### Step 4: Re-sign ONLY the Main App (NOT --deep!)
```bash
codesign --force --sign "Apple Development" "$APP_PATH"
```

**CRITICAL:** Do NOT use `--deep`! Using `--deep` re-signs the extension and breaks its registration with pluginkit.

### Step 5: Launch the App
```bash
open "$APP_PATH"
```

### Step 6: Enable the Extension (if not auto-enabled)
```bash
pluginkit -e use -i com.ivg-design.SidebarFavorites.Sync
```

### Step 7: Restart Finder (to refresh icon cache)
```bash
killall Finder
```

---

## Key Findings / What Went Wrong Previously

### Issue 1: Wrong Symbol Name
- **Wrong:** `sidebar-github.rectangle.fixed` (filename with dashes)
- **Correct:** `sidebar.github.rectangle` (from SVG's `descriptive-name` field)

### Issue 2: Using `codesign --deep`
- `codesign --force --deep --sign "..."` re-signs the embedded extension
- This breaks the extension's registration with pluginkit
- Extensions silently fail to appear in `pluginkit -m`

### Issue 3: Finder Icon Cache
- Finder caches sidebar icons aggressively
- Must restart Finder after changing the icon
- `killall Finder`

### Issue 4: Extension Not Registering
- Fresh Xcode build automatically registers via `lsregister`
- Manual re-signing can break registration
- If extension disappears from pluginkit, rebuild from Xcode

---

## Verification Commands

```bash
# Check extension is registered and enabled
pluginkit -m -p com.apple.FinderSync | grep sidebar
# Should show: +    com.ivg-design.SidebarFavorites.Sync(1.0)

# Check symbol name in app
/usr/libexec/PlistBuddy -c "Print :CFBundleIcons:CFBundlePrimaryIcon:CFBundleSymbolName" "$APP_PATH/Contents/Info.plist"

# Check Assets.car contains the symbol
assetutil --info "$APP_PATH/Contents/Resources/Assets.car" | grep -A2 '"Name"'

# Check code signing (should show Apple Development certificate)
codesign -dv "$APP_PATH" 2>&1 | grep Authority
```

---

## File Structure (Working Prototype)

```
SidebarFavorites.app/
├── Contents/
│   ├── Info.plist          # Contains CFBundleIcons.CFBundlePrimaryIcon.CFBundleSymbolName
│   ├── MacOS/
│   │   └── SidebarFavorites
│   ├── Resources/
│   │   └── Assets.car      # Compiled custom SF Symbol (optional)
│   └── PlugIns/
│       └── SidebarFavoritesSync.appex/
│           └── Contents/
│               ├── Info.plist    # NSExtension.NSExtensionPointIdentifier = com.apple.FinderSync
│               ├── MacOS/
│               │   └── SidebarFavoritesSync
│               └── Resources/
│                   └── URLs      # Contains monitored folder path (e.g., ~/github)
```

---

## What the Manager App Must Do Differently

Based on this analysis, the Manager app's `IconAppGenerator` needs to:

1. **NOT re-sign with `--deep`** - Only sign the main app bundle
2. **Extract correct symbol name** from SVG's `descriptive-name` field
3. **Use proper certificate** - "Apple Development" not ad-hoc ("-")
4. **Register via lsregister** after generating the app
5. **Restart Finder** after icon installation
6. **Build template in Release mode** - Not Debug

The generated apps were likely failing because:
- Re-signing with `--deep` broke extension registration
- Symbol name mismatch (using filename instead of descriptive-name)
- Possibly missing lsregister call

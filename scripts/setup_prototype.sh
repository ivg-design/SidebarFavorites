#!/bin/bash
# setup_prototype.sh - One-step setup for SidebarFavorites prototype with custom icon
#
# Usage: ./setup_prototype.sh [SVG_PATH]
# If SVG_PATH is provided, uses custom icon. Otherwise uses default SF Symbol.

set -e

PROJECT_DIR="/Users/ivg/github/SidebarFavorites"
BUILD_DIR="$PROJECT_DIR/build"
APP_NAME="SidebarFavorites"
APP_PATH="$BUILD_DIR/Build/Products/Release/${APP_NAME}.app"
EXTENSION_ID="com.ivg-design.SidebarFavorites.Sync"
DEFAULT_SYMBOL="folder.fill.badge.gearshape"

SVG_PATH="${1:-}"

echo "=== SidebarFavorites Prototype Setup ==="

# Step 1: Clean and build
echo ""
echo "[1/7] Cleaning previous build..."
pkill -f "$APP_NAME" 2>/dev/null || true
rm -rf "$BUILD_DIR"

echo "[2/7] Building Release configuration..."
cd "$PROJECT_DIR"
xcodebuild -scheme "$APP_NAME" -configuration Release -derivedDataPath build -quiet

echo "    Build succeeded"

# Step 3: Handle custom icon (if SVG provided)
if [ -n "$SVG_PATH" ] && [ -f "$SVG_PATH" ]; then
    echo "[3/7] Processing custom SF Symbol..."

    # Extract symbol name from SVG's descriptive-name field (inside tspan)
    SYMBOL_NAME=$(grep 'descriptive-name' "$SVG_PATH" | grep -oE '<tspan[^>]*>[^<]+</tspan>' | sed 's/<[^>]*>//g' | tr -d '[:space:]')

    if [ -z "$SYMBOL_NAME" ]; then
        echo "    ERROR: Could not find descriptive-name in SVG"
        exit 1
    fi
    echo "    Symbol name: $SYMBOL_NAME"

    # Create symbolset
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

    # Create xcassets
    XCASSETS_DIR="$TEMP_DIR/CustomSymbols.xcassets"
    mkdir -p "$XCASSETS_DIR"
    mv "$SYMBOLSET_DIR" "$XCASSETS_DIR/"
    cat > "$XCASSETS_DIR/Contents.json" << 'EOF'
{ "info": { "author": "xcode", "version": 1 } }
EOF

    # Compile
    mkdir -p "$TEMP_DIR/output"
    actool --compile "$TEMP_DIR/output" --platform macosx --minimum-deployment-target 13.0 "$XCASSETS_DIR" >/dev/null 2>&1

    if [ ! -f "$TEMP_DIR/output/Assets.car" ]; then
        echo "    ERROR: Failed to compile Assets.car"
        exit 1
    fi

    echo "[4/7] Installing custom icon..."
    cp "$TEMP_DIR/output/Assets.car" "$APP_PATH/Contents/Resources/"
    /usr/libexec/PlistBuddy -c "Set :CFBundleIcons:CFBundlePrimaryIcon:CFBundleSymbolName $SYMBOL_NAME" "$APP_PATH/Contents/Info.plist"

    echo "[5/7] Re-signing main app (NOT deep)..."
    codesign --force --sign "Apple Development" "$APP_PATH" >/dev/null 2>&1

    rm -rf "$TEMP_DIR"
else
    echo "[3/7] No custom SVG provided, using default symbol: $DEFAULT_SYMBOL"
    echo "[4/7] Skipping custom icon installation"
    echo "[5/7] Skipping re-signing (Xcode signature intact)"
    SYMBOL_NAME="$DEFAULT_SYMBOL"
fi

# Step 6: Launch app
echo "[6/7] Launching app..."
open "$APP_PATH"
sleep 2

# Enable extension
pluginkit -e use -i "$EXTENSION_ID" 2>/dev/null || true

# Step 7: Restart Finder
echo "[7/7] Restarting Finder to refresh icons..."
killall Finder

# Verify
sleep 2
echo ""
echo "=== Verification ==="
PLUGINKIT_STATUS=$(pluginkit -m -p com.apple.FinderSync 2>/dev/null | grep "$EXTENSION_ID" || echo "NOT FOUND")
echo "Extension status: $PLUGINKIT_STATUS"
echo "Symbol name: $SYMBOL_NAME"
echo ""
echo "=== Done ==="
echo "The ~/github folder should now show the custom icon in Finder sidebar."

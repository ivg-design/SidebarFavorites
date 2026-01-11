#!/bin/bash
set -e

# Build Release Script for SidebarFavorites Manager
# Creates a distributable DMG file

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
RELEASE_DIR="$BUILD_DIR/Release"
DMG_DIR="$BUILD_DIR/DMG"
APP_NAME="SidebarFavorites Manager"
DMG_NAME="SidebarFavorites"

# Get version from Info.plist
VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$PROJECT_DIR/SidebarFavoritesManager/Info.plist")
DMG_FILENAME="${DMG_NAME}-${VERSION}.dmg"

echo "=== Building SidebarFavorites Manager v${VERSION} ==="
echo ""

# Step 1: Clean previous builds
echo "Cleaning previous builds..."
rm -rf "$BUILD_DIR" 2>/dev/null || sudo rm -rf "$BUILD_DIR" 2>/dev/null || true
mkdir -p "$RELEASE_DIR"
mkdir -p "$DMG_DIR"

# Step 2: Generate Xcode project
echo "Generating Xcode project..."
cd "$PROJECT_DIR"
xcodegen generate

# Step 3: Build Release
echo "Building Release configuration..."
xcodebuild -project SidebarFavorites.xcodeproj \
    -scheme SidebarFavoritesManager \
    -configuration Release \
    -derivedDataPath "$BUILD_DIR/DerivedData" \
    CONFIGURATION_BUILD_DIR="$RELEASE_DIR" \
    build

# Step 4: Verify app was built
if [ ! -d "$RELEASE_DIR/$APP_NAME.app" ]; then
    echo "ERROR: Build failed - app not found"
    exit 1
fi

echo "Build successful: $RELEASE_DIR/$APP_NAME.app"

# Step 5: Ad-hoc sign the app (allows it to run without developer certificate)
echo "Ad-hoc signing the app..."
codesign --force --deep --sign - "$RELEASE_DIR/$APP_NAME.app"

# Step 6: Create DMG staging area
echo "Preparing DMG contents..."
DMG_STAGING="$DMG_DIR/staging"
mkdir -p "$DMG_STAGING"

# Copy app to staging
cp -R "$RELEASE_DIR/$APP_NAME.app" "$DMG_STAGING/"

# Create Applications symlink
ln -s /Applications "$DMG_STAGING/Applications"

# Create README file with instructions
cat > "$DMG_STAGING/README.txt" << 'EOF'
SidebarFavorites Manager
========================

Installation:
1. Drag "SidebarFavorites Manager" to the Applications folder

First Run (Security Approval):
Since this app is not notarized by Apple, macOS will block it on first run.
To open it:

  Option A - Right-click method (recommended):
  1. Right-click on "SidebarFavorites Manager" in Applications
  2. Select "Open" from the context menu
  3. Click "Open" in the security dialog
  4. The app will now open normally in the future

  Option B - System Settings:
  1. Try to open the app (it will be blocked)
  2. Go to System Settings → Privacy & Security
  3. Scroll down and click "Open Anyway"

After First Run:
- Enable the Finder extensions in System Settings → Login Items & Extensions
- The app will show you if extensions need to be enabled

Uninstall:
1. Delete favorites in the app (this removes the sidebar icons)
2. Drag "SidebarFavorites Manager" to Trash
3. Delete ~/Library/Application Support/SidebarFavorites (optional)

Source code: https://github.com/ivg-design/SidebarFavorites
EOF

# Step 7: Create DMG
echo "Creating DMG..."
DMG_PATH="$DMG_DIR/$DMG_FILENAME"

# Create temporary DMG
hdiutil create -volname "$DMG_NAME" \
    -srcfolder "$DMG_STAGING" \
    -ov -format UDRW \
    "$DMG_DIR/temp.dmg"

# Convert to compressed DMG
hdiutil convert "$DMG_DIR/temp.dmg" \
    -format UDZO \
    -o "$DMG_PATH"

rm "$DMG_DIR/temp.dmg"
rm -rf "$DMG_STAGING"

# Step 8: Show result
echo ""
echo "=== Build Complete ==="
echo "DMG created: $DMG_PATH"
echo "Size: $(du -h "$DMG_PATH" | cut -f1)"
echo ""
echo "To test, run:"
echo "  open \"$DMG_PATH\""
echo ""
echo "To upload to GitHub Releases:"
echo "  1. Go to https://github.com/ivg-design/SidebarFavorites/releases"
echo "  2. Click 'Create a new release'"
echo "  3. Tag: v${VERSION}"
echo "  4. Upload: $DMG_FILENAME"

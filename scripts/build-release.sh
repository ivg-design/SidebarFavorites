#!/bin/bash
set -e

# Build Release Script for SidebarFavorites Manager
# Creates a signed, notarized, distributable DMG file

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
# A DMG left mounted from a previous run keeps its backing file busy, and Finder
# recreates .DS_Store while rm is walking the tree - both make the first attempt
# fail spuriously. Detach anything we mounted, then retry once before giving up.
if [ -d "/Volumes/$DMG_NAME" ]; then
    echo "Detaching previously mounted /Volumes/$DMG_NAME..."
    hdiutil detach "/Volumes/$DMG_NAME" -quiet 2> /dev/null || true
fi

if ! rm -rf "$BUILD_DIR" 2> /dev/null && ! rm -rf "$BUILD_DIR"; then
    echo "ERROR: could not remove $BUILD_DIR (root-owned files from a previous sudo build?)."
    echo "Remove it manually (e.g. 'sudo rm -rf \"$BUILD_DIR\"') and re-run this script."
    exit 1
fi
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
    CODE_SIGNING_ALLOWED=NO \
    build

# Step 4: Verify app was built
if [ ! -d "$RELEASE_DIR/$APP_NAME.app" ]; then
    echo "ERROR: Build failed - app not found"
    exit 1
fi

echo "Build successful: $RELEASE_DIR/$APP_NAME.app"

# Step 5: Resolve signing identity
echo "Resolving signing identity..."
if [ -n "$SIGN_IDENTITY" ]; then
    IDENTITY="$SIGN_IDENTITY"
    echo "Using SIGN_IDENTITY override: $IDENTITY"
else
    IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null \
        | grep 'Developer ID Application' \
        | head -1 \
        | sed -E 's/^ *[0-9]+\) [A-F0-9]+ "(.*)"$/\1/')
    if [ -z "$IDENTITY" ]; then
        echo "WARNING: No 'Developer ID Application' signing identity found in the keychain."
        echo "WARNING: Falling back to ad-hoc signing (-). Gatekeeper will block this build"
        echo "WARNING: until the user manually approves it (see README.txt in the DMG)."
        IDENTITY="-"
    else
        echo "Using signing identity: $IDENTITY"
    fi
fi

CODESIGN_EXTRA_ARGS=()
if [ "$IDENTITY" != "-" ]; then
    CODESIGN_EXTRA_ARGS=(--options runtime --timestamp)
fi

# Step 6: Determine notarization eligibility
NOTARY_PROFILE="${NOTARY_PROFILE:-SidebarFavoritesNotary}"
DO_NOTARIZE=0
if [ "$NOTARIZE" = "0" ]; then
    echo "Notarization explicitly disabled (NOTARIZE=0)."
elif [ "$IDENTITY" = "-" ]; then
    echo "Skipping notarization: ad-hoc signing identity ('-') cannot be notarized."
else
    echo "Checking for notarization keychain profile '$NOTARY_PROFILE'..."
    if xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" > /dev/null 2>&1; then
        DO_NOTARIZE=1
        echo "Found notarization profile. The app and DMG will be notarized and stapled."
    elif [ -z "${NOTARY_PROFILE_EXPLICIT:-}" ] && xcrun notarytool history --keychain-profile "eXLib-notary" > /dev/null 2>&1; then
        # The credentials on this machine were stored once, under the name used by
        # the first project that needed them. Same Apple ID, same team - reuse it
        # rather than silently shipping an un-notarized build (which is exactly
        # what happened to the first 1.0.2 build attempt).
        NOTARY_PROFILE="eXLib-notary"
        DO_NOTARIZE=1
        echo "Profile not found; falling back to keychain profile 'eXLib-notary'."
    else
        echo "NOTE: No notarization keychain profile named '$NOTARY_PROFILE' was found."
        echo "NOTE: To enable automatic notarization, create one with:"
        echo "NOTE:   xcrun notarytool store-credentials \"$NOTARY_PROFILE\" --apple-id <apple-id> --team-id <team-id> --password <app-specific-password>"
        echo "NOTE: Continuing without notarization; the DMG will require the Gatekeeper 'Open Anyway' workaround."
    fi
fi

OUTER_APP_PATH="$RELEASE_DIR/$APP_NAME.app"

# Step 7: Sign the app, inner code first.
#
# Resources/FinderSyncTemplate holds two Mach-O executables - the host and
# extension binaries that advanced ("both icons") mode clones per favorite.
# Notarization rejects any executable in the bundle that is not itself signed
# with a Developer ID certificate, timestamped and hardened; sealing them as
# resources is not enough. They have to be signed before the outer bundle,
# because signing the app seals whatever they are at that moment.
TEMPLATE_DIR="$OUTER_APP_PATH/Contents/Resources/FinderSyncTemplate"
if [ -d "$TEMPLATE_DIR" ]; then
    for BINARY in "$TEMPLATE_DIR"/*-bin; do
        [ -f "$BINARY" ] || continue
        echo "Signing $(basename "$BINARY")..."
        codesign --force --sign "$IDENTITY" \
            "${CODESIGN_EXTRA_ARGS[@]}" \
            "$BINARY"
    done
fi

echo "Signing $APP_NAME.app..."
codesign --force --sign "$IDENTITY" \
    "${CODESIGN_EXTRA_ARGS[@]}" \
    "$OUTER_APP_PATH"

# Step 8: Notarize and staple the app (before packaging)
if [ "$DO_NOTARIZE" = "1" ]; then
    echo ""
    echo "Notarizing $APP_NAME.app (this can take a few minutes)..."
    NOTARY_APP_ZIP="$BUILD_DIR/notary-app.zip"
    /usr/bin/ditto -c -k --keepParent "$OUTER_APP_PATH" "$NOTARY_APP_ZIP"

    if ! xcrun notarytool submit "$NOTARY_APP_ZIP" --keychain-profile "$NOTARY_PROFILE" --wait; then
        echo "ERROR: App notarization failed."
        echo "Run 'xcrun notarytool log <submission-id> --keychain-profile \"$NOTARY_PROFILE\"' for details."
        exit 1
    fi

    rm -f "$NOTARY_APP_ZIP"

    echo "Stapling notarization ticket to $APP_NAME.app..."
    xcrun stapler staple "$OUTER_APP_PATH"
    xcrun stapler validate "$OUTER_APP_PATH"
else
    echo ""
    echo "Skipping app notarization."
fi

# Step 9: Create DMG staging area
echo "Preparing DMG contents..."
DMG_STAGING="$DMG_DIR/staging"
mkdir -p "$DMG_STAGING"

# Copy app to staging
cp -R "$OUTER_APP_PATH" "$DMG_STAGING/"

# Create Applications symlink
ln -s /Applications "$DMG_STAGING/Applications"

# Use the app's own icon as the disk image's volume icon. The file must be
# named .VolumeIcon.icns at the volume root AND the volume needs its custom-icon
# flag set, which is done on the mounted read/write image further below.
VOLUME_ICON_SRC="$PROJECT_DIR/SidebarFavoritesManager/Resources/AppIcon.icns"
if [ -f "$VOLUME_ICON_SRC" ]; then
    cp "$VOLUME_ICON_SRC" "$DMG_STAGING/.VolumeIcon.icns"
fi

# Create README file with instructions
if [ "$DO_NOTARIZE" = "1" ]; then
    cat > "$DMG_STAGING/README.txt" << 'EOF'
SidebarFavorites Manager
========================

Installation:
1. Drag "SidebarFavorites Manager" to the Applications folder
2. Open it from Applications - it's signed and notarized by Apple, so
   it will launch normally with no security warnings.

After First Run:
- Add your favorite folders and choose icons - that's it. The app adds the
  folder to Finder's sidebar and applies the icon for you.

Do I Need to Keep the Manager Running?
--------------------------------------
NO! Sidebar icons persist because they're stored in Finder's own Favorites
list plus a small registered helper bundle - nothing else needs to run.

  • Persist across reboots - no background process to restart
  • Survive Finder restarts - icons reappear automatically

The Manager app is only needed when you want to add, edit, or delete favorites.

Uninstall:
1. Delete favorites in the app (this removes the sidebar rows it added and
   restores the original icon on rows you added yourself)
2. Drag "SidebarFavorites Manager" to Trash
3. Delete ~/Library/Application Support/SidebarFavorites (optional)

Source code: https://github.com/ivg-design/SidebarFavorites
EOF
else
    cat > "$DMG_STAGING/README.txt" << 'EOF'
SidebarFavorites Manager
========================

Installation:
1. Drag "SidebarFavorites Manager" to the Applications folder

First Run (Security Approval):
Since this app is not notarized by Apple, macOS will block it on first run.
To open it:

  1. Try to open the app (it will be blocked)
  2. Go to System Settings → Privacy & Security
  3. Scroll down and click "Open Anyway"

After First Run:
- Add your favorite folders and choose icons - that's it. The app adds the
  folder to Finder's sidebar and applies the icon for you.

Do I Need to Keep the Manager Running?
--------------------------------------
NO! Sidebar icons persist because they're stored in Finder's own Favorites
list plus a small registered helper bundle - nothing else needs to run.

  • Persist across reboots - no background process to restart
  • Survive Finder restarts - icons reappear automatically

The Manager app is only needed when you want to add, edit, or delete favorites.

Uninstall:
1. Delete favorites in the app (this removes the sidebar rows it added and
   restores the original icon on rows you added yourself)
2. Drag "SidebarFavorites Manager" to Trash
3. Delete ~/Library/Application Support/SidebarFavorites (optional)

Source code: https://github.com/ivg-design/SidebarFavorites
EOF
fi

# Step 10: Create DMG
echo "Creating DMG..."
DMG_PATH="$DMG_DIR/$DMG_FILENAME"

# Create temporary DMG
hdiutil create -volname "$DMG_NAME" \
    -srcfolder "$DMG_STAGING" \
    -ov -format UDRW \
    "$DMG_DIR/temp.dmg"

# Set the volume's custom-icon flag so Finder shows .VolumeIcon.icns. This has
# to happen on the mounted read/write image, before the compressed conversion.
if [ -f "$DMG_STAGING/.VolumeIcon.icns" ]; then
    echo "Applying volume icon..."
    VOLUME_MOUNT="$(mktemp -d)"
    hdiutil attach "$DMG_DIR/temp.dmg" -nobrowse -mountpoint "$VOLUME_MOUNT" > /dev/null
    if command -v SetFile > /dev/null 2>&1; then
        SetFile -a C "$VOLUME_MOUNT"
    else
        # SetFile ships with the Xcode command line tools.
        echo "WARNING: SetFile not found - the DMG will use the default volume icon."
    fi
    hdiutil detach "$VOLUME_MOUNT" > /dev/null
    rmdir "$VOLUME_MOUNT" 2> /dev/null || true
fi

# Convert to compressed DMG
hdiutil convert "$DMG_DIR/temp.dmg" \
    -format UDZO \
    -o "$DMG_PATH"

rm "$DMG_DIR/temp.dmg"
rm -rf "$DMG_STAGING"

# Sign the disk image itself. A stapled notarization ticket is not a code
# signature: without this, Gatekeeper assesses the DMG as "no usable signature"
# even after it has been notarized and stapled.
if [ "$IDENTITY" != "-" ]; then
    echo ""
    echo "Signing disk image..."
    codesign --force --sign "$IDENTITY" --timestamp "$DMG_PATH"
fi

# Step 11: Notarize and staple the DMG
if [ "$DO_NOTARIZE" = "1" ]; then
    echo ""
    echo "Notarizing $DMG_FILENAME (this can take a few minutes)..."
    if ! xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait; then
        echo "ERROR: DMG notarization failed."
        echo "Run 'xcrun notarytool log <submission-id> --keychain-profile \"$NOTARY_PROFILE\"' for details."
        exit 1
    fi

    echo "Stapling notarization ticket to $DMG_FILENAME..."
    xcrun stapler staple "$DMG_PATH"
    xcrun stapler validate "$DMG_PATH"
else
    echo ""
    echo "Skipping DMG notarization."
fi

# Give the .dmg FILE itself the app's icon (the volume icon set earlier only
# shows once the image is mounted). This writes a resource fork and sets the
# custom-icon FinderInfo bit; the signed data fork is untouched, so the
# signature and the stapled ticket both survive - Step 12 re-checks them.
#
# NOTE: resource forks do not survive an HTTP download, so a DMG fetched from
# GitHub Releases shows the generic disk-image icon again. This is for the
# local artifact.
if [ -f "$VOLUME_ICON_SRC" ]; then
    echo ""
    echo "Applying icon to the disk image file..."
    /usr/bin/osascript - "$DMG_PATH" "$VOLUME_ICON_SRC" > /dev/null <<'APPLESCRIPT' || echo "WARNING: could not set the DMG file icon."
on run argv
    set dmgPath to item 1 of argv
    set icnsPath to item 2 of argv
    do shell script "/usr/bin/sips -i " & quoted form of icnsPath
    set rsrc to do shell script "/usr/bin/DeRez -only icns " & quoted form of icnsPath
    do shell script "echo " & quoted form of rsrc & " | /usr/bin/Rez -a -o " & quoted form of dmgPath
    do shell script "/usr/bin/SetFile -a C " & quoted form of dmgPath
end run
APPLESCRIPT
fi

# Step 12: Verification / report
echo ""
echo "=== Verification ==="
echo "Verifying code signature (deep, strict)..."
codesign --verify --deep --strict --verbose=2 "$OUTER_APP_PATH"

echo ""
echo "Checking Gatekeeper assessment for the app..."
if [ "$DO_NOTARIZE" = "1" ]; then
    echo "NOTE: expecting 'accepted' with source 'Notarized Developer ID'."
else
    echo "NOTE: 'rejected' is expected here - the app was not notarized."
fi
spctl -a -vv --type execute "$OUTER_APP_PATH" || true

echo ""
echo "Checking Gatekeeper assessment for the DMG..."
if [ "$DO_NOTARIZE" = "1" ]; then
    echo "NOTE: expecting 'accepted'."
else
    echo "NOTE: 'rejected' is expected here - the DMG was not notarized."
fi
spctl -a -vv -t open --context context:primary-signature "$DMG_PATH" || true

# Step 13: Show result
echo ""
echo "=== Build Complete ==="
echo "DMG created: $DMG_PATH"
echo "Size: $(du -h "$DMG_PATH" | cut -f1)"
if [ "$DO_NOTARIZE" = "1" ]; then
    echo "Signed with: $IDENTITY (notarized and stapled)"
else
    echo "Signed with: $IDENTITY (NOT notarized)"
fi
echo ""
echo "To test, run:"
echo "  open \"$DMG_PATH\""
echo ""
echo "To upload to GitHub Releases:"
echo "  1. Go to https://github.com/ivg-design/SidebarFavorites/releases"
echo "  2. Click 'Create a new release'"
echo "  3. Tag: v${VERSION}"
echo "  4. Upload: $DMG_FILENAME"

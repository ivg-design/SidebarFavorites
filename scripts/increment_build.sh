#!/bin/bash
# Auto-increment build number for SidebarFavorites
# Works for both Xcode builds and CLI builds
#
# Usage:
#   From Xcode: Add as a "Run Script" build phase with: $SRCROOT/scripts/increment_build.sh
#   From CLI: ./scripts/increment_build.sh [plist_path]

set -e

# Determine the plist path
if [ -n "$SRCROOT" ] && [ -n "$INFOPLIST_FILE" ]; then
    # Running from Xcode - use the source plist (not the built one)
    PLIST_PATH="${SRCROOT}/${INFOPLIST_FILE}"
elif [ -n "$1" ]; then
    # Path provided as argument
    PLIST_PATH="$1"
else
    # Default to Manager's Info.plist relative to script location
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    PLIST_PATH="${SCRIPT_DIR}/../SidebarFavoritesManager/Info.plist"
fi

# Check if plist exists
if [ ! -f "$PLIST_PATH" ]; then
    echo "Warning: Info.plist not found at $PLIST_PATH - skipping build increment"
    exit 0
fi

# Get current build number
BUILD_NUM=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$PLIST_PATH" 2>/dev/null || echo "0")

# Increment
NEW_BUILD_NUM=$((BUILD_NUM + 1))

# Update plist
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD_NUM" "$PLIST_PATH"

echo "Build number incremented: $BUILD_NUM → $NEW_BUILD_NUM"

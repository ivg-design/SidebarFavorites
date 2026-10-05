#!/bin/bash
# Re-takes every documentation screenshot of the app at its current source and frames them.
#
#   scripts/docs-screenshots.sh              # all shots
#   SBF_ONLY=main-window,settings scripts/docs-screenshots.sh   # a subset
#
# 1. builds the Debug app into its own derived-data dir (never touches the installed app),
# 2. runs the DEBUG-only offscreen mode (SBF_SCREENSHOTS): windows are opened at -30000,-30000,
#    never activated, never key, captured by window id, on sample data in a sandbox support dir,
# 3. frames each raw capture on a gradient (web/scripts/frame-shots.mjs) into web/public/shots-app,
# 4. prints the capture log (method per shot).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
WORK="${SBF_WORK:-/private/tmp/sbf-docs-shots}"
DD="$WORK/derived"
RAW="$WORK/raw"
SANDBOX="$WORK/Application Support/SidebarFavorites"
LOG="$WORK/capture.log"
mkdir -p "$WORK"
rm -rf "$RAW" "$WORK/Application Support"; mkdir -p "$RAW" "$SANDBOX"

echo "== build (Debug) =="
xcodebuild -project SidebarFavorites.xcodeproj -scheme SidebarFavoritesManager -configuration Debug \
  -derivedDataPath "$DD" build > "$WORK/build.log" 2>&1 || { tail -30 "$WORK/build.log"; exit 1; }
# The pre-build phase bumps CFBundleVersion in the source Info.plist; a screenshot run must not dirty the tree.
git checkout -- SidebarFavoritesManager/Info.plist 2>/dev/null || true

echo "== capture (offscreen, no activation) =="
APP="$DD/Build/Products/Debug/SidebarFavorites Manager.app/Contents/MacOS/SidebarFavorites Manager"
SBF_SCREENSHOTS="$RAW" SBF_SUPPORT_DIR="$SANDBOX" SBF_ONLY="${SBF_ONLY:-}" "$APP" > "$LOG" 2>&1 || true
[ -z "${SBF_ONLY:-}" ] && unset SBF_ONLY
grep "sbf-shots" "$LOG" || true

echo "== frame =="
(cd web && node scripts/frame-shots.mjs "$RAW" --out public/shots-app)
echo "== done: $(ls web/public/shots-app/*@2x.png | wc -l | tr -d ' ') framed shots in web/public/shots-app =="

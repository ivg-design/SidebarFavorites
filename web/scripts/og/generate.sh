#!/bin/sh
# Regenerates public/og.png from scripts/og/og.html (needs network for Google Fonts).
cd "$(dirname "$0")/../.." || exit 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=6000 --window-size=1200,630 --screenshot="$PWD/public/og.png" "file://$PWD/scripts/og/og.html"

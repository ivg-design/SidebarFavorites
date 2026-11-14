#!/bin/bash
# Exercise the production generator with the two templates from a built Manager.app.
set -euo pipefail
if [[ $# != 1 ]]; then echo "Usage: $0 /path/to/SidebarFavorites Manager.app" >&2; exit 2; fi
root=$(cd "$(dirname "$0")/.." && pwd)
source_dir="$root/SidebarFavoritesManager"
work=$(mktemp -d "${TMPDIR:-/tmp}/sbf-upgrade.XXXXXXXX")
trap 'rm -rf "$work"' EXIT
xcrun clang -fobjc-arc -fmodules -c "$source_dir/Services/CoreThemeCatalogWriter.m" -o "$work/catalog.o"
xcrun swiftc -parse-as-library -import-objc-header "$source_dir/Services/CoreThemeCatalogWriter.h" \
    "$source_dir"/Models/{Config,Favorite,SigningIdentity}.swift \
    "$source_dir"/Services/{ConfigManager,FinderSyncAppGenerator,ProcessRunner,SVGGeometryParser,SymbolCatalogBuilder,SymbolTemplateSynthesizer,SymbolValidator}.swift \
    "$root/scripts/tests/HelperUpgrade.swift" "$work/catalog.o" -o "$work/check-upgrade"
"$work/check-upgrade" "$1/Contents/Resources/FinderSyncTemplate" "$work"

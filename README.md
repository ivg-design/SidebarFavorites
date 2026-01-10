# SidebarFavorites

Add custom folders to macOS Finder's sidebar Favorites with custom icons.

![macOS](https://img.shields.io/badge/macOS-13.0+-blue)
![Swift](https://img.shields.io/badge/Swift-5.9-orange)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

This project uses macOS Finder Sync extensions to display custom icons for folders in the Finder sidebar. When you drag a monitored folder to the Favorites section, it displays a custom SF Symbol icon instead of the default folder icon.

## How It Works

1. The app registers a Finder Sync extension that monitors specified directories
2. The sidebar icon comes from `CFBundleSymbolName` in the app's `Info.plist`
3. When monitored folders are added to Favorites, they display the custom icon

## Current Status

This is a proof-of-concept implementation. See [ARCHITECTURE.md](ARCHITECTURE.md) for the planned full implementation with:
- GUI for managing multiple favorites
- Support for custom SF Symbol SVGs
- Automatic icon app generation
- Launch at login

## Building

### Requirements

- macOS 13.0+
- Xcode 15+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)

### Steps

```bash
# Install XcodeGen if needed
brew install xcodegen

# Generate Xcode project
xcodegen generate

# Build
xcodebuild -project SidebarFavorites.xcodeproj -scheme SidebarFavorites -configuration Release build

# Install
cp -R ~/Library/Developer/Xcode/DerivedData/SidebarFavorites-*/Build/Products/Release/SidebarFavorites.app /Applications/
```

## Usage

1. Launch the app (it runs in background, no dock icon)
2. Enable the Finder Sync extension in System Settings → Privacy & Security → Extensions → Added Extensions
3. Drag the monitored folder (`~/github` by default) to Finder's sidebar Favorites
4. The folder will display with the custom icon

### Changing the Monitored Folder

Edit `SidebarFavoritesSync/URLs` and rebuild:

```
~/your/folder/path
```

### Changing the Icon

Edit `SidebarFavorites/Info.plist` and change `CFBundleSymbolName` to any SF Symbol name:

```xml
<key>CFBundleSymbolName</key>
<string>folder.fill.badge.gearshape</string>
```

Or use a custom SF Symbol SVG (see [Creating Custom SF Symbols](#creating-custom-sf-symbols)).

## Creating Custom SF Symbols

1. Download the SF Symbols app from Apple
2. Export a template SVG
3. Edit in Illustrator/Sketch/etc.
4. Ensure the SVG has:
   - `id="Symbols"` layer with Ultralight-S, Regular-S, Black-S variants
   - `id="Guides"` layer with margin guides
   - `id="template-version"` text element
5. Create a `.symbolset` folder in Assets.xcassets
6. Reference it in Info.plist

## Limitations

- **One icon per app**: Each unique sidebar icon requires a separate app
- **Background app required**: The app must be running for icons to appear
- **Finder restart**: May need to restart Finder after changes (`killall Finder`)

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full planned architecture including:
- Manager app with GUI
- Automatic icon app generation
- Multiple favorites support
- Custom icon import and validation

## Credits

Inspired by [rknightuk/custom-finder-sidebar-icons](https://github.com/rknightuk/custom-finder-sidebar-icons).

## License

MIT License - see [LICENSE](LICENSE) for details.

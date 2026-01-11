# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-11

### Added
- Proper extension cleanup when favorites are deleted (disables via pluginkit, unregisters from Launch Services)
- Auto build number increment via Xcode build phase script

### Fixed
- **SF Symbol icons now work correctly** - Uses `CFBundleSymbolName` directly without requiring Assets.car compilation for system SF Symbols
- **Tilde expansion in SidebarFolderPaths** - Extension Info.plist now uses expanded paths for proper FinderSync registration
- **Browse button preserves symlinks** - File picker no longer resolves symlinks to their targets

### Known Limitations
- **CloudStorage paths (FileProvider mounts) are not supported** - Finder sidebar icons don't work for paths in `~/Library/CloudStorage/` (Google Drive, iCloud, Dropbox, etc.)
  - **Workaround**: Create a symlink to the CloudStorage folder and use the symlink path as the favorite

### Technical Notes
- System SF Symbols (e.g., `star.fill`, `hammer.fill`) only need `CFBundleSymbolName` set in Info.plist
- Custom SVG symbols still require compilation to Assets.car via actool
- CloudStorage folders are FileProvider virtual mounts that don't support FinderSync sidebar icons

## [0.2.0] - 2025-01-10

### Added
- SidebarFavorites Manager app with GUI for managing favorites
- Support for custom SF Symbol SVG icons
- Automatic icon app generation from template
- IconAppTemplate for generating per-favorite icon apps
- One-step prototype setup script (`scripts/setup_prototype.sh`)
- Comprehensive documentation in `docs/` folder
- Symbol name auto-extraction from SVG's `descriptive-name` field

### Fixed
- Extension registration issues (extensions now properly appear in Finder Extensions category)
- Custom icon compilation with correct symbol name extraction from SVG
- Code signing to preserve extension integrity (no longer re-signs extension)
- lsregister flags now match Xcode's behavior (`-f -R -trusted`)
- Finder restart after icon changes to refresh sidebar

### Changed
- Reorganized project structure with separate Manager app and prototype
- Improved README with full documentation
- IconAppGenerator now only signs main app, preserving extension signature

## [0.1.0] - 2025-01-10

### Added
- Initial proof-of-concept implementation
- Finder Sync extension for custom sidebar icons
- Support for SF Symbol icons via `CFBundleSymbolName`
- XcodeGen project configuration
- Basic documentation

### Known Issues
- Manager app extension registration needs fixes (see docs/MANAGER_FIXES_NEEDED.md)
- Each custom icon requires enabling in System Settings manually

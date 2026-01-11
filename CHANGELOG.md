# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

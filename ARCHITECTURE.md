# SidebarFavorites Manager - Architecture Plan

## Overview

A macOS utility that allows users to add multiple folders to Finder's sidebar Favorites section with custom icons. Due to macOS limitations (one CFBundleSymbolName per app = one icon), this is achieved through a **manager app** that generates and manages multiple lightweight **icon apps**.

---

## Core Constraint

macOS Finder Sync extensions get their sidebar icon from the host app's `Info.plist` → `CFBundleIcons` → `CFBundlePrimaryIcon` → `CFBundleSymbolName`. This means:
- One app = one icon
- Multiple icons = multiple apps
- The manager app orchestrates multiple icon apps

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SidebarFavorites Manager                      │
│                         (Main GUI App)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Config UI   │  │ Icon Picker │  │ App Generator Engine    │  │
│  │ - Add/Remove│  │ - SF Symbols│  │ - Creates icon apps     │  │
│  │ - Edit      │  │ - Custom SVG│  │ - Signs them            │  │
│  │ - Preview   │  │ - Validate  │  │ - Manages lifecycle     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Generates & Manages
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              ~/Library/Application Support/SidebarFavorites/     │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ IconApp-1.app   │  │ IconApp-2.app   │  │ IconApp-N.app   │  │
│  │ ├─ Info.plist   │  │ ├─ Info.plist   │  │ ├─ Info.plist   │  │
│  │ │  (github.icon)│  │ │  (folder.star)│  │ │  (custom.svg) │  │
│  │ ├─ Extension    │  │ ├─ Extension    │  │ ├─ Extension    │  │
│  │ │  monitors:    │  │ │  monitors:    │  │ │  monitors:    │  │
│  │ │  ~/github     │  │ │  ~/Projects   │  │ │  ~/Work       │  │
│  │ └─ Assets.car   │  │ └─ Assets.car   │  │ └─ Assets.car   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Manager App (SidebarFavoritesManager.app)

**Purpose**: GUI application for users to manage their sidebar favorites.

**Features**:
- Add/remove/edit favorites
- Pick folders via NSOpenPanel
- Pick icons (SF Symbols browser + custom SVG import)
- Validate custom SF Symbol SVGs
- Preview how the icon will look
- Generate/update icon apps
- Start/stop icon apps
- Configure launch at login

**Location**: `/Applications/SidebarFavoritesManager.app`

**Type**: Standard macOS app with UI (not LSBackgroundOnly)

### 2. Icon Apps (Generated)

**Purpose**: Lightweight apps that each provide one sidebar icon via Finder Sync extension.

**Structure**:
```
IconApp-{UUID}.app/
├── Contents/
│   ├── Info.plist              # Contains CFBundleSymbolName
│   ├── MacOS/
│   │   └── IconApp             # Minimal executable
│   ├── Resources/
│   │   └── Assets.car          # Compiled symbol asset (if custom)
│   └── PlugIns/
│       └── FinderSync.appex/
│           ├── Contents/
│           │   ├── Info.plist
│           │   ├── MacOS/
│           │   │   └── FinderSync
│           │   └── Resources/
│           │       └── URLs    # Monitored folder paths
│           └── _CodeSignature/
└── _CodeSignature/
```

**Location**: `~/Library/Application Support/SidebarFavorites/Apps/`

**Type**: Background-only app (LSBackgroundOnly = true)

### 3. Template App Bundle

**Purpose**: Pre-built app bundle that gets copied and customized for each icon.

**Location**: Inside Manager.app bundle at `Contents/Resources/IconAppTemplate.app`

**Why**: Faster than generating from scratch; ensures proper structure and code signing.

---

## Data Model

### Configuration File

**Location**: `~/Library/Application Support/SidebarFavorites/config.json`

```json
{
  "version": 1,
  "favorites": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "GitHub",
      "folderPath": "/Users/ivg/github",
      "iconType": "custom",
      "iconValue": "github.custom",
      "customSVGPath": "icons/github.custom.svg",
      "enabled": true,
      "createdAt": "2024-01-10T12:00:00Z",
      "updatedAt": "2024-01-10T12:00:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Projects",
      "folderPath": "/Users/ivg/Projects",
      "iconType": "sfSymbol",
      "iconValue": "folder.fill.badge.gearshape",
      "customSVGPath": null,
      "enabled": true,
      "createdAt": "2024-01-10T12:00:00Z",
      "updatedAt": "2024-01-10T12:00:00Z"
    }
  ],
  "settings": {
    "launchAtLogin": true,
    "showInMenuBar": true
  }
}
```

### Icon Types

1. **sfSymbol**: Built-in SF Symbol (e.g., "folder.fill", "star.circle")
2. **custom**: Custom SF Symbol SVG stored in app support directory

### Icons Directory

**Location**: `~/Library/Application Support/SidebarFavorites/Icons/`

Stores custom SVG files:
```
Icons/
├── github.custom.svg
├── work.custom.svg
└── ...
```

---

## Lifecycle Management

### Startup Sequence

1. **Manager app launches** (manually or at login)
2. **Reads config.json**
3. **For each enabled favorite**:
   - Check if icon app exists and is up-to-date
   - If not, generate/update the icon app
   - Launch the icon app (if not already running)
4. **Manager can quit** - icon apps continue running independently

### Icon App Generation

1. Copy template app to `Apps/{UUID}.app`
2. Update `Info.plist`:
   - Set `CFBundleIdentifier` to unique ID
   - Set `CFBundleSymbolName` to the icon
   - Set `CFBundleName` to favorite name
3. If custom icon:
   - Compile SVG into Assets.car using `actool`
   - Copy to Resources/
4. Update extension's `URLs` file with folder path
5. Re-sign the app with `codesign`
6. Register with Launch Services (`lsregister`)

### Icon App Update

Triggered when user changes icon or folder path:
1. Stop running icon app (`kill`)
2. Update the app bundle (same as generation)
3. Restart the icon app
4. Restart Finder if needed (`killall Finder`)

### Icon App Removal

1. Stop running icon app
2. Remove from sidebar (user drags out)
3. Delete app bundle
4. Update config.json

---

## Auto-Run at Login

### Option A: Login Items (Recommended)

Use `SMAppService` (macOS 13+) or `LSSharedFileList` (older):

```swift
import ServiceManagement

// Enable
try SMAppService.mainApp.register()

// Disable
try SMAppService.mainApp.unregister()
```

The Manager app:
1. Registers itself as a login item
2. On launch, starts all enabled icon apps
3. Can optionally hide to menu bar

### Option B: LaunchAgent

Create a plist in `~/Library/LaunchAgents/`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ivg-design.SidebarFavoritesManager</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/SidebarFavoritesManager.app/Contents/MacOS/SidebarFavoritesManager</string>
        <string>--background</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
```

### Icon Apps Auto-Start

Icon apps don't need their own login items. The Manager starts them:

```swift
func launchIconApp(at path: URL) {
    let config = NSWorkspace.OpenConfiguration()
    config.activates = false
    config.hides = true
    NSWorkspace.shared.openApplication(at: path, configuration: config)
}
```

---

## User Interface

### Main Window

```
┌─────────────────────────────────────────────────────────────────┐
│  SidebarFavorites                                    [─] [□] [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ┌────┐                                                      ││
│  │ │ 🐙 │  GitHub                              [Edit] [Remove] ││
│  │ └────┘  ~/github                                    ✓ Active││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ┌────┐                                                      ││
│  │ │ ⚙️ │  Projects                            [Edit] [Remove] ││
│  │ └────┘  ~/Projects                                  ✓ Active││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ┌────┐                                                      ││
│  │ │ ⭐ │  Work                                [Edit] [Remove] ││
│  │ └────┘  ~/Work                                      ✓ Active││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [+ Add Favorite]                                                │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ☑ Launch at Login    ☑ Show in Menu Bar           [Apply All] │
└─────────────────────────────────────────────────────────────────┘
```

### Add/Edit Sheet

```
┌─────────────────────────────────────────────────────────────────┐
│  Add Favorite                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Name:     [GitHub________________________]                      │
│                                                                  │
│  Folder:   [~/github______________________] [Browse...]          │
│                                                                  │
│  Icon:     ○ SF Symbol    ● Custom SVG                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │    [Search SF Symbols...____________]                        ││
│  │                                                              ││
│  │    ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐        ││
│  │    │📁 │ │⭐ │ │❤️ │ │⚙️ │ │📦 │ │🔧 │ │💼 │ │🎨 │        ││
│  │    └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘        ││
│  │    folder star  heart gear  box  wrench brief paint        ││
│  │                                                              ││
│  │    [Import Custom SVG...]                                    ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Preview:  ┌──────────────────────┐                             │
│            │ 🐙 GitHub            │  (simulated sidebar look)   │
│            └──────────────────────┘                             │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                        [Cancel]  [Save]          │
└─────────────────────────────────────────────────────────────────┘
```

### Menu Bar (Optional)

```
    ┌─────────────────────────┐
    │ SidebarFavorites    ▼  │
    ├─────────────────────────┤
    │ ✓ GitHub                │
    │ ✓ Projects              │
    │ ✓ Work                  │
    ├─────────────────────────┤
    │ Open Manager...         │
    │ Refresh All             │
    ├─────────────────────────┤
    │ Quit                    │
    └─────────────────────────┘
```

---

## Icon Handling

### SF Symbols (Built-in)

- Use `NSImage(systemSymbolName:accessibilityDescription:)` for preview
- Store just the symbol name (e.g., "folder.fill.badge.gearshape")
- No asset compilation needed - system provides the symbol

### Custom SF Symbols (SVG)

**Import Flow**:
1. User selects SVG file
2. Validate using SF Symbols structure requirements:
   - Must have `id="Symbols"` layer
   - Must have `id="Guides"` layer
   - Must have `id="template-version"` text with "Template v.X.X"
   - Must have Ultralight-S, Regular-S, Black-S variants
3. Copy to Icons directory
4. Compile to .symbolset for asset catalog
5. Show preview

**Validation Checks**:
```swift
func validateSFSymbolSVG(_ url: URL) -> Result<Void, SymbolError> {
    let content = try String(contentsOf: url)

    // Check for required layers
    guard content.contains("id=\"Symbols\"") else {
        return .failure(.missingSymbolsLayer)
    }
    guard content.contains("id=\"Guides\"") else {
        return .failure(.missingGuidesLayer)
    }
    guard content.contains("id=\"template-version\"") else {
        return .failure(.missingTemplateVersion)
    }

    // Check for required variants
    guard content.contains("id=\"Regular-S\"") else {
        return .failure(.missingRegularVariant)
    }

    // Extract and validate template version
    // ...

    return .success(())
}
```

**Asset Compilation**:
```bash
# Create symbolset structure
mkdir -p symbol.symbolset
cp custom.svg symbol.symbolset/
echo '{"info":{"version":1,"author":"xcode"},"symbols":[{"idiom":"universal","filename":"custom.svg"}]}' > symbol.symbolset/Contents.json

# Compile to Assets.car
xcrun actool symbol.symbolset --compile output/ --platform macosx --minimum-deployment-target 13.0
```

---

## Code Signing

### Challenge

Generated icon apps need to be signed to:
1. Run without Gatekeeper warnings
2. Have Finder Sync extensions work properly

### Solution

Use ad-hoc signing with the same team ID:

```bash
codesign --force --deep --sign "Apple Development: your@email.com (TEAM_ID)" \
    --entitlements entitlements.plist \
    IconApp.app
```

Or for distribution without developer account:
```bash
codesign --force --deep --sign - IconApp.app
```

### Entitlements

The Finder Sync extension needs:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
</dict>
</plist>
```

---

## File Structure

```
~/Library/Application Support/SidebarFavorites/
├── config.json                    # Main configuration
├── Icons/                         # Custom SVG storage
│   ├── github.custom.svg
│   └── work.custom.svg
└── Apps/                          # Generated icon apps
    ├── 550e8400-...-440000.app/   # GitHub icon app
    ├── 550e8400-...-440001.app/   # Projects icon app
    └── 550e8400-...-440002.app/   # Work icon app

/Applications/
└── SidebarFavoritesManager.app/
    └── Contents/
        ├── MacOS/
        │   └── SidebarFavoritesManager
        ├── Resources/
        │   └── IconAppTemplate.app/  # Template for generation
        └── Info.plist
```

---

## Build Process

### Xcode Project Structure

```
SidebarFavoritesManager/
├── project.yml                     # XcodeGen spec
├── SidebarFavoritesManager/        # Main app source
│   ├── App.swift
│   ├── Views/
│   │   ├── MainWindow.swift
│   │   ├── FavoriteRow.swift
│   │   ├── AddEditSheet.swift
│   │   └── IconPicker.swift
│   ├── Models/
│   │   ├── Favorite.swift
│   │   └── Config.swift
│   ├── Services/
│   │   ├── IconAppGenerator.swift
│   │   ├── LifecycleManager.swift
│   │   └── SymbolValidator.swift
│   ├── Resources/
│   │   └── IconAppTemplate.app/
│   └── Info.plist
└── IconAppTemplate/                # Template app source
    ├── IconApp/
    │   ├── main.swift
    │   └── Info.plist
    └── FinderSync/
        ├── FinderSync.swift
        ├── Info.plist
        └── FinderSync.entitlements
```

### Build Steps

1. Build IconAppTemplate.app first
2. Embed it in SidebarFavoritesManager.app/Contents/Resources/
3. Build SidebarFavoritesManager.app
4. Sign everything

---

## Technology Stack

- **Language**: Swift 5.9+
- **UI Framework**: SwiftUI (macOS 13+)
- **Minimum OS**: macOS 13.0 (Ventura)
- **Build System**: XcodeGen + xcodebuild
- **Code Signing**: codesign (ad-hoc or Developer ID)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Code signing fails for generated apps | Icon apps won't run | Use ad-hoc signing; include proper entitlements |
| Finder caches old icons | Users see stale icons | Auto-restart Finder after changes; bump CFBundleVersion |
| SF Symbol validation too strict | Users can't import valid SVGs | Provide clear error messages; allow override |
| Too many icon apps slow system | Performance issues | Warn if >10 favorites; show resource usage |
| macOS update breaks Finder Sync | Feature stops working | Monitor Apple changes; have fallback plan |

---

## Future Enhancements

1. **Icon library**: Pre-made icons for common apps (GitHub, Dropbox, etc.)
2. **iCloud sync**: Sync favorites across Macs
3. **Icon editor**: Simple built-in SVG editor for customization
4. **Folder badges**: Support for file badges in addition to sidebar icons
5. **Keyboard shortcuts**: Quick access to favorite folders

---

## Summary

This architecture enables a single manager app to provide multiple sidebar favorites with different icons by:

1. **Generating lightweight icon apps** from a template
2. **Managing their lifecycle** (start/stop/update)
3. **Providing a clean UI** for configuration
4. **Handling auto-start** at login
5. **Supporting both SF Symbols and custom icons**

Total resource usage scales linearly: ~14 MB RAM per favorite, 0% CPU when idle.

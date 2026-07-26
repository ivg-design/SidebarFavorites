# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-07-26

Fixes found by an adversarial review of the 1.0.0 release. 21 issues confirmed, 12 claims refuted.

### Fixed

- **Importing a malformed SVG could hang the app forever.** Three separate cases: an SVG using nested `<use>` references expanded exponentially (a 139-byte file was enough); a stray `.`, `-` or `+` in path data spun the number scanner in place; and a deeply nested document overflowed the stack and crashed. All three now finish in milliseconds or fail with a clear message. A very large `<style>` block and pathologically complex artwork are also bounded now instead of freezing the app for tens of seconds.
- **A sidebar row you created could be renamed and later deleted.** If you dragged a folder into Finder's sidebar at the moment the app happened to be reconciling, the app could mistake that row for one of its own. Ownership is now decided against live state at the moment of insertion rather than a snapshot taken earlier in the pass.
- **A failed icon build was remembered as a good one**, so custom icons stayed silently broken on every later launch. A partial build is no longer committed, and the next launch retries.
- **No subprocess had a timeout** - a stuck `actool`, `codesign` or `lsregister` wedged the app with no way out. All external commands now time out and report it.
- **Apply could restart Finder before your change had actually been applied**, so you saw the old icon and had to press it twice.
- A migration that could not read the old helper directory reported "nothing found" and marked the upgrade complete, stranding the old apps. It now says so plainly.
- Deleting a favorite mid-reconcile could leave an orphan row behind; "Remove All Sidebar Icons" could race a reconcile that immediately re-applied everything; and it had no re-entrancy guard.
- Two favorites pointing at the same folder no longer fight over one row's icon and pin the Restart Finder banner on permanently.
- Menu bar icons no longer re-render every custom icon on every configuration change.

## [1.0.0] - 2026-07-26

Version 1.0 replaces the mechanism behind sidebar icons entirely. Everything else in this release follows from that.

### Changed

- **New icon mechanism: no Finder extensions, no per-favorite apps, no background processes.** Previously each favorite needed its own generated app bundle containing a Finder Sync extension that you had to find and switch on in System Settings, and you had to drag the folder into Finder's sidebar yourself. Now the app sets a per-row icon override on Finder's Favorites list directly and ships **one** small helper bundle that maps each favorite's icon to a symbol. Finder resolves the icon through Launch Services. What this means in practice:
  - **iCloud Drive and `~/Library/CloudStorage` folders finally work.** Google Drive, Dropbox, OneDrive, iCloud - custom icons now behave exactly the same as for local folders. This was the single biggest limitation of every previous version, and it was unfixable with Finder Sync extensions.
  - **Nothing to enable anywhere.** There are no Finder extensions any more, so there is nothing in System Settings → Login Items & Extensions to switch on, and nothing to go missing or show up mislabelled as "File Provider".
  - **Nothing runs in the background.** The helper bundle is never launched - its executable is a 17-byte no-op shell script that exists only so the bundle registers.
  - **The app manages the sidebar row for you.** Adding a favorite adds the row; removing or disabling it takes the row away again. Rows you added yourself are adopted rather than replaced (see Upgrade Notes).
  - The helper lives at `~/Library/Application Support/SidebarFavorites/SidebarFavoritesIcons.app`, carries its own badged icon and a one-line description of what it is for, and is linked from Settings so it is never an unexplained bundle sitting in Application Support.
- **Custom icons: import any SVG.** The old flow required exporting a blank SF Symbols template, editing it inside guide boxes in Illustrator, keeping its `descriptive-name` element correct, and re-importing - anything else was rejected. Now you import an ordinary SVG - a logo, an exported icon, anything made of vector shapes - and the app builds the SF Symbols template around it. A real SVG parser handles the full path command set (including elliptical arcs), basic shapes, nested groups with composed transforms, `<style>` cascades, `<use>`/`<defs>`, and converts strokes to outlines.
- **Finder is never restarted automatically.** Earlier versions ran `killall Finder` as a side effect of ordinary work, which aborts in-flight copies and loses open windows and tabs. When icons change and Finder is still showing stale artwork, a banner offers a **Restart Finder** button instead.
- **Destructive actions now confirm, and say what they will do.** Removing a favorite names it and states whether the sidebar row goes away or only its icon; "Remove All Sidebar Icons" spells out exactly how many rows are removed and how many only lose their icon; disabling a favorite whose row the app added warns that the row is removed and that re-enabling puts it back at the bottom of the list.
- Menu bar Preferences uses `SettingsLink` on macOS 14+ instead of a private selector; macOS 13 keeps the previous fallback.
- Releases are Developer ID signed, notarized and stapled - both the app and the DMG - so the download opens normally with no Gatekeeper detour. The DMG uses the app icon as its volume icon.

### Added

- **Per-icon size slider (50-150%, default 100%)** for custom icons. 100% puts your artwork at exactly the size of a system SF Symbol, which is the correct measurement but not always the right look - a wide or dense mark reads heavier than a sparse one at the same size. The live preview follows the slider as you drag.
- **An Apply button** in the Add/Edit sheet: saves, rebuilds the icon and restarts Finder in one click while leaving the sheet open, so tuning size does not mean save/close/restart/reopen on every attempt.
- **Live preview of the real icon.** Both an enlarged silhouette and a mock sidebar row at the actual 16 pt drawing size, rendered from the same parsed geometry that gets compiled - so the preview cannot show something Finder will not draw.
- **Import diagnostics.** Raster content embedded in an SVG is detected and reported (the symbol rasterizer drops it silently); so are live text, gradients and colours that flatten, artwork far off square, and silhouettes too sparse, too dense or too fine to read at sidebar size. All are warnings - the import still succeeds.
- **Warnings banner** in the main window, surfacing per-icon failures - an icon that could not be compiled, a folder that no longer exists, a sidebar row that could not be updated - instead of silently falling back to a plain folder icon.
- **Corrupt `config.json` recovery.** A settings file that cannot be read is moved aside to `config.corrupt-<timestamp>.json` instead of being replaced silently, with a "Configuration Issue" banner in Settings and a **Reveal Backup** button.
- **Custom icons in the menu bar.** The menu bar list shows each favorite's actual artwork rather than a generic folder glyph.
- **About section in Settings**: app icon, "by IVG-Design", a link to the MIT license, and the version with its build number so a bug report can name the exact build.

### Fixed

- **The app can no longer rename or delete a sidebar row you created yourself.** Rows the app did not add are only ever given an icon; their name and position are left alone, and removing the favorite restores the original icon rather than deleting the row.
- **Icons no longer drop out of the sidebar repeatedly.** Previous versions regenerated every icon app and force-restarted them on *every* launch; now an unchanged configuration does no work at all.
- **Renaming a favorite no longer silently switches its icon off.** The rename used to invalidate the favorite's extension registration, leaving a plain folder icon with no indication why.
- **Several multi-second UI freezes are gone.** Icon compilation, signing, Launch Services registration and every Finder sidebar call now run off the main thread.
- **Cmd-N (Add Favorite) works** even when the main window has been closed - it opens the window first.
- **"Open SidebarFavorites" in the menu bar reliably focuses the main window.**
- **Launch at Login reflects the real system state.** The toggle reads the authoritative `SMAppService` status on appear and whenever the app becomes active, shows a caption while approval is still pending in System Settings, and reports an error if the change cannot be saved.

### Removed

- **The Code Signing section in Settings.** Signing choices were only ever relevant because each favorite shipped executable code in an extension. The helper bundle contains no code, so there is nothing to configure.
- **The "Save Blank Template..." export** and the whole SF Symbols template workflow it existed for. Import your SVG directly.
- The per-favorite generated apps and their Finder Sync extensions (see Upgrade Notes).
- The `~/Library/CloudStorage` symlink workaround documented for 0.3.0-0.5.0. Cloud folders are supported directly now; existing favorites pointing at such symlinks keep working.

### Known Limitations

- **Sidebar icons are always monochrome silhouettes.** Finder flattens them and tints them to match the sidebar - colour is not possible there. This is a macOS rule, not a choice this app makes, and the preview shows the true silhouette so there are no surprises.
- **Dense or wide artwork reads heavier than sparse artwork at the same size.** Apple's own symbols are hand-tuned individually; arbitrary artwork cannot be. That is what the size slider is for.

### Upgrade Notes

Upgrading from 0.4.1 or 0.5.0:

- **Nothing happens until you approve it.** On first launch a consent sheet lists the old helper apps found on your Mac - by the name and bundle identifier they actually have on disk - together with what will be removed, what will change, and what is kept. Choosing **Not Now** leaves everything exactly as it was and offers the upgrade again next time you open the app.
- **Your settings are copied first.** `config.json` is backed up to `config.pre-1.0.json` in `~/Library/Application Support/SidebarFavorites/` before anything is changed. An existing backup is never overwritten.
- **Everything carries over.** Favorites, names, folders, imported custom artwork and timestamps are all preserved. No favorite is added or removed.
- **Sidebar rows you added yourself are adopted, not replaced.** The upgrade never removes a row from Finder's sidebar. A row you dragged in keeps its name and its position and simply gains its icon; the app will not delete it later either.
- **The old per-favorite apps are terminated, their extensions unregistered, and the bundles deleted.** Anything under `Apps/` that does not identify itself as one of ours is left alone, and the sheet says so.
- **Stale entries can linger in System Settings until it is reopened.** If System Settings → Login Items & Extensions was open during the upgrade, the removed Finder extensions may still be listed. Close and reopen System Settings and they will be gone.

## [0.5.0] - 2026-01-16

### Added
- **Automatic signing identity detection** - App now detects available code signing certificates from keychain
- **Ad-hoc signing fallback** - Users without Apple Developer certificates can now use the app (ad-hoc signing is used automatically)
- **Signing Identity settings** - New settings section to view/configure code signing preferences
  - Automatic (recommended) - tries certificates first, falls back to ad-hoc
  - Ad-hoc - no certificate required
  - Apple Development - requires Apple Developer Program membership
  - Developer ID Application - requires Apple Developer Program membership

### Fixed
- **"no identity found" error** - Users without developer certificates no longer see signing errors
- **"item could not be found in keychain" error** - Resolved by automatic fallback to ad-hoc signing

### Technical Notes
- Ad-hoc signed apps work for local use but extensions may not appear in System Settings on some machines
- For full functionality, an Apple Developer certificate is recommended but no longer required

## [0.4.1] - 2026-01-11

### Added
- **Accurate custom SVG icon rendering** - Uses NSImage native SVG support with proper SF Symbol template extraction
- **Bundled SF Symbol template** - "Save Blank Template..." now exports a proper Apple SF Symbol template

### Fixed
- **Custom SVG icons now render correctly** - Extracts Regular-S symbol region from SF Symbol templates with correct viewBox coordinates
- **Icon size matching** - Custom SVG icons now match SF Symbol icon sizes in the favorites list

### Changed
- Replaced WebKit-based SVG rendering with simpler NSImage approach
- SVG thumbnail cache now properly extracts symbol region using guide line coordinates

## [0.4.0] - 2026-01-11

### Added
- **Menu bar icon** with quick access to favorites and actions
- **Extension status checker** - Shows warning when extension needs to be enabled in System Settings
- **"Enable Extension" button** - Click to open System Settings directly to Login Items & Extensions
- **SVG template export** - "Save Blank Template..." button to create custom icons with guidelines dialog
- **Custom app icon** - Using icns format for transparent icon (no macOS Big Sur+ rounded rectangle)
- **Recommended Xcode build settings** - DEAD_CODE_STRIPPING, ENABLE_USER_SCRIPT_SANDBOXING

### Fixed
- **Extensions button** now opens correct System Settings pane (Login Items & Extensions)
- **App icon** - Uses icns format to avoid automatic macOS background on transparent icons

### Changed
- Archived prototype targets (`SidebarFavorites`, `SidebarFavoritesSync`) to `_archive/` folder
- Inlined build number increment script to avoid sandbox issues

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

### Notes
- Initial prototype release
- Extension registration issues were fixed in v0.2.0

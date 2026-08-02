# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2026-08-01

### Changed

- **The favorite editor is its own window.** It was a sheet: fixed size, stuck
  to the middle of the app, and covering the list it was describing. It can now
  be moved, resized and left open beside the list, and ⌘N opens it whether or
  not the main window is up. Editing the same favorite twice brings its window
  forward instead of opening a second copy.
- **The main window resizes.** It was pinned to its content, so a list longer
  than the window could be scrolled but never given more room. It now has a
  minimum size rather than a fixed one.
- Documentation screenshots replaced with a set that walks the whole flow, and
  three claims they contradicted corrected - notably the front-page line saying
  no Finder extension is ever involved, which stopped being true for favorites
  using Both-icons mode.

## [1.2.1] - 2026-08-01

Fixes to the flow 1.2.0 introduced, and a way to reach every SF Symbol.

### Added

- **Browse the whole SF Symbols catalog.** The editor showed 24 common symbols
  and otherwise expected the name to be typed from memory. **Browse All…** now
  opens a searchable grid of every symbol this Mac can actually draw - about
  8,300 of them - matched on name and on the same keywords the SF Symbols app
  searches, so "bin" finds `trash`. The list comes from macOS itself rather than
  a copy baked into the app, so it grows with the OS.

### Fixed

- **Choosing what to do about a folder's own icon is now a choice you can
  change.** The three options were buttons that acted immediately: picking
  "Remove its icon" deleted the icon on the spot and left no way back to the
  other two. They are radio buttons now, nothing happens until you press Save or
  Apply, and Cancel leaves the folder untouched.
- **The mode picker no longer contradicts the choice above it.** "Keep both
  icons" was drawn as though it were already selected while Mode still read
  "Sidebar icon only". The choice and the mode are now one piece of state, so
  they cannot disagree.
- **The same folder can no longer be added twice.** Two favorites on one folder
  fight over a single sidebar row: whichever the reconcile reaches first wins,
  the other reports itself unbound, and deleting either takes the row away. Add
  is refused with a note naming the favorite that already uses the folder.

## [1.2.0] - 2026-08-01

Folders that carry their own icon - the kind people set so the folder is
recognisable in the Dock - could not also keep a custom sidebar icon on macOS 26.
Now they can.

### Added

- **Both icons mode.** A favorite can now keep the folder's own icon *and* a
  custom sidebar glyph at the same time. Finder draws a sidebar row from a
  different source when a Finder Sync extension claims that folder - the
  extension's containing app icon - and that path ignores the folder's own icon
  entirely, so the glyph survives. Turning the mode on generates one small
  helper for that favorite in
  `~/Library/Application Support/SidebarFavorites/AdvancedApps/`. The helper's
  host app quits itself a few seconds after registering; only the extension
  stays, at about 6 MB. Drag-and-drop onto the row, Open/Save panels and custom
  SVG artwork all behave exactly as in the normal mode.
- **A real choice when a folder has its own icon.** Adding such a folder used to
  offer only "Remove Its Icon". It now offers **Keep Both Icons**, **Remove Its
  Icon** and **Leave As Is**, each stating what it does. Folders without an icon
  of their own are added with no extra questions, as before.
- **Finder Sync Helpers section in Settings.** Lists every helper by the name it
  has in System Settings (`SBF-<favorite>`), with a live indicator for whether
  macOS actually has it enabled, and a shortcut to the Login Items & Extensions
  pane.

### Changed

- The mode is a per-favorite setting in the favorite's editor, so an existing
  favorite can be converted either way at any time. Switching back removes the
  helper and the row falls straight back to the normal sidebar icon - the normal
  icon code is kept on the row in both modes, so there is always something to
  fall back to.
- The main window's status area shows the version and build instead of "Ready",
  and the menu bar popover shows it too.
- Settings is taller (nothing needs scrolling any more) and closes with Escape.
- The warning about a folder's own icon no longer argues for removing it, since
  removing is now one of three options rather than the only one.

### Fixed

- Apply stayed disabled when the only thing changed in the editor was "Show in
  Locations only" - that field was missing from the change comparison.
- A folder icon applied within about ten seconds of the folder being created was
  silently discarded by macOS. Icon work now waits for the folder to settle.

## [1.1.0] - 2026-07-31

macOS 26 changed how Finder draws sidebar rows, which broke custom icons in a way
that looked random. This release fixes that, removes the Xcode requirement for
custom SVG icons, and adds support for disks and network shares.

### Added

- **Custom SVG icons no longer need Xcode.** They were compiled with `actool`,
  which ships only inside Xcode, so on a Mac without it every custom icon failed
  with a message about a missing developer tool. `actool` turns out not to be the
  compiler at all - it is a command-line front end for an engine that ships with
  macOS itself - so the app now drives that engine directly. The catalog it
  produces is byte-for-byte what `actool` produced. `actool` is still used if the
  new route is ever unavailable.
- **Disks and network shares can have custom icons**, in both the Favorites and
  the Locations sections. Adding a mounted volume as a favorite icons the row it
  creates and the row Finder already shows under Locations, so the two agree.
- **"Show in Locations only"**, for a mounted volume. Finder lists every mounted
  disk and server under Locations whether or not you asked, so this icons that
  row and adds no second row under Favorites. Finder's row is only ever patched -
  never inserted, moved or deleted - and it is handed back untouched when the
  favorite is disabled or removed.
- **A warning when a folder or disk carries a custom icon of its own**, with a
  one-click **Remove Its Icon** that backs the icon up first (to
  `~/Library/Application Support/SidebarFavorites/IconBackups/`). See below for
  why this is the one thing that makes a sidebar icon permanent.

### Fixed

- **Sidebar icons disappearing after a copy, a save, or any change at all.** On
  macOS 26, Finder redraws a sidebar row from its target's own icon whenever the
  target's metadata changes - a copied file, or nothing more than a touched
  modification date - and throws away the icon this app set. It only happens to a
  target that has an icon of its own: a folder with a custom Finder icon, or a
  disk with a `.VolumeIcon.icns`. A plain folder is unaffected and always was.
  Removing the target's own icon fixes it permanently and costs nothing visible,
  because Finder never draws those icons in the sidebar anyway.
- **Refresh now actually repairs a row.** It previously skipped any row whose
  stored state already looked correct, which is exactly the case above: the icon
  was still recorded on the row while Finder drew something else, so Refresh
  appeared to do nothing. It now rewrites every bound row, which makes Finder
  redraw it immediately with no restart.
- **A damaged helper bundle now rebuilds itself.** Upgrading to macOS 26.6 was
  measured emptying the bundle out, leaving only its `Info.plist`. Because the
  bundle directory still existed and nothing in the configuration had changed,
  every launch skipped the rebuild that would have fixed it, and every custom
  icon stayed blank. The check now looks for the parts, not the directory.

## [1.0.2] - 2026-07-27

### Removed

- **The name field is no longer editable - a favorite is always named after its folder.** The editable name was a false promise: Finder always paints a Favorites row with the folder's real name. A custom label written to the row is stored in the list database but never displayed, and the two indirection mechanisms that do show a custom name - a row pointing at a symlink, or at a Finder alias - both stop accepting drag and drop and no longer spring open (all measured). Rather than ship a name that only exists inside the manager, or rows that break dropping, the name now tracks the folder: it is derived from the folder path when adding, editing and loading, and configs carrying old custom names are normalized on load. Renaming a sidebar favorite means renaming the folder, because that is the only rename Finder respects.

### Fixed

- The Increment Build Number build phase had been failing silently on every build since 1.0.1 (Xcode's script sandbox blocked its write to the source Info.plist, and the script discarded the error), so every build reported the same build number. The sandbox is now disabled for the script, and a failure to bump is reported loudly.

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

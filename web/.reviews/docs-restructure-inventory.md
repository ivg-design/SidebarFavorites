# SidebarFavorites docs: restructure inventory

Read as rendered (`/docs`, `/docs/*`) and as source (`src/content/docs/*.tsx`) on 2026-10-04. A "blob" is a
passage where the reader has to parse a dense sentence to extract settings, options, steps, file formats,
permissions, menu paths or commands. Style guide: `docs-style.md`.

## Before

16 pages, 34 blobs.

| Page | Blobs | What is wrong |
|---|---|---|
| quick-start | 2 | The lede is a slogan plus a requirement. "Choose the icon" packs two icon types, two example names and a button into one step. No outcome after each step, no troubleshooting; the last section is a lone callout. |
| install | 2 | Three commands in one block with no explanation of what each does; `brew trust` explained after the fact. Requirements is a one-line section at the end. No "what you see", no troubleshooting. |
| updates | 1 | Two buttons explained in one line; "what the check does" is one sentence of four negatives. Two short sections that are one idea. |
| custom-svg-icons | 4 | Import, preview, slider and Apply as paragraphs, not steps. Warnings are a bullet list of six items with several quoted messages per bullet. The refusal messages are six quotes in one sentence. A version note in brackets. |
| cloud-folders | 2 | Two of three sections are history ("Why it did not work before 1.0", "The old symlink workaround"). What remains is one sentence. |
| disks-and-shares | 2 | The choice between the two modes is a bullet pair with the control name used as a sentence fragment. No steps, no figure, no statement of where the control is. |
| keeping-both-icons | 3 | The three choices are bullets that mix effect, mechanism and a file path. Helper facts (size, name pattern, where it appears) in one sentence. "Changing your mind" repeats "Removing a helper". |
| menu-bar-popover | 1 | Menu items as bullets with shortcuts inline. "Turning it off" is a one-line section. |
| how-it-works | 4 | A property key, a bundle path, a UTI mechanism and a 17-byte detail in running prose. "Finder restarts" is one paragraph holding three triggers and two conditions. "Where things live" repeats config.json. |
| config-json | 5 | The file listing is a code block with comments standing in for a table. Several fields per table row. Allowed values listed inside a cell. No example file. "The file is written atomically." is an orphan sentence. No recovery steps. |
| uninstalling | 2 | Step 1 holds two procedures and a parenthesis. The warning comes after the steps it qualifies. |
| building-from-source | 2 | Requirements in one sentence. Environment variables (`SIGN_IDENTITY`, `NOTARIZE`, `NOTARY_PROFILE`) explained in prose. |
| nix-flake | 1 | Three sections of one line each. |
| troubleshooting | 2 | Fixes as paragraphs with menu paths inline; no cause/fix structure. SVG problems in one sentence listing five causes. |
| faq | 0 | Short answers, which suits the page. Two answers say "No" and stop without saying what to do instead. |
| report-an-issue | 1 | "What to include" bullets hold two items each. |

Structural problems across the set:

- No page for the Settings window, although four pages send the reader there.
- Ledes are slogans or keyword lists, not a statement of what the page covers and who needs it.
- No callout names its kind; `Callout` is used as a section body on three pages.
- Code blocks have no visible label; the Files listing and the commands look the same.
- Menu paths typed with "›" or "→" in running text.
- Captions repeat the alt text ("The update notice.").
- Below 1180 px there is no "On this page" list at all.

## Version-history framing found

| Page | What it said | Where the fact went |
|---|---|---|
| cloud-folders | Section "Why it did not work before 1.0" and "The old symlink workaround". | Removed. The page states the current behaviour: cloud folders work like local ones, and why (the icon is set on the sidebar row, not on the folder). A favorite that points at a symlink keeps working, stated as a present fact. |
| cloud-folders (meta) | Excerpt "This did not work in any version before 1.0." | Removed. |
| custom-svg-icons | "(Before 1.1 this needed actool, which only exists inside Xcode.)" | Removed. The page says: no Xcode is required. |
| keeping-both-icons | "Folders without an icon of their own are added exactly as before" | Rewritten as present behaviour: such folders get no extra question. |
| nix-flake | "currently pinned to an older release" | Kept as a present fact, checked against `nix/default.nix`, with the pinned version shown as data. |
| config-json | `config.pre-1.0.json  pre-migration backup (written once)` | Kept as a file that may be present, described by what it is. The file name is data. |
| config-json | "Older config files with missing fields load without tripping this path." | Restated as a rule: every field except `id`, `name` and `folderPath` has a default. |
| how-it-works | none | |

## After

17 pages (16 rewritten, 1 added: `settings`). No page was removed and no slug changed, so no redirect is
needed. "The menu bar popover" is now titled "The menu bar menu" (the app shows a menu); its URL is unchanged.
Blobs left: 0 by the checks in `tests/docs.mjs` (history patterns, unlabelled code blocks, tables wider than
four columns, unnamed callouts, more than two callouts, em dashes outside quoted strings, "On this page" equal
to the h2 list) and by a read of every page.

Pages still weaker than the rest:

- `cloud-folders` is thin once the history is gone; the on-disk path of iCloud Drive and the offline cases are
  not in the source, so the page stays general there.
- `disks-and-shares` has no figure: nothing shows the **Show in Locations only** switch or Finder's sidebar.
- `nix-flake` is two short sections; there is little more to say.
- `custom-svg-icons` mixes the light fresh set with one older dark capture (`svg-import`).

## Figures placed (page: captures)

Names without a prefix are in `public/shots-app/` (the fresh framed set and its `manifest.json`); `svg-import`
is the older capture under `public/shots/`.

| Page | Captures |
|---|---|
| building-from-source | none |
| cloud-folders | none |
| config-json | none |
| custom-svg-icons | svg-import, editor-custom-svg |
| disks-and-shares | none |
| faq | none |
| how-it-works | settings |
| install | main-window-empty |
| keeping-both-icons | editor-own-icon, editor-both-icons |
| menu-bar-popover | menu-bar-menu, settings |
| nix-flake | none |
| quick-start | main-window-empty, editor-add, main-window, editor-icon-after, symbol-browser, main-window-notices |
| report-an-issue | settings-helpers |
| settings | settings, settings-helpers, settings-helper-not-registered, alert-remove-all |
| troubleshooting | none |
| uninstalling | alert-remove-all |
| updates | alert-update |

## Shot wish-list (nothing in the manifest shows these)

| Page and sentence | Window | State |
|---|---|---|
| quick-start, "What you see in Finder"; how-it-works, first paragraph | Finder | The sidebar before (grey folders) and after (a favorite with its icon). |
| disks-and-shares, add step 2 | Add Favorite | A volume path in **Folder Path**, with the **Show in Locations only** switch and its caption. |
| disks-and-shares, "Choose where the icon appears" | Finder | A disk with its icon under both Favorites and Locations; and with Locations only. |
| custom-svg-icons, import step 2 | Add Favorite, light | **Type** on **Custom SVG** before a file is chosen (**Import SVG...** visible), to replace the dark `svg-import`. |
| custom-svg-icons, refusals | Alert | "Can't Use This SVG" with one refusal message. |
| keeping-both-icons, helpers table; uninstalling, left-behind table | System Settings | General > Login Items & Extensions listing an `SBF-<name>` helper. |
| settings, Launch at Login messages | Settings | The caption "Waiting for approval in System Settings → Login Items" under the switch. |
| settings, About; config-json, "If the file cannot be read" | Settings | The **Configuration Issue** notice with **Reveal Backup**. |
| settings, helper rows | Settings | A helper row with the orange dot ("Disabled in System Settings …"). |
| troubleshooting, missing folder; faq, moved folder | Manager window | The "1 Warning" banner expanded, showing "…: folder no longer exists at …". |
| faq, "Can two favorites use the same folder?" | Add Favorite | The "already uses this folder" line with **Add** dimmed. |
| uninstalling, delete one by one | Manager window | A row under the pointer with its pencil and trash buttons. |
| menu-bar-popover, "Turn the menu bar item off and on" | Menu bar | The item in the menu bar itself, menu closed. |

Captures that do not match the app:

- `alert-remove-favorite.png` reads "Removes the row this app added to Finder's sidebar and restores the folder's
  normal icon." The app's dialog says "This removes it from Finder's sidebar." (`ContentView.swift`); the other
  text exists only in `ScreenshotMode.swift`. Not used.
- `migration-consent.png` shows the upgrade sheet. It is history, so the docs do not use it.
- `alert-turn-off.png` is accurate but no page describes switching a favorite off yet.

## Contradictions between the docs and the source

| Old page said | Source says | Now |
|---|---|---|
| "About 8,300 symbols on macOS 13." | `SymbolCatalog.swift` reads the count from the Mac's own catalog; "about 8,300" is its comment for macOS 26. The search field shows the exact count. | quick-start gives no number. |
| "Click + (or press ⌘N) … Add." | ⌘N belongs to the menu item **Add Favorite...**; the editor's button is **Add** for a new favorite and **Save** for an existing one; **Apply** saves and restarts Finder. **Browse All…** is hidden when the catalog cannot be read. | quick-start. |
| "The menu bar popover"; clicking a favorite "reveals its folder". | A native menu (`MenuBarExtra`, `.menu` style); a favorite opens its folder in a Finder window. Items are "Open SidebarFavorites...", "Preferences..." with three dots. | menu-bar-popover, retitled. |
| Remove All Sidebar Icons described as deleting favorites. | It removes rows and icons, deletes the helper bundle and helpers, and keeps the favorites in the list, switched to Sidebar icon only (`FavoriteSyncCoordinator`). | settings, uninstalling. |
| Duplicate folder: "Add is refused with a note". | **Add** is disabled and the editor shows "… already uses this folder." (`AddEditFavoriteSheet`). | troubleshooting, quick-start, faq. |
| "On macOS 26 a folder's own icon fights the sidebar": implied to be checked. | `IconAuthority` shows the warning on every macOS version; only its text mentions macOS 26. Disks with `.VolumeIcon.icns` get the same check. | keeping-both-icons. |
| "Show in Locations only" offered for any volume favorite. | The switch appears only for a volume root; a network share cannot be Locations-only. | disks-and-shares. |
| "Import SVG…" | The label is "Import SVG..." (three dots). | custom-svg-icons, quick-start. |
| SVG messages paraphrased; parser errors implied visible. | `SymbolValidator` maps parser errors to nine warnings and six refusals; the refusal alert is titled "Can't Use This SVG". | custom-svg-icons lists each verbatim. |
| `docs/ARCHITECTURE.md`: `actool` compiles the catalog. | `CoreThemeCatalogWriter` uses the engine in macOS; `actool` is only a fallback. | how-it-works, faq: no Xcode needed. |
| Finder restarts: "the banner button, the Settings action, or Apply". | Confirmed; **Save** and **Add** never restart Finder. | how-it-works table. |
| Building: three variables. | `build-release.sh` also reads `NOTARY_PROFILE_EXPLICIT`, falls back to a second profile name, runs `xcodegen` itself and writes `build/DMG/SidebarFavorites-<version>.dmg`. | building-from-source. |
| config.json: several fields per row; `signingIdentity` values in a cell. | `signingIdentity` has no control in the app; favorites need only `id`, `name`, `folderPath`; `osType` codes look like `S000`. `IconBackups/` was missing from the file list. | config-json. |
| Updates: "one request at startup". | Also: after sidebar setup, anonymous with a User-Agent, numeric tags only, every failure silent; the alert is titled "A new version is available". | updates. |

Not verifiable from the repo and worded with care: Homebrew upgrade and uninstall commands (none are given),
the contents of the DMG window, what happens to a row when its folder is moved, whether icons survive a macOS
update (left out), and whether "about 6 MB" for a helper is memory or disk.

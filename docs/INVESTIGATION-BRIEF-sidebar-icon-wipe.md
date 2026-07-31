# Independent investigation brief: sidebar icon wipe on macOS 26.x

**Purpose.** A prior investigation (2026-07-27/29) concluded that custom Finder sidebar icons are wiped by Finder on macOS 26.6 for a specific class of rows, and that there is no available workaround for mounted volumes. Those conclusions are stated below as **claims to be falsified**, not as established fact. Your job is to independently verify or refute them, and in particular to find a solution the prior investigation missed.

Treat every claim skeptically. The prior investigator made at least two errors during this work (documented under "Known errors made" below) and may have made more.

**Environment used for all measurements:** macOS 26.6 (build 25G72), Apple Silicon (M3 Ultra), Xcode installed. Some earlier measurements were made on macOS 26.2 and are marked as such.

---

## Background: how the app works

SidebarFavorites (repo root: this repository; see `docs/ARCHITECTURE.md`) puts custom icons on rows in Finder's sidebar **Favorites** section.

Mechanism, as of 1.0:

1. Each favorite is allocated a private four-character OSType code (`S000`, `S001`, …) by `OSTypeAllocator`.
2. The code is written onto the sidebar row as the private per-item property `com.apple.LSSharedFileList.OverrideIcon.OSType` (see `SidebarFavoritesManager/Services/SFLBridge.m`).
3. One helper bundle at `~/Library/Application Support/SidebarFavorites/SidebarFavoritesIcons.app` declares one exported UTI per favorite, tagging it with `com.apple.ostype` = that code, and pointing it at an SF Symbol name (`UTTypeSymbolName`). Custom SVGs are compiled into `Assets.car` in that bundle with `xcrun actool`.
4. Finder resolves the row's code to the UTI through Launch Services and draws that UTI's symbol.

Prior to 1.0 (version 0.5.0 and earlier), the app used a completely different mechanism: it generated one small `.app` per favorite, each embedding a **Finder Sync extension** (`com.apple.FinderSync`) that declared `SidebarFolderPaths` and supplied the icon via the host app's `CFBundleIcons → CFBundlePrimaryIcon → CFBundleSymbolName`. That version is available as a release artifact (`v0.5.0` DMG on GitHub releases) and its template is inside the DMG at `SidebarFavorites Manager.app/Contents/Resources/IconAppTemplate.app`.

---

## Claims to verify or refute

### CLAIM 1 — The wipe exists and is triggered by content change

On macOS 26.6, a Favorites row carrying a working custom icon **loses that icon visually** when the underlying object's contents change (e.g. a file is copied into the folder). The `OverrideIcon.OSType` property on the row is **NOT removed** — only the drawing reverts to the default glyph.

Prior evidence: dumping the row's properties immediately after a wipe shows the code still present and correct; only the rendering changed.

### CLAIM 2 — Only rows whose object has its own "icon authority" are affected

Affected:
- Folders carrying an on-disk custom icon (the Get Info paste mechanism: an `Icon\r` file in the folder plus the `kHasCustomIcon` FinderInfo flag, shown by `GetFileInfo -a` as an uppercase `C` in the attribute string).
- **All mounted volumes**, always (external disks, network shares) — a volume inherently has its own icon identity.

Not affected:
- Plain folders with no custom icon of their own. These keep their sidebar icons through content changes indefinitely.

Prior evidence (bidirectional, considered the strongest result of the investigation):
- A scratch folder `~/sbf-A` with a sidebar icon survived repeated file copies while it had no custom icon.
- The exact `Icon\r` file + `SetFile -a C` was then transplanted onto that scratch folder; the very next copy wiped its sidebar icon.
- On the user's real `~/github` favorite (which had a GitHub custom folder icon from March 2026), removing the folder's custom icon (`rm Icon\r` + `SetFile -a c`) stopped the wipes; restoring the icon made the next copy wipe it again; removing it again cured it again.

### CLAIM 3 — Any sidebar-list write repaints correctly (the heal)

Re-writing the row (an in-place `LSSharedFileListInsertItemURL` upsert with the same URL and code, anchored on the preceding row to preserve position and item ID) makes Finder repaint the correct custom icon **immediately, with no Finder restart**. A Finder relaunch also restores it.

Implication drawn: the app's "Refresh" could heal wiped icons by unconditionally re-stamping bound rows. (The shipped 1.0.2 Refresh does NOT do this — it skips rows whose recorded state already matches, which is why users report "Refresh does nothing".)

### CLAIM 4 — The old Finder Sync mechanism does NOT avoid the wipe

The 0.5.0 FinderSync approach was resurrected and tested on 26.6 (procedure in "How to reproduce" below). Result claimed:
- It **did** successfully apply a custom icon to a mounted volume's row in Favorites (something users report worked in 0.x).
- But a single file copied to that volume wiped it, identically to the new mechanism.
- A Finder relaunch restored it, identically.

Conclusion drawn: both independent APIs regress the same way, so the fault is in Finder's sidebar repaint arbitration, not in either icon-supply mechanism. **This is the claim most worth attacking** — see "Where a solution might still be hiding".

### CLAIM 5 — Volumes cannot be cured, folders can

Because a folder can shed its icon authority (delete the `Icon\r` + clear the flag), folder favorites have a real cure. A mounted volume cannot shed its icon identity, so volume favorites are claimed unfixable on this macOS.

Related sub-claims about volumes (verify these too):
- The **Locations** section is a separate list (`com.apple.LSSharedFileList.FavoriteVolumes`) that Finder populates itself; third-party icon overrides do not apply there. Only a volume row added to **Favorites** can take an override at all.
- `.VolumeIcon.icns` at a volume root (and the Get Info icon on a drive, which is the same mechanism) affects Desktop and Finder window views but **never** the sidebar. Verified on a drive that has carried a custom volume icon since 2021 while its sidebar row stayed generic.
- A volume row always displays the real volume name; the row's stored display name is ignored.

### CLAIM 6 — Mechanism internals (from disassembly, macOS 26.2)

`+[SFLList(LSSharedFileListSupport) copyBindingFromItem:]` in `SharedFileList.framework` reads `OverrideIcon.OSType` and converts it via `UTType(tag:tagClass:"com.apple.ostype")` → `_LSBindingCreateWithUTI` **before** falling back to bookmark/URL resolution, for every item that is not a "special item" (Computer etc.). Consequences claimed:
- The override is not folder-specific: it applies to volume rows too.
- Apple's own stock sidebar glyph codes work as overrides **with no helper bundle at all**: `sbTM` (Time Machine clock), `sbED` (external disk), `sbIn` (internal), `sbRm` (removable), `sbNw` (network), `sbOD` (optical). Verified by putting `sbTM` on a plain folder row and seeing the clock glyph.
- CoreTypes.bundle's Info.plist holds the UTI ↔ ostype ↔ `Sidebar*.icns` table.

### CLAIM 7 — Custom SVG icons require Xcode (issue #18)

`xcrun actool` ships only with full Xcode, not Command Line Tools, so custom SVG icons fail on machines without Xcode (SF Symbol icons are unaffected). A test of an alternative — rasterizing the SVG in-process to a template `.icns` and declaring it via `_UTTypeTemplateIconFile` (the exact key Apple's own sidebar glyph UTIs use) — **failed**: the sidebar ignored file-based icons from a third-party UTI declaration even when fed Apple's own repacked `SidebarExternalDisk.icns` artwork. Only `UTTypeSymbolName` from a compiled asset catalog worked. `CUIMutableCommonAssetStorage` (the private CoreUI catalog writer class that actool itself uses) **does exist in the OS shared cache**, suggesting in-process `.car` writing is possible without Xcode, but this was never tested.

---

## How to reproduce the key experiments

Diagnostic CLI tools are needed; the prior investigation used two small Objective-C programs (they were in a scratch directory and may be gone — recreate them):

**`dump_favorites`** — enumerate `kLSSharedFileListFavoriteItems`, printing for each row: `LSSharedFileListItemGetID`, display name, `com.apple.LSSharedFileList.OverrideIcon.OSType` property, and resolved path (use `kLSSharedFileListNoUserInteraction | kLSSharedFileListDoNotMountVolumes`).

**`insert_test`** — insert/remove/modify rows: `LSSharedFileListInsertItemURL` with a properties dictionary containing the OSType key; support anchoring after a given item ID (pass the preceding row's item ref as the anchor) to preserve position; and removal by item ID via `LSSharedFileListItemRemove`.

Both need `#pragma clang diagnostic ignored "-Wdeprecated-declarations"` and link `Foundation` + `CoreServices`.

### Experiment A — the wipe and the folder-icon correlation
1. Create two scratch folders. Put a sidebar row with a valid OSType code on each (codes `S000`/`S001` already exist in the user's helper bundle, or build your own declaring bundle).
2. Confirm both draw custom icons.
3. Copy a file into each **through Finder** (AppleScript `duplicate` works; a plain `cp` may not trigger the same Finder refresh — worth testing both, this distinction was never carefully isolated).
4. Give one folder a custom icon (`Icon\r` + `SetFile -a C`), copy again, compare.
5. Verify with `dump_favorites` that the property survives a wipe.

### Experiment B — the heal
After a wipe, re-insert the same URL with the same code anchored on the preceding row, and observe whether Finder repaints without a relaunch.

### Experiment C — the FinderSync test (CLAIM 4)
1. `gh release download v0.5.0 --repo ivg-design/SidebarFavorites --pattern '*.dmg'`, mount it, copy out `SidebarFavorites Manager.app/Contents/Resources/IconAppTemplate.app`.
2. Rewrite: host `CFBundleIdentifier`, `CFBundleIcons:CFBundlePrimaryIcon:CFBundleSymbolName` (pick a distinctive SF Symbol), appex `CFBundleIdentifier`, appex `SidebarFolderPaths[0]` = the volume path, and `Contents/PlugIns/IconAppSync.appex/Contents/Resources/FolderPath.txt` = the volume path.
3. Sign appex and host with a Developer ID identity (entitlements: `com.apple.security.app-sandbox` = false).
4. **The app must live somewhere PlugInKit accepts** — a path under `~/Library/Application Support/...` worked; a path in `/tmp` did NOT register.
5. `lsregister -f -R -trusted <app>`, then `open <app>` (launching the host is what registers the extension), then enable in System Settings → Login Items & Extensions if needed.
6. Note: `pluginkit -m -i <id>` reported "no matches" even while the extension was demonstrably working. Do not trust that CLI as evidence of absence.
7. Verify the icon appears on the volume's Favorites row, then copy a file to the volume and observe.

---

## Known errors made by the prior investigation

Understanding these may help you avoid them, and they are also reasons to distrust the rest:

1. **A false negative on volume rows.** An early test concluded volume rows ignore the override entirely. This was wrong: the test relaunched Finder before the property write had settled. Always verify with `dump_favorites` that the property is actually on the row *before* judging what Finder draws.
2. **A false attribution of an unclickable sidebar row.** Hours were spent believing the app or Finder had broken sidebar row hit-testing. The real cause was an unrelated app (Sip, a colour picker) leaving a stuck invisible 844×55 window over that screen region, swallowing clicks. Found by enumerating `CGWindowListCopyWindowInfo` at the click coordinates. **If any interaction anomaly appears, enumerate the window stack at those coordinates before blaming Finder.**
3. **Automation artifacts.** AppleScript `select` on a sidebar row does not navigate (use AXPress/`click`), and synthesized `CGEvent` clicks behaved unreliably. Screenshot-based verification was used throughout; be careful that a screenshot actually captured the Finder window and not another app.

---

## Where a solution might still be hiding

The prior investigation concluded "no workaround for volumes". Attack that. Specific unexplored or under-explored angles:

1. **Is the trigger really "content change"?** Never isolated: `cp` from the shell vs Finder-driven copy vs `touch` of the folder mtime vs an FSEvents notification with no actual change. If only *some* of these trigger it, the mechanism is narrower than claimed and may be avoidable.
2. **Does the wipe depend on the folder/volume being visible in an open window?** Partially tested and inconclusive. If a background window showing the folder is required, that reframes everything.
3. **Timing/ordering.** Does re-stamping the row immediately after each change stick, or does Finder win a race? Is there a debounce?
4. **Other row properties.** `SharedFileList` has other per-item keys seen in the binary: `ForceTemplateIcons`, `ItemIsManaged`, `ItemIsHidden`, and per-list keys like `FavoriteVolumes.ShowEjectableVolumes`. Does setting `ForceTemplateIcons` on a row change the arbitration? **This was never tested and looks promising** given the failure mode is "reverted to a template glyph".
5. **The FileProvider route.** Cloud providers (Google Drive, Dropbox) get branded, stable sidebar glyphs via a File Provider extension declaring `CFBundleSymbolName`. Could a local path or a mounted share be vended through an `NSFileProviderDomain` to get a stable glyph? Costs are real (the mount would relocate under `~/Library/CloudStorage`), but "stable under content change" was never tested for this route, and cloud rows visibly do NOT suffer the wipe.
6. **Is it really a regression?** The prior investigation compared 26.2 (no wipe observed) against 26.6 (wipe). Confirm on other builds if available. If it is a regression, an Apple Feedback report with the two-step repro is the correct path, and worth filing regardless.
7. **Sequoia/Tahoe-era third-party tools.** Are there current tools that successfully hold a custom icon on a drive's sidebar row? If any exists, its mechanism is the answer.

---

## Deliverable requested

For each claim: **confirmed / refuted / refined**, with the evidence you gathered (commands run, what you observed). Then:

- If you find a workaround for the volume case, describe it concretely enough to implement.
- If you confirm there is none, say so plainly, and draft the technical core of an Apple Feedback report (minimal repro, expected vs actual, affected APIs, build numbers).
- Flag any claim above that you believe is stated too strongly for the evidence behind it.

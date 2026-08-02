# SPEC — Dual-mode favorites (1.2.0), v2

**Status:** implemented in 1.2.0. This spec is the record of what was decided and why; the code is
`Services/FinderSyncAppGenerator.swift` plus the template sources in
`SidebarFavoritesManager/FinderSyncTemplate/`. Items in §6 (acceptance tests) remain open.
**Evidence convention:** claims tagged `[M#n]` cite `FINDERSYNC-CAPABILITY-MATRIX-26.6.md` result
rows, `[M§x]` its sections, `[IR§x]` `INVESTIGATION-RESULT-both-icons.md`. Untagged mechanism
claims are **assumptions** and say so. All evidence is macOS 26.6/25G72, Apple Silicon, one
machine — **Advanced mode is offered on macOS 26.x only** until measured elsewhere; the generator
stamps `LSMinimumSystemVersion` accordingly.

Two per-favorite modes:

| | **Regular** (default, unchanged) | **Advanced — "Both icons"** |
|---|---|---|
| Sidebar glyph via | `OverrideIcon.OSType` → helper-bundle UTI | Finder Sync helper (`SBF-<Name>-<id8>.app`) |
| Folder's own Get Info icon | must not exist (wipe) — app offers removal | untouched by monitoring (30 s A/B `[M#15]`; long-run guarded by §4.2 verify-and-restore) |
| Cost | none | ~6 MB memory `[M§4a]` + ~2.6 MB disk `[M§4b.5]` per favorite; one System Settings row each |
| Artwork | SF Symbol or custom SVG | same sources, same synthesis (§2) |

## 1. Flows (normative)

### 1.1 The three-way choice (add AND edit)
There is no separate add flow: add and edit share `AddEditFavoriteSheet`, and folder-icon
detection already runs there on `onChange(of: folderPath)` rendering the inline two-button
`ownIconWarning` block. **1.2.0 replaces that block with the three-way control**, reachable from
both add and edit:

1. `IconAuthority.detect(atPath:)` finds nothing → no extra UI; favorite is (or stays) Regular.
2. Icon detected → the choice:
   - **Keep both icons** → Advanced. The inline copy must disclose the cost where the choice is
     made, not a screen later: "adds helper SBF-<Name> to System Settings (~6 MB) — you currently
     have N". Advanced remains **opt-in**; if labeled "Recommended", the disclosure rides with it.
   - **Remove the folder icon** → Regular; backup first (§4.3). Removal executes **on Save, not on
     click** (today's `removeOwnIcon` destroys the icon immediately and Cancel does not undo —
     that behavior is a bug against "never destroy user data" and does not carry over).
   - **Leave as is** → Regular + derived `unstable` state (§5.1). Copy states the consequence
     plainly: "the sidebar icon will keep disappearing when this folder changes".
   - **Dismissed (Esc/close)** → add case: favorite is not added; edit case: no change. The dialog
     is always dismissable.
3. Volumes: same logic (`.VolumeIcon.icns` is the trigger). Shares: Advanced verified on one
   localhost SMB mount, Favorites row only `[M#3]`; the Locations row of a share is the *server*
   row and is not covered `[M§5]`. `locationsOnly` favorites may combine with Advanced; their
   Locations OSType mirror stays stamped as fallback.
4. `~/Library/CloudStorage` targets: Advanced **not offered** — *assumed* FinderSync-invisible
   (consistent with 0.x-era behavior noted in ARCHITECTURE.md) and *assumed* wipe-immune
   (measured only indirectly). Acceptance test before UI lock: point a probe appex at a
   CloudStorage root; hammer a CloudStorage favorite and observe the OSType glyph.

**Decision record — why the dialog offers Finder Sync rather than the WatchPaths repair agent
(`[IR§2①]` ranked repair first):** product direction chose per-favorite Finder Sync for 1.2.0
(true both-icons with no wiped-icon windows, no background process of ours at all); the repair
agent remains the roadmap answer for Locations volume rows and could later back the `unstable`
state. Repair-by-Refresh for `unstable` rows uses the measured ladder (re-stamp at ~0.3/1.2/3.0 s;
single re-stamps provably lose races `[IR§2①]`; settle ≥2 s after any icon mutation `[IR§3.7]`).

### 1.2 Converting an existing favorite (the mode control)
- Entry point: the mode chip on the list row opens the editor's mode section (the chip is the
  affordance; the row toggle remains sidebar-visibility, untouched).
- `mode` joins `FormSnapshot` (which also needs the missing `locationsOnly` — pre-existing bug:
  a `locationsOnly`-only change never enables Apply). Conversion runs on **Apply/Save**, not on
  radio click; Cancel with a generated-but-unsaved host must roll the generation back.
- **Regular → Advanced:** generate + enable (§3). OSType stays stamped — its verified role is the
  instant fallback `[M#9]`; (Open/Save-panel Favorites rows are decorated by the extension itself
  `[M#13]`; the panel's Locations volume row stays plain `[M#13]` and whether the OSType glyph
  fills that gap is untested). If a backup exists for this favorite, offer restore (§4.3).
  During the enable window the row shows a pending state (§3.5).
- **Advanced → Regular:** disable (`pluginkit -e ignore`) → `lsregister -u` → delete bundle. Row
  falls back instantly `[M#9]`. If the folder still carries its own icon, immediately re-present
  §1.1's choice minus the Advanced option. Failure path: if disable/unregister fails, keep the
  favorite listed with a "couldn't remove helper — retry" state; never orphan silently.
- Round-trip measured clean on a live favorite in both directions `[M§4b.3]`; idempotency and
  repeatability remain acceptance criteria with recorded before/after `pluginkit -m` output.

### 1.3 Removal, reset, and the Trash-delete reality
- Removing an Advanced favorite always runs the §1.2 removal sequence.
- The reset hook is `FavoriteSyncCoordinator.removeAllSidebarIcons()`: inside its existing
  teardown claim it must **demote every favorite to `.regular` before deleting `AdvancedApps/`**,
  or the next reconcile regenerates everything it just deleted. The Settings confirmation text
  gains a line enumerating helpers.
- **Most users uninstall by dragging the app to the Trash** — no code of ours runs. Therefore the
  orphan row must be self-explanatory: host and appex Info.plists carry a description string
  ("SidebarFavorites helper for '<Name>' — safe to disable or delete if SidebarFavorites is no
  longer installed"). No promises about PlugInKit GC timelines (none is documented; blank stale
  rows persist until the Settings pane relaunches at minimum `[M§4b.6]`). The app also shows an
  in-app aggregate list of installed helpers (§5.1) so Settings is never the only audit surface.

## 2. Artwork consistency (normative)

**Rule: same synthesis call, not "same file".** `Favorite.customSVGPath` is the RAW user SVG; the
Regular pipeline never hands it to `CoreThemeCatalogWriter` directly — it goes
`SymbolValidator.glyphGeometry(at:)` → `SymbolTemplateSynthesizer.synthesizeTemplate(from:symbolName:iconScale:)`
→ compiled catalog. The generator MUST run the identical chain into the host's `Resources/`,
passing **`CGFloat(favorite.effectiveIconScale)`** — `iconScale` is part of symbol identity in
Regular (keyed and digested), and omitting it makes a mode toggle visibly resize the glyph.
`CFBundleSymbolName` = whatever name that synthesis used. SF Symbols: the name goes into
`UTTypeSymbolName` / `CFBundleSymbolName` directly (scale collapses to 1.0).
*(Handing a raw user SVG straight to `CoreThemeCatalogWriter` works only for files that already
are SF-Symbol Template v7, which is why the prototype appeared to work — it used the repo's own
template icon. `FinderSyncAppGenerator` runs the full synthesis chain instead.)*

**Rendering equivalence is an acceptance test, not an assumption.** The two modes resolve through
different paths (Regular: LS binding with forced `'sbtp'` template variant `[IR§1.1, §3.2]`;
Advanced: containing-app-icon `[IR§1.4]`). Measured match so far: one monochrome glyph at default
scale `[M§4b.3]`. Acceptance: same artwork in both modes, light+dark, 1x/2x, monochrome + color +
non-default scale — mode toggle must produce no visible change, else the difference is documented
in the picker UI.

**Artwork edits must reach Advanced hosts.** The only artwork-change signal today is the shared
helper's global `BuildResult.contentChanged` — no per-favorite granularity, and a stale host would
keep showing the old icon *while outranking the fresh OSType glyph*. Persist a per-favorite
advanced-artwork digest (customSVGPath + effectiveIconScale + pipelineVersion, mirroring
`IconHelperBundle.digest`); reconcile regenerates + re-signs + re-registers any host whose digest
moved.

CTW contract: off-main with the main runloop alive; run inside the coordinator's existing
`enqueue` chain; compile artwork **before** signing; `xattr -c` resources copied from the app
bundle `[M§4b.1]`.

## 3. Generator requirements

1. **Identity ≠ display.** On-disk name and both bundle IDs key on `favorite.id`:
   `SBF-<Name>-<id8>.app`, `com.ivg-design.SidebarFavorites.adv.<uuid>[.Sync]`. Display
   (`CFBundleName`/`CFBundleDisplayName`) is `SBF-<Name>` — the System Settings row shows that
   name + the app icon `[M§4b.1]`. Rationale: `Favorite.name` is pinned to the folder's leaf name
   and is NOT unique — name-keyed bundles collide (`~/a/src` + `~/b/src`) and a second add would
   destroy the first. Folder rename/move regenerates display fields in place (no orphan).
2. Host: `LSBackgroundOnly`, auto-exits ~8 s after launch (glyphs persist `[M§4a]`);
   `CFBundleIconFile = AppIcon` (does not interfere with the sidebar symbol `[M§4b.2]`; ship a
   slimmed icns — the full one is ~2.45 MB of the 2.6 MB bundle `[M§4b.5]`).
3. Appex: `app-sandbox = true` (mandatory `[M§3]`) + `files.user-selected.read-only` + a
   **per-root read-only exception scoped to this favorite's path only** — verified sufficient
   `[M§4b.4]`; never the blanket `/` exception. Hardened runtime; ad-hoc on user machines (omit
   `--timestamp` when ad-hoc `[M§4a]`).
4. `CodeSigner` grows a second entry point (entitlements URL + hardened-runtime flag, signs appex
   then host); the existing bare `signBundle` stays for the passive helper bundle. `resolve()`
   invariants and keychain timeout unchanged.
5. Enablement: launch host once → poll *registration* (`pluginkit -m -i`, budget ~10 s; failure =
   lsregister/launch problem) → `pluginkit -e use` → verify enabled state (separate small budget;
   failure = show pending row state + System Settings deep link — mock both states before UI
   lock). No Settings trip in the verified path, including ad-hoc `[M#14, M§4a]`.
6. Remount healing: re-assert `directoryURLs` (`[]` then real set) on mount/unmount/rename at
   ~0.4/1.5/3.0 s `[M#11]` — verified on one local volume with the appex resident; the appex also
   re-asserts in `init` (covers relaunch-after-mount). SMB survived remount without healing
   `[M#3]`. Appex-terminated-during-mount is untested; acceptance test it.
7. One host+appex per favorite (appex-level `CFBundleIcons` ignored `[M§4a]`). Verified to 14
   concurrent extensions, no ceiling *observed* `[M§4a]` — the budget is shared with third-party
   FinderSync extensions; surface cumulative cost (n × ~6 MB) and warn past ~10 Advanced favorites.
8. Generator owns its own root resolver + screener pinned to
   `SidebarFavorites/AdvancedApps` with prefix `com.ivg-design.SidebarFavorites.adv.` (the
   MigrationService deleter is hard-pinned to legacy `Apps/` and must not be reused; its
   "only surviving pluginkit call" comment gets corrected). `ConfigManager` gains
   `advancedAppsDirectoryURL` (not auto-created).

## 4. Edge rules

1. **Fresh-folder rule** `[M§4a]`: measured points — decorate at <~10 s after folder creation →
   clobbered at ≈T+10 s; decorate at ≥30 s → holds. The 10–30 s band is untested, so the guard is
   30 s. Scope: every path that *applies a folder icon* — i.e. `IconAuthority.restore` (§4.3) —
   refuse/delay under 30 s, verify ~20 s after applying, re-apply once. (Regular-mode OSType
   stamping writes a row property, not a folder icon — out of scope.)
2. **Advanced targets get a per-reconcile icon check**: verify `kHasCustomIcon` still set on the
   target; if missing, surface "folder icon disappeared — restore from backup?" (the long-run
   loss `[M§5]` predated the fresh-folder diagnosis but the guard costs one xattr read).
   `SidebarReconciler.reportOwnIcons` must **skip `mode == .advanced` rows** — its current advice
   ("Remove Its Icon to fix it permanently") would destroy exactly what Advanced preserves.
   The derived `unstable` chip replaces that banner for Regular rows (one surface, not two).
3. **IconAuthority grows restore** (new work, not existing): `restore(from:to:)` copies the
   backup back AND sets `kHasCustomIcon`; backup location moves onto `ConfigManager`; the
   favorite persists `iconBackupPath` at removal time (leaf-name+timestamp alone is ambiguous
   across favorites sharing a leaf name).
4. Advanced rows keep OSType stamping and name pinning. Repainting under a live extension is
   *assumed* harmless but unmeasured — normative: skip repaint for Advanced rows unless the
   OSType property is actually missing (covers the Finder re-insert deletion hazard `[IR§3.5]`).
5. **Reboot**: expected PlugInKit relaunch, unverified (standing dogfood). Decision: accept
   degradation-to-OSType-glyph until the manager's next launch, whose reconcile re-launches hosts
   once if needed; no LaunchAgent. If dogfood shows glyphs return on their own, delete this rule.

## 5. Model / integration map

1. `Favorite.mode` (`.regular`/`.advanced`): **optional key via `decodeIfPresent`, default
   `.regular`, `Config.currentVersion` STAYS at 3** — the `iconScale` precedent; a version bump
   re-arms the 1.0 migration consent flow and blocks every mutating entry point behind a sheet.
   `unstable` is **derived** (`mode == .regular && detect() != nil`), computed by the reconcile
   and published alongside `boundItems` — not stored. Also persisted: `iconBackupPath` (§4.3),
   advanced-artwork digest (§2).
2. `FinderSyncAppGenerator` (new): template binaries built by the app target, embedded in
   Resources; clone → rewrite plists → `Roots.txt` → synthesize+compile artwork (§2) → sign
   (§3.3–4) → `lsregister` → launch host → enable → verify → report. Runs inside the coordinator's
   `enqueue` chain.
3. `SidebarReconciler` is a private enum inside `FavoriteSyncCoordinator.swift` — the Advanced
   branches (skip-repaint, skip-reportOwnIcons, icon check, digest check) land there, not in an
   injectable seam.
4. UI: mode chip (clickable, opens editor mode section) with `SIDEBAR ONLY` / `BOTH ICONS` /
   `UNSTABLE` states; editor mode section with pending + failed-enable states; three-way dialog
   (dismissable); helpers aggregate list in Settings (name, target, enabled state, memory total,
   "remove all"). Mockup: `docs/mockups/dual-mode-ui.html` (to be extended with the UNSTABLE row,
   pending/fallback states, and Settings-count disclosure).

## 6. Acceptance tests before UI lock

Rendering equivalence matrix (§2); CloudStorage probes (§1.1.4); appex-dead remount (§3.6);
narrow-entitlement regression on a clean machine (§3.3); reboot dogfood (§4.5); repaint-under-
extension (§4.4); Settings-row description strings render for orphaned helpers (§1.3).

## 7. Out of scope for 1.2.0

Locations-row branding for share *servers*; WatchPaths repair agent (roadmap; would back
`unstable` rows and Locations volumes); auto-conversion suggestions; Apple Feedback filing
(offsets in `INVESTIGATION-RESULT-both-icons.md` §1/§4.5).

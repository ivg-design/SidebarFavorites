# Investigation result: custom folder icon + stable custom sidebar icon

**Date:** 2026-08-01 (drag-and-drop findings added same day). **Platform:** macOS 26.6 (25G72),
Apple Silicon, live-tested. **Answers:** `docs/INVESTIGATION-BRIEF-both-icons.md`.

**Verdict: both icons can coexist, but no zero-cost route survives the full requirement set.**
With drag-and-drop onto the row treated as mandatory (it is), the row must keep targeting the real
folder — and then the only mechanisms that keep a sidebar glyph on a `kHasCustomIcon` folder are
**(a) event-triggered repair** (recommended: launchd `WatchPaths`, no resident process) or **(b) a
Finder Sync extension** (works, heavy costs). The elegant symlink-indirection route defeats the
wipe completely but is **disqualified: Finder's sidebar drop validation refuses symlink- and
alias-targeted rows** (verified today with synthesized drags against a passing direct-row control).

---

## 1. The mechanism of the wipe (disassembly, 26.6/25G72)

Static analysis of `DesktopServicesPriv` (unstripped), `SharedFileList`, and Finder, plus live
probes, give the full causal chain:

1. `OverrideIcon.OSType` is consumed **once, at list-build time**:
   `+[SFLList copyBindingFromItem:]` → `UTType typeWithTag:tagClass:HFSTypeCode` →
   `_LSBindingCreateWithUTI` → IconRef, materialized into the row's node model
   (`TFileListItem::fSidebarIconRef`, node Property `'sbic'`). Nothing re-reads the SFL property at
   draw time — which is why the property always survives while the pixels die.
2. A metadata change on the row's target re-snapshots its `TFSInfo`.
   `TFSInfo::SynchronizeIcons` (0x186442f2c) compares old/new; the fresh `TFileListItem` is
   constructed with `fSidebarIconRef == NULL`, so old-non-null vs new-null marks `'sbic'` dirty →
   `handleItemsChanged:` → `reloadDataForRowIndexes:` → the row icon is recomputed from a node
   model that no longer holds the override.
3. `TFSInfo::HasCustomIcon()` (0x1862ce948) is **literally FinderInfo flags bit 10 (0x0400,
   `kHasCustomIcon`), read live**. It gates a forced synchronous re-rasterization inside
   `CopyIconRefForSizes`; any nil/failure lands in `CopyGenericIconRef` → `'fldr'` — the generic
   folder glyph users see. A `HasCustomIcon()` change between snapshots also forces `'icon'` dirty
   even when the icons compare equal.
4. Finder Sync icons live in a different universe: `TFENode::SidebarImage` is a draw-time
   chain-of-responsibility whose final step asks `TPlugInManager sidebarIconForFolder:`, which
   matches the node against each extension host's registered roots and returns the host's cached
   `_containingAppIcon`. It never touches TFSInfo, FinderInfo, or the SFL item — structurally
   immune, and it *outranks* the row override for its monitored roots.

**Live probe matrix (all this machine, today):**

| Probe | Configuration | Hammering | Result |
|---|---|---|---|
| B0 | plain folder, direct row | touch + writes | override survives |
| B1 | classic Get Info icon (`Icon\r`+RF+flag) | touch | **wiped** |
| B2 | flag OFF, `Icon\r` left in place | — | state not holdable: Finder deletes the orphan `Icon\r` within seconds |
| B3 | flag ON, ResourceFork stripped | touch | **wiped** (artwork irrelevant) |
| B4 | flag ON, **no `Icon\r` at all** | touch | **wiped — the FinderInfo bit alone is the entire trigger** |
| B5 | Tahoe `com.apple.icon.folder#S` xattr, flag OFF | touch + writes | survives, but folder renders **no** customization |
| B5c | same xattr, flag ON (star renders) | touch | **wiped** — the new mechanism requires the triggering bit |
| B7 | classic icon on folder, **row → symlink** | touch ×2, writes, `touch -h` link, Finder relaunch | glyph + folder icon + **Dock icon** all survive; row still targets the symlink |
| DnD-ctrl | direct plain-folder row | synthesized drag | **drop accepted** (blue highlight, file moved) |
| DnD-link | symlink row (B7 config) | same rig | **drop refused** — no highlight, file bounced |
| DnD-alias | Finder alias row | same rig | **drop refused** — identical signature |

Notes: `Icon\r`'s data fork is *always* zero-length (artwork lives in its `com.apple.ResourceFork`
xattr); the meaningful axes are the FinderInfo bit and the ResourceFork, and only the bit matters.
`TargetIsDirectory` is nil on all rows including working ones — not the drop discriminator; the
sidebar's drop validation resolves the row's own node and refuses non-containers, with no
SFL-property override.

## 2. The routes, ranked against the constraints

### ① Recommended: opt-in event-triggered repair via launchd `WatchPaths` (Lead D, refined)

The row keeps targeting the real folder → DnD, click, Get Info, green-dot all untouched; the folder
keeps its full Get Info icon (arbitrary artwork; Desktop/windows/**Dock** — Dock verified today);
the app re-stamps the row after churn.

- **No resident process.** launchd (kernel kqueue) does the watching; a short-lived helper wakes on
  changes to *only* the both-icons folders, runs the measured re-stamp ladder (~0.3 s / 1.2 s /
  3.0 s after last event — single debounced repairs provably lose the race), and exits (~3 s
  lifetime per burst). This honors the spirit of the 1.0 "nothing runs in the background" promise;
  ship it opt-in per favorite ("Keep both icons — repairs automatically after changes").
- Repair primitives already exist and are verified: Favorites = anchored in-place upsert
  (`SFLBridge upsertURL:…`); Locations = same-value `setOSType:forVolumePath:`. Measured 15–17 ms,
  no visible flicker; bulk copies coalesce to ~2 repairs.
- Also the **only** route that covers Locations (`FavoriteVolumes`) rows for volumes with
  `.VolumeIcon.icns`, and it is artwork-agnostic (custom SVG favorites keep working).
- Cost: brief wiped-icon windows during sustained churn (launchd `ThrottleInterval` ≈ 10 s
  coalescing); a LaunchAgent to install/uninstall cleanly.

### ② Works, documented as alternative: Finder Sync per-favorite extension (Lead A)

> **Superseded 2026-08-01 (later sessions):** the hard limits below were re-measured and several
> fell — custom SVG artwork works (host asset catalog via CoreThemeCatalogWriter), System Settings
> enablement is not required (`pluginkit -e use`), remount is healable without relaunch, and
> Finder relaunch restores both sections. See `FINDERSYNC-CAPABILITY-MATRIX-26.6.md` (rows
> #4/#11/#12/#14, §4a, §4b) and `SPEC-dual-mode-1.2.0.md`. 1.2.0 direction: dual-mode with
> per-favorite Finder Sync (decision record in the spec §1.1).

Confirmed live (folder case in the parallel session today; volume case in
`docs/CAPABILITY-MATRIX-sidebar-icons.md`): a sandboxed (`app-sandbox = true`) appex whose host
declares `CFBundleIcons → CFBundlePrimaryIcon → CFBundleSymbolName` decorates its monitored roots'
rows, survives the wipe on folders with full Get Info icons, and DnD is unaffected (the row is the
untouched real folder). The complete v0.5 generator (templates, plists, signing, `lsregister`,
launch flow) is recoverable from git `5bf39ad`.

Hard limits: **one glyph per extension** (icon keyed on extension identity;
`FIFinderSyncController` is badges-only — no per-directory icon API, confirmed in headers + .tbd +
bridgesupport), SF Symbol only (no custom SVG artwork; smuggling artwork into the signed host via
Get Info metadata breaks its codesign seal — tested in the parallel session), System Settings
enablement per extension (the 0.x era's #1 support complaint: issues #1/#2/#9/#13), icon lost on
unmount, Locations rows don't self-heal on relaunch, and it *overrides* the app's own OSType glyphs
on monitored roots.

### ③ Disqualified for general use: symlink/alias indirection (B7)

Completely defeats the wipe (mechanism-clean: the wipe keys on the row's *own target*, and a
symlink can never carry `kHasCustomIcon`), survives Finder relaunch with no bookmark re-resolution,
folder icon intact everywhere including Dock, helper-bundle UTIs draw fine, click-through navigation
lands in the real folder — **but Finder refuses drops on the row** (no highlight; validated against
a passing control; alias files identically refused; no SFL property flips it). Keep only as a
clearly-labeled niche option for navigation-only rows, if at all.

### ④ Dead ends, proven dead

- **No hidden SFL lever exists.** Complete cstring enumeration of SharedFileList + sharedfilelistd:
  exactly one `OverrideIcon.*` key in the entire dyld shared cache; no preserve/sticky/no-update
  key; `ItemIsPersistent/Locked/Managed` have zero readers; `ForceTemplateIcons=NO` cannot stick on
  FavoriteItems (SIP-protected `ListConfigurations/*.plist` re-applies `YES` on every read);
  `kLSSharedFileListItemBinding` is exported but dormant (zero references).
- **Lead C (FileProvider domain over an arbitrary folder): impossible.** All three
  `NSFileProviderDomain` initializers relocate storage; `importDomain:fromDirectoryAtURL:` *moves
  the directory away*. No per-domain sidebar-icon API exists in the SDK.
- **Tahoe's native folder customization** (`com.apple.icon.folder#S`) requires `kHasCustomIcon` to
  render → inherits the wipe; per Oakley it doesn't show in Dock/sidebar anyway.
- `SpecialItemIdentifier` short-circuits all derivation (nine fixed Apple glyphs, immune, read
  before everything else in `copyBindingFromItem:`) but hijacks row semantics and allows no custom
  artwork — curiosity only.

## 3. Corrections to the brief (§2), earned today

1. §2.2 — the folder-side trigger is **exactly the `kHasCustomIcon` FinderInfo bit** (B3/B4);
   `Icon\r` presence and artwork are irrelevant.
2. §2.2 — "Finder redraws from the target's own icon" is imprecise: the resync *drops* the
   materialized override, and the custom-icon path's forced re-rasterization falls back to the
   generic `'fldr'` glyph (sidebar bindings are template-variant `'sbtp'`, so the color icon could
   never appear there).
3. §2.3 — the anchored upsert preserves **position but not the item ID** (IDs changed on every
   upsert today). Build nothing on "durable item ID".
4. §2.4 — the "v0.5 recipe signs with `app-sandbox = false`" narrative mischaracterizes the source:
   only the archived *template file* has `false`; `IconAppGenerator.signAppBundle(at:)` always wrote
   fresh entitlements with `app-sandbox = true`. The false negative applies to hand-built bundles
   from the raw template.
5. New hazard, distinct from the wipe: `itemByInsertingAfterItem:` builds row properties **from
   scratch** — a Finder-side remove+re-insert (drag-reorder) can silently *delete* the OSType
   property. The reconcile pass should treat "property missing" as expected drift.
6. Retraction from this investigation's own first draft: "drag-drop onto the row uses standard
   symlink semantics" was wrong — the sidebar's validation refuses indirection rows outright.
7. Method notes: after mutating a folder's icon state, Finder's pending re-derivation tramples
   repair upserts issued within ~2 s (settle → verify pre-state visually → trigger). "Flag off with
   `Icon\r` intact" is not a holdable state — Finder garbage-collects the orphan file.

## 4. Suggested implementation plan (1.2.0)

1. Opt-in **"Keep both icons"** per favorite: restore/keep the folder icon (`IconAuthority` backup
   already exists), mark the favorite as guarded, install a per-user LaunchAgent with `WatchPaths`
   = the guarded folders; the helper binary re-stamps guarded rows with the 0.3/1.2/3.0 s ladder
   and exits. Uninstall the agent when the last guarded favorite is removed.
2. Keep "Remove folder icon (with backup)" as the default suggestion; surface "Keep both" beside it.
3. Reconcile pass: treat missing OSType property as drift (re-stamp), covering the drag-reorder
   deletion hazard.
4. Soak before release: reboot; sustained-churn windows (launchd throttle); Locations volume rows;
   TM/iCloud interaction with guarded folders.
5. File the Feedback: the regression is `TFSInfo::SynchronizeIcons`' old-non-null → new-null
   `'sbic'` drop plus `HasCustomIcon()` dirty-forcing — cite `DesktopServicesPriv` 0x186442f2c /
   0x18644306c–0x186443080 (26.6/25G72). No public radar exists for this; it would be the first.

## 5. Evidence provenance

- Live probes (B-series, symlink/alias DnD with control, Dock verification): this session,
  2026-08-01. Tools recreatable: `dump_favorites.m`, `insert_test.m`, `seticon.m`, plus a CGEvent
  drag rig using Accessibility row positions.
- Finder Sync folder-case proof + host-icon-smuggling refutation: parallel session, same day.
- Disassembly: `ipsw`-extracted arm64e images (DesktopServicesPriv unstripped — 17k symbols);
  session scratchpad `disasm-finder/`, `disasm-sfl/`.
- Ecosystem: Apple DTS threads 690333/768453 (FinderSync sidebar folklore, FB16023451), Hazel 6.1
  release notes + Noodlesoft forums, BTT + Adobe CC Tahoe icon-hijack threads, eclecticlight.co on
  Tahoe folder customization, `grimace` source for `com.apple.icon.folder#S`+`kHasCustomIcon`
  co-writing. No other productive user of `OverrideIcon.OSType` exists in the public GitHub corpus.

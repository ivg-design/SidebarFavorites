# Finder Sync advanced mode — measured capability matrix (macOS 26.6 / 25G72)

**Date:** 2026-08-01. All rows below were measured live on this machine with purpose-built probe
extensions (Developer ID signed, `app-sandbox = true`, hardened runtime, **not notarized**), a real
APFS disk image carrying `.VolumeIcon.icns`, and a **real SMB mount** served by a user-space Samba
on port 4445 and mounted through macOS's own NetFS (`mount volume smb://…`), i.e. the same client
path a user's NAS takes.

**Headline: advanced mode is viable, and it answers the drives/shares question — yes.**
A Finder Sync extension decorates folder rows, local-volume rows (Favorites **and** Locations), and
SMB share rows, on targets that carry their own custom icon, and drag-and-drop keeps working on all
of them. Custom SVG artwork works. The one real fragility (remount) has a fix that was verified.

---

## 1. Results

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Folder with Get Info icon | **Works** | star glyph on row; folder's orange icon simultaneously visible in window; survived `touch -m` + 40 writes |
| 2 | Local volume with `.VolumeIcon.icns` | **Works, both sections** | decorated in Favorites *and* Locations; survived touch + 60 writes |
| 3 | **SMB share** (`/Volumes/SBFSHARE`) | **Works** (Favorites row) | decorated; survived touch + 60 writes; survived unmount/remount |
| 4 | Custom SVG artwork (not just SF Symbols) | **Works** | repo's `sidebar-github.rectangle.fixed.svg` → `.symbolset` → `actool` → host `Assets.car`; `CFBundleSymbolName = custom.sbfprobe.mark` rendered the octocat |
| 5 | Per-favorite icons | **Works — one extension per favorite** | two extensions coexisted, different glyphs on their own roots, no interference |
| 6 | Drag-and-drop onto decorated rows | **Works on all four** | synthesized drags landed files in folder, disk, share, custom-symbol folder; correct move-vs-copy semantics |
| 7 | Icon "bleed" to child folders | **No bleed** | a row for a *child* of a monitored root kept its own OSType glyph; only exact roots decorate |
| 8 | Precedence vs `OverrideIcon.OSType` | **FinderSync wins while it has a claim** | rows carried `sbED` yet drew the extension's glyph |
| 9 | Fallback when extension disabled | **OSType glyph returns instantly** | `pluginkit -e ignore` → every row reverted to its OSType glyph, no Finder relaunch |
| 10 | Unmount / remount of a volume | **Icon lost** — but healable (see §2) | after remount the row fell back to its OSType glyph |
| 11 | Remount healing without Finder relaunch | **Works with the toggle fix** | extension observes `NSWorkspace.didMount/didUnmount/didRenameVolume`, then sets `directoryURLs = []` **and then** the real set; verified over two clean detach/attach cycles with an unchanged extension PID |
| 12 | Finder relaunch after remount | **Restores both sections** | corrects the earlier "only Favorites recovers" note |
| 13 | Open/Save panel sidebars | **Decorated** (Favorites rows, incl. custom symbol) | NSOpenPanel screenshot; the panel's *Locations* volume row stayed plain |
| 14 | System Settings enablement required? | **No** — `pluginkit -e use -i <id>` sufficed | extension registered on host launch and ran; **no notarization needed** for local install either |
| 15 | Does monitoring strip the folder's own icon? | **No** | monitored vs unmonitored control both held `kHasCustomIcon` over 30 s |

## 2. The remount fix (essential for drives)

Setting the *same* `directoryURLs` set after a mount is a no-op — Finder does not re-register. Clearing
first forces re-registration:

```swift
// on NSWorkspace.didMountNotification / didUnmountNotification / didRenameVolumeNotification
FIFinderSyncController.default().directoryURLs = []
FIFinderSyncController.default().directoryURLs = Set(roots)
```

Re-applied at ~0.4 s / 1.5 s / 3.0 s after the event (the mount needs to settle). With this, a
detach→attach cycle re-decorated both the Favorites and Locations rows with no Finder relaunch and
no extension restart.

## 3. Build recipe that worked (no Xcode project)

- Host app: `LSBackgroundOnly`, `CFBundleIcons → CFBundlePrimaryIcon → CFBundleSymbolName`.
  Custom art: `<symbol>.symbolset` (SF Symbol template SVG) → `xcrun actool --compile` →
  `Contents/Resources/Assets.car`. *(The shipping app can use its existing `CoreThemeCatalogWriter`
  instead of `actool` — same output, no Xcode dependency; not re-verified in this pass.)*
- Extension: `swiftc … -framework FinderSync -Xlinker -e -Xlinker _NSExtensionMain`;
  `NSExtensionPointIdentifier = com.apple.FinderSync`, principal class `<Module>.FinderSyncExt`;
  roots read from its own `Contents/Resources`.
- Signing: `codesign --force --timestamp --options runtime --sign "Developer ID Application: …"
  --entitlements <ent>` on the **appex first**, then the app. Entitlements: `app-sandbox = true`
  (mandatory — PlugInKit silently refuses otherwise), plus read access for the monitored roots.
- Registration: launch the host once (`open -g`), then `pluginkit -e use -i <extension-bundle-id>`.
- Install location: `~/Library/Application Support/…` (accepted by PlugInKit).

## 4. Recommended dual-mode design

**Regular mode** (unchanged): `OverrideIcon.OSType` + helper-bundle UTIs. One icon, no extensions,
nothing in the background. Folders carrying a Get Info icon still get the wipe → keep the existing
"remove the folder icon (with backup)" offer.

**Advanced mode** (opt-in, per favorite): generate one host+appex per favorite carrying that
favorite's artwork as a custom symbol. Gets: both icons at once, drives and shares included, DnD
intact, and Open/Save panels decorated.

Design rules the measurements imply:
1. **Always keep the OSType override stamped as well.** It is the automatic fallback whenever the
   extension is disabled, not yet enabled, being rebuilt, or its volume is mid-remount — verified to
   reassert instantly with no relaunch. The two mechanisms compose cleanly.
2. **Ship the toggle-on-mount re-registration** (§2), or drives will silently lose their glyph on
   every unplug.
3. **One extension per favorite** — the icon is keyed to the extension's containing app. Warn about
   process count if a user marks many favorites as advanced.
4. Advanced rows do not need the WatchPaths repair agent; regular-mode rows on icon-bearing folders
   still do (or the icon-removal offer).

## 4a. Pre-build gauntlet results (same day, later session)

| Question | Answer |
|---|---|
| **Ad-hoc-signed appex** (the real user-machine path — generated locally, no certificate) | **Works end-to-end**: registered, enabled via `pluginkit -e use`, ran, decorated its row. `--timestamp` must be omitted for ad-hoc signing; `app-sandbox = true` still required. |
| **Notarization of the swiftc-built bundle shape** | Passes (`mac-notarize --app`), staples, Gatekeeper accepts. |
| **Quarantined + App-Translocated launch** (fresh download simulation from ~/Downloads) | **Works**: host ran translocated, PlugInKit registered the *real* path, extension enabled, ran (translocated), decorated. No Gatekeeper dialog blocked the LSBackgroundOnly host. |
| **Scale: 14 concurrent extensions** (12 numbered + 2 others) | All decorate, zero misses, no PlugInKit ceiling observed. |
| **Memory cost** | **~6 MB physical footprint per appex** (vmmap; the Activity-Monitor-style number: private dirty + compressed). `ps` RSS reads ~31 MB but that double-counts shared dyld-cache framework pages — do not quote RSS. **Hosts can be quit after registration — all glyphs persist** → steady-state ≈ 6 MB per advanced favorite, compressible when idle. Generator hosts should auto-exit. |
| **Appex-level `CFBundleIcons`** (would allow one shared host) | **Ignored** — the glyph comes from the containing app bundle only. One host+appex per favorite is confirmed as the required architecture. |
| **`CoreThemeCatalogWriter` parity** (no Xcode/actool) | **Works**: the app's own engine compiled the custom-symbol SVG to an `Assets.car` byte-size-identical to actool's; dropped into the host it rendered on the row. Must run off the main thread **with the main runloop alive** (blocking main deadlocks the engine). |
| **Icon-loss anomaly** | **Solved — a timing rule, unrelated to Finder Sync.** A folder decorated within ~10 s of its creation has its FinderInfo + `Icon\r` silently clobbered by an unidentified post-creation sweep at ≈ T+10 s (reproduced deterministically; watcher log). The same folder decorated ≥ 30 s after creation holds. Affects plain SidebarFavorites too. **Mitigation for any icon-restoring code: verify ~20 s after applying, re-apply once; avoid decorating just-created folders immediately.** Culprit process not identifiable without root (`fs_usage`); nothing surfaced in the unified log. |

## 4b. Addendum — later same-day measurements (prototype + dogfood session)

Recorded here so the 1.2.0 spec can cite them; screenshots in the session scratchpad.

1. **System Settings identity (hard requirement): verified.** Generated bundles named
   `SBF-<Name>` (`CFBundleName` + `CFBundleDisplayName`) carrying the app's `AppIcon.icns`
   (`CFBundleIconFile`) appear in Login Items & Extensions as `SBF-DeltaAdv` / `SBF-EpsilonAdv` /
   `SBF-github`, each with the app icon, subtitle "File Provider". Before the fix, rows showed
   blank generic icons and bare names. The repo's `AppIcon.icns` needs `xattr -c` after copying —
   codesign rejects its resource-fork/FinderInfo metadata as "detritus".
2. **`CFBundleIconFile` does not interfere with the sidebar symbol** — with both keys present the
   sidebar still draws the `CFBundleSymbolName` glyphs (seal, custom octocat) while
   Settings/Get Info use the app icon. (Consistent with the disassembly: the sidebar path resolves
   `CFBundleIcons → CFBundlePrimaryIcon → CFBundleSymbolName` via IconServices.)
3. **Mode round-trip on a live favorite (github): both directions clean.** Advanced → Regular:
   helper removed, row fell back to the S000 octocat immediately. Regular → Advanced: helper
   re-added; with the row's OSType temporarily set to `sbTM`, the row still drew the extension's
   octocat (precedence re-confirmed), then S000 restored. Same-frame comparison of a Regular-mode
   octocat (github/S000) beside an Advanced-mode octocat (epsilon/CFBundleSymbolName): visually
   identical — **but this is one monochrome glyph at default icon scale**; the two modes resolve
   through different paths (LS binding `'sbtp'` template variant vs. containing-app-icon), so
   color/hierarchical artwork and non-default `iconScale` need an explicit acceptance comparison.
4. **Narrow sandbox entitlement suffices.** Replacing the probe-era blanket
   `temporary-exception.files.absolute-path.read-only = ["/"]` with a single per-root path entry:
   the appex still registers, enables (`pluginkit -e use`), runs, and decorates. All three live
   helpers now carry per-root-only exceptions. The blanket exception was never necessary.
5. **Disk cost:** ~2.5–2.6 MB per generated helper, of which ~2.45 MB is the copied `AppIcon.icns`;
   a slimmed icns variant for helpers would cut per-favorite disk cost ~10×.
6. **Stale-registration hygiene:** deleted helpers can linger in the Settings pane as blank rows
   until the pane relaunches / PlugInKit GCs (no documented timeline). Removal must
   `pluginkit -e ignore` + `lsregister -u` before deleting the bundle; the pane's list is cached
   per launch of System Settings.

## 5. Caveats and untested items

- **Not tested: reboot**, login/logout, and multi-day soak. Two probes (Delta = ad-hoc SF symbol on
  `~/Desktop/SBF-G/delta`; Epsilon = ad-hoc + CoreThemeCatalogWriter custom octocat on
  `~/Desktop/SBF-G/epsilon`, both folders carrying Get Info icons, rows `sbED`-stamped) are left
  installed and enabled for the reboot check: after restarting, both rows should draw their
  extension glyphs with no host launch; if they instead show the external-disk OSType glyph, PlugInKit
  did not relaunch the appexes and advanced mode needs a login-time registration nudge.
- Artwork must be compiled into the host **before** signing (mutating a signed host's resources
  breaks its seal — parallel session result). The gauntlet's re-sign-after-swap worked because the
  bundle was re-signed ad-hoc afterwards, which is exactly what the generator will do.
- The Locations row for an SMB mount is the *server* row (`127.0.0.1` here); the share itself
  decorates as a Favorites row. A NAS user pinning the server row would not get a custom glyph.
- The Open/Save panel's Locations volume row stayed undecorated while Finder's showed the glyph.
- Icon "bleed" onto sibling/parent rows was not observed, but a monitored root that is itself a
  *parent* of another favorite was not exhaustively tested.
- One anomaly, unexplained and worth watching: both monitored folders lost their `Icon\r` +
  `kHasCustomIcon` at some point during the long test sequence. A controlled 30 s retest (monitored
  vs unmonitored control) showed **no** stripping, so monitoring is not the cause; the trigger is
  unidentified. Advanced mode should verify the folder icon on each sync and offer to restore from
  the existing `IconAuthority` backup if it goes missing.

## 6. Reproduction assets (session scratchpad)

`probe/build.sh <instance> <symbol> [--custom-symbol <svg>] [--active] <roots…>` builds, signs, and
installs a probe; `probe/src/{host,sync}.swift` are the sources. The synthetic SMB server config is
`/tmp/sbfsmb/smb.conf` (Homebrew samba, `samba-dot-org-smbd -s <conf> -D`, user `ivg`, share
`SBFSHARE` on port 4445). Screenshots: `shot-BOTH-FINAL.png` (both icons at once), `shot-fs-*.png`
(matrix steps), `shot-panel3.png` (Open panel), `shot-dnd-fs-*.png` (drag hovers).

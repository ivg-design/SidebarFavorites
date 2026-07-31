# Capability matrix: custom icons on Finder sidebar rows

**System under test:** macOS 26.6 (build 25G72), Apple M3 Ultra, Xcode installed.
**Date:** 2026-07-29. All results are from live experiments on this machine, each verified
by screenshot, not by API return codes.

Evidence images: `docs/images/capability-matrix/`.
Working CLI: `sfl` (source archived at the end of this document).

---

## Bottom line

Three findings overturn the previous two investigations.

1. **Volumes are not inherently doomed.** The wipe class is not "all mounted volumes". It is
   "any target that carries its own on-disk icon authority" — the `kHasCustomIcon` FinderInfo
   bit, backed by `Icon\r` on a folder or `.VolumeIcon.icns` at a volume root. A mounted volume
   *without* a custom volume icon holds its sidebar override indefinitely, through `touch -m`,
   through hundreds of file copies, through a 3 GB write, through Finder-driven copies, and
   through unmount/remount. `/Volumes/WORK2TBSSD` wipes only because it has carried a
   `.VolumeIcon.icns` since 2021. **Deleting the volume's custom icon is a real cure**, exactly
   as it is for folders.

2. **A no-background-process solution for volumes exists and works.** A Finder Sync extension
   whose containing app declares `CFBundleIcons → CFBundlePrimaryIcon → CFBundleSymbolName`
   puts a custom glyph on a mounted volume's row in **both Favorites and Locations**, with no
   SharedFileList property on the row at all, and **it is completely immune to the wipe** —
   it survived `touch -m` plus 200 file writes on a volume that *did* carry a custom volume icon.
   The previous investigation concluded the opposite because its extension **never loaded**:
   the recipe signs the appex with `com.apple.security.app-sandbox = false`, and PlugInKit
   refuses to register an unsandboxed Finder Sync extension. With `app-sandbox = true` it
   registers immediately.

3. **Apple's documented "classic iconset" route is dead.** `CFBundleIconFile` pointing at a
   loose `.iconset` folder, at an `iconutil`-generated `.icns`, or at a hand-built `.icns`
   containing Apple's own sidebar element types (`icsb`/`icsB`/`sb24`/`SB24`) all produce the
   generic-application placeholder on the row. Finder's sidebar code path is alive and is
   actively looking for the containing app's icon — it simply no longer honours the legacy
   `CFBundleIconFile` form. Only `CFBundleSymbolName` works.

Two smaller corrections: same-value `LSSharedFileListItemSetProperty` **does** repaint a
Favorites row (3/3 reproductions), contradicting the prior report; and clearing a property with
`kCFNull` leaves **no `NSNull` tombstone** and does not change the item ID.

---

## CAN / CANNOT matrix

| Target | Can take an override? | Persists through metadata change? | What heals it | Cost |
|---|---|---|---|---|
| **Plain local folder** (no `Icon\r`) | Yes — Favorites | **Yes, immune** | n/a | None. This is the shipping case and it is sound. |
| **Folder with a custom icon** (`Icon\r` + `kHasCustomIcon`) | Yes — Favorites | **No** — any mtime change wipes the drawing; the property survives | same-value `setProperty` **or** anchored in-place upsert; both immediate, no Finder restart | Cure: delete `Icon\r`, `SetFile -a c`. Costs the folder's Get Info icon. |
| **External / local volume, no `.VolumeIcon.icns`** | Yes — Favorites **and** Locations | **Yes, immune** (verified under 300 files + 60 MB, 3 GB write, Finder copy, unmount/remount) | n/a | None. |
| **External / local volume with `.VolumeIcon.icns`** | Yes — both lists | **No** — root mtime change wipes both rows independently | same-value `setProperty` per row (Favorites and Locations are separate rows and must both be restamped) | Cure: delete `.VolumeIcon.icns` + `SetFile -a c` on the volume root. Costs the Desktop/window volume icon. |
| **Boot volume (`Macintosh HD`)** | **Yes** — Locations row accepts an override | Yes (it has no custom volume icon) | n/a | None. Not previously known to be possible. |
| **Network share** (WebDAV tested; row synthesised in Favorites) | Yes — Favorites | **Yes, immune** (31 writes into the share root) | n/a | The Locations "connected server" row is **not** in `FavoriteVolumes` and cannot be targeted. |
| **Locations rows generally** (`FavoriteVolumes`) | Yes, for rows with no `SpecialItemIdentifier` | Same rules as the underlying volume | same-value `setProperty` only — **never** `InsertItemURL` (it duplicates the row) | System-owned list. Row vanishes from the snapshot while unmounted but the record and override survive remount with the same item ID. |
| **Special rows** — iCloud Drive, Computer, AirDrop/MeetingRoom, Google Drive (FileProvider), Home | **No.** The property is stored (`noErr`) and is readable back, but Finder never draws it | n/a | n/a | Confirmed by the disassembly: `copyBindingFromItem:` branches on `SpecialItemIdentifier` before reading the override. |
| **Connected-server row in Locations** | **No** — synthesised by Finder from the mount table, not backed by an SFL row | n/a | n/a | — |
| **Finder Sync route (any target it monitors)** | Yes, via host `CFBundleSymbolName` — decorates **both** the Favorites and Locations rows | **Yes, immune even on wipe-class volumes** | n/a while mounted | Requires a signed+sandboxed, notarised app extension the user must enable; icon is lost on unmount and only the Favorites row recovers after a Finder relaunch. |

---

## Per-experiment evidence

### Baseline

`sfl dump` of both lists before any change is archived as
`BASELINE-favorites.txt` / `BASELINE-volumes.txt` in the scratch directory. Nine Favorites rows,
seven `FavoriteVolumes` rows. Both lists carry `com.apple.LSSharedFileList.ForceTemplateIcons = 1`
at the **list** level.

The starting visual state (`01-baseline.png`) already shows the phenomenon: the Favorites
`WORK2TBSSD` row stores `S003` but draws the generic external-disk glyph.

### A1 — external drive in Favorites

```
sfl add    fav /Volumes/SBFTEST  SBFTEST     S003
sfl upsert fav /Volumes/WORK2TBSSD WORK2TBSSD S003
```

Both rows immediately drew `briefcase.fill` (`02-favorites-override-applied.png`). The upsert
preserved item ID `667613435` and position `[8]`; note that the `LSSharedFileListItemRef`
returned by `InsertItemURL` reports a **transient** ID (`508389655`) that differs from the
persistent ID in the next snapshot — do not treat the returned ID as the row identity.

### A2 — the same drives in Locations (`FavoriteVolumes`)

```
sfl setcode vol 2179885432 S003     # WORK2TBSSD  -> briefcase.fill (helper-declared)
sfl setcode vol 4005801364 sbTM     # SBFTEST     -> Time Machine clock (Apple stock, no helper)
```

Both drew (`03-locations-override-applied.png`). Note SBFTEST simultaneously drew `briefcase.fill`
in Favorites and the clock in Locations, proving the two rows are fully independent.

**Cleanup procedure for Locations (important):**
- `LSSharedFileListItemSetProperty(item, key, kCFNull)` removes the property cleanly.
  After the write, `CopyProperty` returns `NULL` — **there is no `NSNull` tombstone**, contrary to
  the prior report — and the item ID is unchanged. Verified on five special rows plus
  `Macintosh HD` and `WORK2TBSSD`.
- Do **not** use `LSSharedFileListInsertItemURL` against `FavoriteVolumes`; it appends a duplicate
  row rather than de-duplicating by URL.

### The wipe, and the finding that reframes it

`touch -m` applied to both volumes in the same second:

```
touch -m /Volumes/SBFTEST ; touch -m /Volumes/WORK2TBSSD
```

Result (`04-wipe-workssd-only.png`): **WORK2TBSSD wiped in both sections; SBFTEST wiped in neither.**
Both properties remained on their rows. `stat` confirmed both mtimes advanced to the same second,
so the trigger landed on both.

The difference:

```
/Volumes/WORK2TBSSD : .VolumeIcon.icns present, GetFileInfo -a = avbstClinmedz   (uppercase C)
/Volumes/SBFTEST    : no .VolumeIcon.icns,      GetFileInfo -a = avbstclinmedz   (lowercase c)
```

Bidirectional confirmation on the disposable volume:

| State of `/Volumes/SBFTEST` | `touch -m` result |
|---|---|
| No volume icon | Override **survives** |
| `.VolumeIcon.icns` + `SetFile -a C` | Override **wiped** (`07-sbftest-with-volicon-wiped.png`) |
| Icon removed + `SetFile -a c` | Override **survives** again (`08-sbftest-icon-removed-immune.png`) |

So the model is unified across folders and volumes:

> Finder invalidates and re-resolves the target's *native* icon binding on a target metadata
> notification. For a target that has native icon authority (`kHasCustomIcon`), that binding wins
> over the stored row override until the sidebar item binding is rebuilt. Targets with no icon
> authority have nothing to re-resolve to, so the override stands.

Robustness of the immune case (`09-immune-under-stress-copy.png`): 300 × 32 KB files plus a 60 MB
file written into the volume root and subdirectories, plus a Finder-driven `duplicate`, left both
SBFTEST rows drawing correctly.

### The heal — prior claim refuted

The prior report's central negative control was that same-value `setProperty` returns `noErr` but
does not repaint a Favorites row. **This does not reproduce.** Three consecutive
wipe → `setcode` → screenshot cycles all healed immediately with no Finder restart
(`05-wiped.png`, `06-healed-by-setproperty.png`).

Both heal mechanisms work on Favorites:
- `LSSharedFileListItemSetProperty` with the same value — cheapest, preserves everything.
- Anchored in-place `LSSharedFileListInsertItemURL` — also works, also preserves ID and position.

On `FavoriteVolumes`, only `setProperty` is safe (see A2 cleanup above).

### A3 — network share

SMB could not be used: macOS guest SMB is effectively disabled on this machine (`smbutil view -N
//guest@localhost` exposes only `IPC$`) and creating a share point needs root. A local Apache
`mod_dav` server on port 8099 was mounted instead, giving a genuine network volume at
`/Volumes/localhost` (`mount ... (webdav, nodev, noexec, nosuid, mounted by ivg)`).

- Favorites row accepts an override and draws it (`10-network-share-override.png`, `S002` =
  `newspaper.fill`, chosen because the default network glyph and `sbNw` are indistinguishable).
- **Immune to the wipe**: 31 files written into the share root left it drawing.
- The share root reports `avbstclinmedz` — no icon authority, consistent with the model.
- **Display name is ignored**: the row was stored as `SBFDAV` and `dump` reports `SBFDAV`, but
  Finder draws `localhost`, the real volume name.
- **Unmount:** the Favorites row survives with the same item ID (`399740165`) and the same
  override, and *keeps drawing the custom glyph while unmounted*. `CopyResolvedURL` with
  `kLSSharedFileListDoNotMountVolumes` returns `NULL`, i.e. `(unresolved)`.
- **Remount:** unchanged, still drawing.
- The share's row in **Locations** is synthesised by Finder from the mount table; it is not present
  in `FavoriteVolumes` and therefore cannot be given an override.

Volume unmount/remount was also tested on the disk-image volume: the Favorites row keeps ID and
code; the `FavoriteVolumes` row **disappears from the snapshot** while unmounted but returns on
remount with the **same item ID (`4005801364`) and the same override**, drawing correctly.

### A6 — special rows

`S002` was written to every special row. All writes returned `noErr` and all were readable back,
and **none of them drew** (`11-special-rows-ignore-override.png`):

| Row | `SpecialItemIdentifier` | Override honoured |
|---|---|---|
| iCloud Drive | `…IsICloudDrive` | No |
| Google Drive | `FileProvider` | No |
| IVG's Mac Studio | `…IsComputer` | No |
| AirDrop | `…IsMeetingRoom` | No |
| `ivg` (Home, in Favorites) | `…IsHome` | No |
| **Macintosh HD** | *(none)* | **Yes** — drew `newspaper.fill` |

The discriminator is exactly the presence of `SpecialItemIdentifier`, not the row's section and not
whether the target is a volume. The boot volume taking an override was not previously known.

### A7 — icon flavour makes no difference

On a wipe-class volume, Favorites carried `S001` (a custom SVG symbol compiled into the helper's
`Assets.car`) and Locations carried `sbTM` (an Apple stock code that needs no helper bundle at all).
A single `touch -m` wiped **both** (`18-a7-custom-svg-wiped.png`). Custom SVG symbols, stock SF
Symbols, and Apple's own `sb**` codes are treated identically. The wipe happens at the binding
layer, upstream of artwork resolution.

### A8 — other levers (all negative)

The complete per-item/per-list key set was extracted from the dyld shared cache
(71 `com.apple.LSSharedFileList.*` strings; archived as `sfl-keys.txt`). The plausible arbitration
levers were set on a wipe-class Favorites row and the wipe was re-run:

| Lever | Stored? | Prevented the wipe? |
|---|---|---|
| `TargetIsVolume = false` | yes | No |
| `TargetIsDirectory = true` | yes | No |
| `ForceTemplateIcons = true` (per **item**) | yes | No |
| `ItemIsLocked = true` | yes | No |
| Override set on **both** lists simultaneously | yes | No — each row wipes independently |
| Re-stamping twice back to back | — | No effect beyond one stamp |

`ForceTemplateIcons` is read from the owning **list**, not the row, and both lists already have it
set to `1`. It is not a lever.

Other keys that exist but are not useful here: `Binding`, `ItemIsManaged`, `ItemIsPersistent`,
`ItemAddedViaAPI`, `VolumeRefNum`, `TopSidebarSection`, and the `FavoriteVolumes.Show*` visibility
switches. Separate lists exist for `FavoriteServers`, `RecentServers`, `AutomountedServers` and
`NetworkBrowser` — none of them backs the connected-server row observed in Locations.

---

## Verdict on A4 — the Finder Sync route

**A no-background-process solution for volumes exists.** It is not the route Apple documents.

### Why the previous test was a false negative

The brief's recipe signs both bundles with `com.apple.security.app-sandbox = false`. With that
entitlement the extension **never registers**: `pluginkit -m -p com.apple.FinderSync` does not list
it, no appex process is ever spawned, and no icon appears. Every working Finder Sync extension on
this machine is sandboxed. Changing the entitlement to

```xml
<key>com.apple.security.app-sandbox</key><true/>
<key>com.apple.security.files.user-selected.read-only</key><true/>
```

made it register on the first attempt. This means the prior investigation's CLAIM 4 evidence —
"the old Finder Sync mechanism also wipes" — was almost certainly produced by an extension that
was not running.

Two further blockers found along the way, both real:
- The bundle must pass Gatekeeper. Unnotarised Developer ID bundles are `rejected` by `spctl`.
  Signing with `--options runtime --timestamp` and notarising (`xcrun notarytool submit
  --keychain-profile notary`) fixes it. *(Notarisation alone was not sufficient — the sandbox
  entitlement was the decisive change.)*
- `pluginkit` is not always a liar, but LaunchServices is the better oracle:
  `lsregister -dump | grep -A40 <appex path>` showed the extension registered under
  `plugin id: FinderSync` long before `pluginkit` acknowledged it.
- The v0.5 template reads its monitored root from a **single line** of
  `Contents/Resources/FolderPath.txt` (`FIFinderSyncController.default().directoryURLs = [url]`);
  the `SidebarFolderPaths` key in the appex `Info.plist` is inert metadata written by the manager
  app. Writing two paths into `FolderPath.txt` silently breaks the extension.

### The documented classic-iconset route does **not** work

Tested, in order, with `CFBundleIcons` removed so nothing else could win:

| Form supplied for `CFBundleIconFile = "SidebarGlyph"` | Result on the row |
|---|---|
| Loose `SidebarGlyph.iconset/` with `sidebar_16x16`, `sidebar_18x18`, `sidebar_32x32` (+`@2x`) black-on-transparent template PNGs, exactly as Apple documents | generic-app placeholder |
| `SidebarGlyph.icns` produced by `iconutil -c icns` from that iconset (`iconutil` does accept the `sidebar_*` names) | generic-app placeholder |
| Hand-built `SidebarGlyph.icns` containing Apple's own sidebar element types `icsb`/`icsB`/`sb24`/`SB24` alongside `ic04`/`ic05`/`ic11`/`ic12` | generic-app placeholder |

`13-findersync-iconfile-placeholder.png` shows the placeholder. It is not a rendering failure of the
artwork: `NSWorkspace iconForFile:` on the same app returns the correct star, so `CFBundleIconFile`
resolves fine for the app icon. Finder's sidebar path simply falls back to the generic application
icon. The archived Apple guide describes behaviour that no longer exists on 26.6.

### The route that does work

Host `Info.plist`:

```xml
<key>CFBundleIcons</key>
<dict><key>CFBundlePrimaryIcon</key>
  <dict><key>CFBundleSymbolName</key><string>star.circle.fill</string></dict>
</dict>
```

Results on a mounted volume that **does** carry `.VolumeIcon.icns` + `kHasCustomIcon`, with **no
`OverrideIcon.OSType` on any row**:

- The glyph appears on the volume's row in **Favorites and in Locations**
  (`14-findersync-volume-both-sections.png`).
- `touch -m /Volumes/SBFTEST` → **no wipe**.
- 200 further file writes plus another `touch -m` → **no wipe**
  (`15-findersync-survives-wipe.png`).

This is the first mechanism found that is stable on a wipe-class volume with no running repair
process.

### Limits of the Finder Sync route

- **Unmount/remount loses it** (`16-findersync-lost-after-remount.png`). Restarting the appex alone
  does not restore it. A Finder relaunch restores the **Favorites** row only; the Locations row
  stays generic until something rebuilds it. A shipping implementation must observe
  `NSWorkspace.didMountNotification` and re-assign `directoryURLs`.
- One extension instance per monitored root as the template is written (single path in
  `FolderPath.txt`); `directoryURLs` accepts an array, so one extension could cover many roots,
  but that changes the v0.5 per-favorite-app architecture.
- Requires a **sandboxed, notarised** app extension that the user must enable in
  System Settings → General → Login Items & Extensions. That is a materially heavier install than
  writing a property.
- SF Symbol only. There is no working file-based artwork route, so custom SVG artwork would have to
  be registered as a symbol some other way.

---

## Verdict on A5 — event-driven repair

**Viable, but only with a retry ladder. A single debounced repair is not sufficient.**

Prototype: `sfl watchrepair <path> <code>` — an FSEvents stream on the volume root
(`kFSEventStreamCreateFlagFileEvents | NoDefer | WatchRoot`, latency 0.05 s) with a 250 ms
trailing debounce that then does a Favorites anchored upsert plus a `FavoriteVolumes`
`setProperty`.

Measured behaviour on a wipe-class volume:

| Load | Events | Repairs fired | Icon stability |
|---|---|---|---|
| 400 × 64 KB files + 3 GB single file into subdirectories | 404 | 2 | **Never visibly dropped** across 5 samples during and after the copy |
| `touch -m` on the volume root every 0.15 s for 15 s | ~100 | 1 | **Wiped for the whole burst**; recovered ~3 s after the burst ended |
| `touch -m` on the volume root every 2 s for 12 s | 6 | 6 | **Wiped**, and stayed wiped indefinitely afterwards |

Cost per repair is negligible: 15–17 ms.

Findings:

- **Bulk file copying is not actually the threat.** Writing files *inside* a volume rarely touches
  the volume root's mtime, so few wipes fire and the debounce absorbs the rest. The icon was rock
  steady through a 3 GB write.
- **The threat is root-metadata churn.** Anything that repeatedly touches the monitored root's
  mtime starves a trailing debounce, and the icon simply stays wiped for the duration.
- **The single-shot repair loses races and never notices.** In the 2 s-interval run all six repairs
  fired and returned `noErr`, yet the row was still wiped 20 s later with no events pending
  (`17-a5-repair-lost-race.png`). Finder's re-resolve can land *after* a repair issued 250 ms behind
  the triggering event, and nothing re-triggers.
- **A retry ladder fixes it.** Re-stamping at ~0.3 s, ~1.2 s and ~3.0 s after the event held the
  icon reliably in direct testing. A production implementation should use that ladder — or better,
  read the row back and re-stamp until the drawing is confirmed, though note that reading the
  property back is *not* a proof of drawing, so the ladder is the pragmatic answer.
- Repairs are silent: no flicker was observed in any screenshot, and Finder never needed a restart.

**Recommendation:** ship event-driven repair only as a fallback for volumes the user refuses to
strip the custom icon from. The primary advice should be the cure (remove `.VolumeIcon.icns`), which
is free, permanent, and needs no running process. Rate-limit repairs and never restart Finder.

---

## Practical guidance for the app

1. **Detect icon authority and say so.** `GetFileInfo -a` uppercase `C` / `kHasCustomIcon`, or
   `.VolumeIcon.icns` at a volume root, is a perfect predictor of whether a row will wipe. Surface
   it in the UI as "this favorite's icon will not stick because the folder/drive has its own custom
   icon", with a one-click "remove it" cure. This applies to volumes as much as folders — which was
   previously believed impossible.
2. **Make Refresh actually repair.** Force a re-stamp on every bound row rather than skipping rows
   whose recorded code already matches. Either `setProperty` with the same value or the anchored
   upsert works on Favorites; on `FavoriteVolumes` use `setProperty` only.
3. **Treat Favorites and Locations as two independent rows** for the same volume. Both need their
   own stamp and their own repair.
4. **Never `InsertItemURL` into `FavoriteVolumes`** — it duplicates. Use `setProperty`, and clear
   with `kCFNull` (which is clean: no tombstone, no ID change).
5. **Skip rows with `SpecialItemIdentifier`.** Writing to them succeeds and does nothing.
6. **Rebind volume rows by resolved URL after mount events**, not by cached item ID for Favorites
   (the ID is stable, but the ref returned by `InsertItemURL` is not the persistent ID).

---

## What remains unknown or untested

- **SMB and AFP shares specifically.** The network-share results are from a WebDAV mount. Guest SMB
  is disabled on this machine and creating a share point requires root. An SMB mount root can carry
  a server-provided volume icon, which would put it in the wipe class; that was not tested.
- **Whether a network share can be given icon authority at all**, and therefore whether it can be
  made to wipe.
- **Time Machine volumes.** `TMSSD` was never modified.
- **Optical / removable media**, and `sbRm` / `sbOD` / `sbIn` / `sbED` beyond confirming `sbTM` and
  `sbNw` draw.
- **Whether this is a regression.** No other macOS build was available; the 26.2-vs-26.6 comparison
  in the brief was not re-testable here.
- **The Finder Sync route across logout/reboot**, and its behaviour with many monitored roots in one
  extension.
- **Whether an asset-catalog `AppIcon` (rather than `CFBundleIconFile`) would revive a file-based
  Finder Sync sidebar icon.** Not tested; would need `actool`.
- **`_UTTypeTemplateIconFile`** was not re-tested; the prior negative stands unreproduced.
- **The File Provider route** (`NSFileProviderDomain`) was not attempted.
- **Long-duration soak.** The longest observation window was a few minutes. Behaviour over hours,
  across sleep, and across logout is unknown.
- **Concurrency caveat.** Another agent was mutating the same SharedFileList lists during part of
  this session (a row `sbf-xcode-free-proof` / code `SZZ9` appeared and later vanished). It did not
  touch any target used here, and every conclusion above rests on a directly observed screenshot,
  but it is recorded for completeness.

---

## Cleanup record

- Favorites list is **byte-identical to the pre-experiment baseline** (`diff` of the row dumps is
  empty): same nine rows, same IDs, same order, same codes.
- `FavoriteVolumes` matches baseline: the `WORK2TBSSD` override written during A2 was cleared with
  `kCFNull` and the property is absent again; item ID `2179885432` unchanged; no `NSNull` tombstone;
  no duplicate rows. The disposable `SBFTEST` row disappeared with its volume.
- The user's three real favorites (`github`/`S000`, `23-03-P_Motion Graphics`/`S001`,
  `Projects`/`S002`) were never modified.
- `/Volumes/WORK2TBSSD` — only its root mtime was advanced (by `touch -m`, the wipe trigger). Its
  `.VolumeIcon.icns` and FinderInfo flags are untouched. No file inside it was created, modified or
  deleted.
- Removed: the disposable disk image and its mount, the WebDAV server and its mount, `~/sbf-exp-*`,
  `/Applications/SBFA4.app`, `/Applications/SBFPristine.app`, the extracted `IconAppTemplate.app`,
  and the mounted v0.5.0 DMG. The Finder Sync extension was disabled (`pluginkit -e ignore`),
  removed, and unregistered from LaunchServices.
- **Residue:** the `WORK2TBSSD` Favorites row now *draws* its stored `S003` briefcase, whereas at
  baseline it was in the wiped state and drew the generic glyph. The stored data is identical; only
  the rendering differs, and it now matches what the user configured. Any future metadata change on
  that drive will return it to the baseline appearance. `19-final-restored.png` is the final state.
- Two notarisation submissions were made to Apple under the existing `notary` keychain profile
  (submission IDs `7f07a4c2-…` and `c936c9d6-…`), both for the throwaway test app.

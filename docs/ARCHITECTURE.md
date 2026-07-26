# Architecture

How SidebarFavorites 1.0 puts a custom icon on a Finder sidebar row. Written for contributors; the [README](../README.md) covers the same ground in one paragraph for users.

## The mechanism

Finder's Favorites list is an `LSSharedFileList` (`kLSSharedFileListFavoriteItems`). Each row can carry a private property:

```
com.apple.LSSharedFileList.OverrideIcon.OSType   ->   a four-character code, e.g. "S003"
```

Finder resolves that code to an icon through Launch Services: it looks for a declared UTI tagged with `com.apple.ostype` = that code, and draws the icon that UTI declares. So the app needs two things per favorite:

1. the property set on the row, and
2. *some* registered bundle declaring a UTI for that code.

Both are cheap, and neither involves running code. There is exactly one such bundle for all favorites.

### Why this replaced Finder Sync

Up to 0.5.0 each favorite got its own generated `.app` embedding a `com.apple.FinderSync` extension, whose `CFBundleSymbolName` supplied the icon. That approach had four structural problems, all of which this one simply does not have:

- **FileProvider paths were invisible to it.** `~/Library/CloudStorage` and iCloud Drive are virtual mounts; a Finder Sync extension cannot claim them, so cloud folders could never get an icon. Launch Services icon resolution does not care what the path is.
- **The user had to enable each extension by hand**, and they frequently failed to appear - or appeared mislabelled as "File Provider" - especially under ad-hoc signing.
- **Every favorite meant a process**, plus a signed bundle carrying real executable code.
- **The user had to drag the folder into the sidebar themselves.** The app now writes the row.

## OSType allocation

`OSTypeAllocator` mints the codes.

- Shape: `S` + three characters from a 32-character alphabet (`0-9A-Z` minus `I`, `L`, `O`, `U`, which are ambiguous when read aloud). Capacity 32,768; allocation takes the lowest free index, so codes stay dense and debuggable (`S000`, `S001`, …).
- **Codes are case-sensitive on both sides.** `BLT1` resolves to a declared UTI while `blt1`, `BLt1` and `bLt1` each produce a *distinct dynamic* UTI. Nothing in the pipeline normalizes case; the uppercase `S` prefix also keeps our codes clear of Apple's own (`macs`, `fldr`, `trsh`, `sbHm`, …), which are lowercase or lower-camel.
- Before a code is handed out, `UTType(tag:tagClass:conformingTo:)` probes whether anyone *else* already declares it. Our own helper's declarations are excluded by UTI prefix, which is what makes the probe idempotent across runs.
- A code is allocated once per favorite and stored in `config.json` as `osType`. It never changes afterwards - which is why changing a favorite's *artwork* is invisible to the row and has to be detected some other way (see [Finder restart policy](#finder-restart-policy)).

## The helper bundle

`IconHelperBundle` builds and registers `~/Library/Application Support/SidebarFavorites/SidebarFavoritesIcons.app`.

```
SidebarFavoritesIcons.app/
  Contents/
    Info.plist                       one UTExportedTypeDeclarations entry per enabled favorite
    MacOS/SidebarFavoritesIcons      17 bytes: #!/bin/sh\nexit 0\n
    Resources/
      Assets.car                     compiled custom symbols (absent when none are used)
      HelperIcon.icns                the bundle's own icon (inert for icon resolution)
```

One declaration looks like this:

```xml
<dict>
  <key>UTTypeIdentifier</key>       <string>com.ivg-design.SidebarFavorites.icon.s003</string>
  <key>UTTypeDescription</key>      <string>Projects sidebar icon</string>
  <key>UTTypeConformsTo</key>       <array><string>public.folder</string></array>
  <key>UTTypeTagSpecification</key> <dict>
    <key>com.apple.ostype</key>     <array><string>S003</string></array>
  </dict>
  <key>UTTypeIcons</key>            <dict>
    <key>UTTypeSymbolName</key>     <string>hammer.fill</string>
  </dict>
</dict>
```

Load-bearing details, each established by measurement:

- **The nested `UTTypeIcons` dictionary is required.** Top-level icon keys are ignored for sidebar rows.
- **`UTTypeSymbolName` is the only key in it.** Up to 1.0 each symbol also shipped a rasterized `.icns` referenced by `UTTypeIconFile`/`_UTTypeTemplateIconFile`. Those render as a plain folder on their own *and* take precedence over the vector symbol until Finder re-reads its registrations - so a new icon appeared as an opaque black silhouette until restart. They are no longer shipped, and a rebuild deletes any left behind by an older version.
- **`UTTypeConformsTo` is `public.folder`, not `public.data`**, so a row whose icon fails to resolve falls back to a folder rather than a blank page.
- **The OSType tag is written verbatim**; the UTI identifier is lowercased because Launch Services lowercases identifiers on ingest anyway.
- **A custom symbol that failed to compile gets no `UTTypeIcons` key at all.** Naming a symbol that is not in `Assets.car` points Launch Services at nothing; dropping the key lets the `public.folder` conformance supply an icon, and the failure is surfaced as a warning.
- `CFBundleVersion` carries a monotonic *generation* counter, bumped on every rebuild so Launch Services never serves a cached record. `CFBundlePackageType` is `APPL`, and `CFBundleExecutable` must point at something executable for the bundle to register cleanly - hence the no-op script.
- **Signing is best-effort.** An unsigned helper registers and renders icons correctly, so a `codesign` failure is a warning. **`lsregister -f -R -trusted` is the one step that must succeed**: without it nothing resolves and every managed row loses its icon.

### The digest short-circuit

Rebuilding means writing a plist, running `actool`, `codesign` and `lsregister`. On a normal launch nothing has changed and all of that must cost nothing.

`IconHelperBundle.digest(for:)` takes SHA-256 over the canonical declaration payload - sorted by OSType, so reordering favorites alone never triggers a rebuild - prefixed by a **pipeline version** constant. When the digest matches `config.helperDigest` and the bundle is still on disk, the whole chain is skipped.

The pipeline version exists because the digest describes *declarations*, not the code that turns them into artwork. Bump it whenever the way artwork is produced changes, or an upgrade will keep serving a bundle built by the previous pipeline. It is currently `3`:

1. up to 1.0 - raw SVGs copied into symbolsets, asset names read from `descriptive-name`;
2. templates synthesized from parsed geometry, asset names in the `custom.` namespace;
3. artwork fitted to the cap band rather than a cap-height square, no `.icns` fallback art, bundle carries its own icon and description.

The per-favorite size correction is appended to the payload **only when it differs from 100%**, so a config in which nothing was rescaled hashes to exactly what it hashed to before that field existed - which is what makes adding the slider a no-op for existing users.

## Sidebar rows

`SFLBridge.m` is the only code in the project that touches `LSSharedFileList`; `SidebarItemManager` is the Swift facade, and serializes every mutation under a lock.

Two behaviours the rest of the design rests on, both measured:

- **The list de-duplicates by URL.** Inserting a URL that is already present is an in-place upsert: the row keeps its position and its persistent item ID while its display name and icon override are updated. A second `upsert` for the same folder therefore cannot produce a duplicate row.
- **`LSSharedFileListItemGetID` is stable across processes and across in-place updates**, which is what makes it usable as the persisted binding key in `config.json`.

Two API sharp edges: passing `NULL` to `LSSharedFileListItemSetProperty` crashes, so clearing an override goes through the upsert's `propertiesToClear`; and that call rewrites the label, so the row's *current* name has to be passed back in or it resets to the folder's file-system name.

### Ownership: managed vs adopted

Each favorite records a `sidebarProvenance`:

- `.managed` - **this app inserted this row.** It may be renamed, and it may be deleted.
- `.adopted` - the row was already there. Only the icon override is ever written; the name and position are untouched, and removal restores the icon rather than deleting the row.
- `.unbound` - no row.

**The app must never rename or delete a row the user created.** That is not assumed, it is proved inductively, and both halves live in `SidebarReconciler`:

- *Base case*: `.managed` is written after an insert **only when the resulting item ID was not in the list a moment before**. If it was, the list de-duplicated and our write landed on the user's existing row - so the row is adopted instead, and its original label is put back.
- *Inductive step*: `.managed` is carried forward only onto a row whose ID the persisted binding already names. A `.managed` favorite that matches some *other* row - because macOS pruned ours while a volume was away, or the user removed it and dragged the folder back in - drops to the adopt path.
- Deletion additionally re-reads the row from the live list and re-checks that it still resolves to a path this favorite claims.
- Clearing an override only happens for codes shaped like ours (`OSTypeAllocator.isWellFormed`); an override somebody else set is left alone.

Path matching is deliberately fuzzy in one direction: a bookmark can resolve through a different but equivalent spelling of the same directory (`/private/tmp/…` vs `/tmp/…`), and 0.5.0 users were told to point favorites at symlinks into `~/Library/CloudStorage`, so `SidebarItem.matches(anyOf:)` compares standardized and symlink-resolved forms.

## The SVG pipeline

Four types, one direction:

```
user's .svg
   -> SVGGeometryParser      parse to one flattened CGPath in SVG (y-down) space
   -> SymbolValidator        decide usable / not, and collect advisory warnings
   -> SymbolTemplateSynthesizer   wrap the path in an SF Symbols template
   -> SymbolCatalogBuilder   actool -> Assets.car inside the helper bundle
```

**`SVGGeometryParser`** handles the full path command set including elliptical arcs, the basic shapes, nested groups with composed transforms, the `<style>` cascade, `<use>`/`<defs>`, and converts strokes to filled outlines. It returns a single path with `fillRule == .winding`, having already made two corrections: even-odd artwork is rewound (the symbol rasterizer ignores `fill-rule` and would fill holes solid), and every shape's outer contour is wound the same way (an SVG paints elements one at a time, a glyph is one path - without this, two overlapping shapes drawn in opposite directions cancel and punch a hole that is not in the source). Measured against AppKit's own SVG rasterizer it matches the source silhouette to an IoU of 0.999+.

**`SymbolValidator`** is the single front door. It fails an import only for: unreadable file, not an SVG, malformed XML, no drawable geometry, or degenerate geometry. Everything else is a warning - dropped raster, un-outlined live text, gradients and multiple paints flattening to one silhouette, extreme aspect ratio, and a measured legibility verdict (`sparse` / `dense` / `busy`) obtained by rasterizing the silhouette at 16 px and looking at ink coverage and the share of partly-lit pixels.

`glyphGeometry(at:)` is the one place a *stored* icon file becomes geometry, used by the import preview, the row thumbnails, the menu bar icons and the compiler alike - so the preview cannot show something the compiled symbol will not draw. It also detects an SVG that is *already* an SF Symbols template (every custom icon stored by 0.5.0) and lifts its `Regular-S` glyph out first; parsed whole, a template is an artboard of guides, three weight columns and a version marker, which would union into a striped rectangle.

**`SymbolTemplateSynthesizer`** emits the scaffold `actool` insists on. Each requirement below was established by ablation - 30+ variants compiled, each one proven by removing it and watching the compile fail:

- `<text id="template-version">` containing exactly `Template v.7.0`. Anything else falls back to the legacy 9-glyph format and fails with *"must have a glyph for Regular weight Medium size"*.
- `<g id="Symbols">` holding **all three** of `Ultralight-S`, `Regular-S`, `Black-S`. Any two alone fail.
- Six horizontal guides: `Baseline-S/M/L` and `Capline-S/M/L`. The M and L *glyphs* are unnecessary; the M and L *guides* are not.
- Margin guides - interpolatable left/right margins on all three weights.

Everything Apple's own export carries beyond that (the `#artboard` rect, H-reference glyphs, weight-column labels, `viewBox`) is omitted. The `<style>` block is worse than optional: `SFSymbolsPreviewWireframe` perturbs the compiled glyph's bounding box.

### Sizing

Artwork is fitted to the **cap band**: height drives the scale, so a mark fills the `Baseline-S`→`Capline-S` band (70.459 template units) with the same 1.25× overshoot system symbols use, and is scaled down further only to respect a 2.5-cap-height width ceiling. Height-first is what makes an imported icon sit at the same optical size as an SF Symbol beside it; the earlier cap-height *square* fit left wide artwork far too small because width became the binding constraint.

`Favorite.iconScale` (0.5…1.5, default 1.0) multiplies the height term **and only the height term** - scaling the width ceiling with it would let the one guard here be switched off from the UI.

`glyphMetrics(forArtworkBox:iconScale:)` is the shared definition of where the ink sits inside the compiled symbol image, and both `emitTemplate` and the preview renderer call it. They must never restate it independently: the preview drifting from the compiled glyph is exactly what makes a size control useless, and it is how an earlier build compiled a 6:1 wordmark at 69% ink while previewing it at 17%.

Symbols are named per **(stored file, scale)**, not per file: two favorites pointing at the same SVG at the same size share one symbolset, but at different sizes they must not. Names are assigned over the *sorted* distinct keys so that reordering favorites cannot swap two rows' icons at the next rebuild. Names are folded into the `custom.` namespace (`My Logo.svg` → `custom.my.logo`), which nothing in Apple's catalog can collide with, and the runtime name of a symbol is its `.symbolset` **directory** name - not the file name, and not `descriptive-name`.

**Compilation is failure-tolerant by design.** One unusable icon must not cost every other favorite its artwork: a failed batch `actool` run is retried symbol-by-symbol into a scratch directory and the survivors are shipped, and the catalog is only swapped into the bundle on success. Missing `actool` (no Xcode, no Command Line Tools) degrades to a warning and the folder-icon fallback rather than aborting the build.

## Reconcile

`FavoriteSyncCoordinator` is the only service the UI talks to. Everything that can change what the user sees - the helper bundle and the sidebar rows - funnels through one private `reconcile` pass, coalesced over a 400 ms window, so an edit that changes a favorite's name, icon and folder at once produces exactly one rebuild.

One pass:

1. mint an OSType code for every favorite lacking a valid one;
2. rebuild the helper bundle (usually a no-op via the digest);
3. reconcile the rows against **one** live snapshot;
4. record whether Finder owes a redraw;
5. publish warnings.

Only `@Published` writes and cheap config bookkeeping run on the main actor. `actool`, `codesign`, `lsregister` and every `LSSharedFileList` call run on a detached task, serialized through `enqueue` - the chain matters because each sidebar operation snapshots, decides, then mutates, and two interleaved operations would act on stale rows.

### Finder restart policy

**Nothing in the app calls `killall Finder` on its own.** `restartFinder()` is the single path to `FinderService.restart()` and only a user action reaches it - the banner button, the Settings action, or the Add/Edit sheet's Apply button. A reconcile runs on launch and after any edit, and killing Finder mid-copy aborts the copy and loses every open window, tab and in-flight rename.

A restart is *owed* (`needsFinderRestart`) from two independent sources, because Finder caches two different things:

- a row that was **already on screen** had its override set, changed or cleared;
- the **artwork behind an unchanged code** changed - a different SVG, a different symbol, a different size. No row property moves in that case, so only the rebuilt bundle's `contentChanged` flag knows anything happened.

A row inserted with its override already set draws correctly immediately and owes nothing.

## Migration

`MigrationService` performs the one-shot upgrade from the pre-1.0 world. It is deliberately split into two halves that must stay split:

- **`preflight(version:favorites:)` only reads.** It enumerates exactly what a migration would touch and returns it as a `MigrationPlan`, so `MigrationConsentSheet` can name every bundle by the name it actually has on disk, before anything happens. Every fact on that sheet comes from this scan.
- **`migrate(approving:)` acts, and only on the plan the user approved.** Every guard the pre-flight applied is re-run immediately before each delete, because the plan may be minutes old by the time consent arrives.

`FavoriteSyncCoordinator.bootstrap()` never calls the second half by itself when the plan contains destructive work, and no reconcile is allowed to run while an upgrade is outstanding - building the new helper while the old apps are still installed is precisely the half-migrated state that must not exist. "Not Now" writes nothing at all: *not yet migrated* is already the state on disk.

Order of operations: back up `config.json` to `config.pre-1.0.json` (never overwriting an existing backup) → terminate, unregister and delete the approved bundles → mint missing OSType codes → **verify** every favorite's identity survived unchanged → commit the schema version.

Guards on the teardown, in the order they are applied:

- The teardown is armed by the **schema version alone** (`config.version < Config.currentVersion`, currently `3`). The self-healing "a favorite is missing a code" condition must never arm it - that is an entirely ordinary state between adding a favorite and persisting its code, so hanging deletion off it would re-arm the teardown long after 1.0 was installed.
- The delete root must literally end in `SidebarFavorites/Apps`, must exist, and must not be a symlink out of `SidebarFavorites/`.
- Per entry: not a symlink, named `*.app`, symlink-resolved to a **direct child** of that root, a real directory, and its `CFBundleIdentifier` must start with `com.ivg-design.SidebarFavorites.` - never matched by filename, because an app called `Downloads.app` that somebody else put there is not ours.
- `pluginkit -e ignore` is the only call that changes anything outside our own files, and the extension identifier it is given was read from a plist through symlinks - so it gets the same namespace check as the outer bundle.

Everything destructive is best-effort: failures become warning strings, never exceptions, and never abort the steps that follow. The schema version is committed even on partial failure, so a machine with a permissions problem under `Apps/` cannot loop the migration forever.

Provenance is deliberately left unresolved by the migration. Only a comparison against a live sidebar snapshot can tell a row the user created from a favorite that was never dragged in, so the first reconcile decides - and it adopts. **The migration reads, writes and removes no sidebar row at all.**

## Files on disk

```
~/Library/Application Support/SidebarFavorites/
  config.json                       favorites, settings, helper digest + generation
  config.pre-1.0.json               pre-migration backup (written once)
  config.corrupt-<timestamp>.json   an unreadable config, moved aside rather than replaced
  Icons/                            imported SVGs, verbatim as the user supplied them
  SidebarFavoritesIcons.app         the helper bundle
  Apps/                             pre-1.0 generated icon apps; removed by migration
```

`config.json` is written atomically. A decode failure never wipes favorites: the file is moved aside and Settings shows a banner with a **Reveal Backup** button. Both `Config` and `Favorite` decode tolerantly (`decodeIfPresent` throughout), so a 0.5.0 config loads without tripping the corrupt path.

## Source map

| Path | Role |
| --- | --- |
| `Services/SFLBridge.{h,m}` | The only `LSSharedFileList` code |
| `Services/SidebarItemManager.swift` | Swift facade over it; serializes mutations |
| `Services/OSTypeAllocator.swift` | Mints and validates the four-character codes |
| `Services/IconHelperBundle.swift` | Builds, signs and registers the helper bundle |
| `Services/SymbolCatalogBuilder.swift` | Stages symbolsets, drives `actool`, tolerates failures |
| `Services/SymbolTemplateSynthesizer.swift` | Template scaffold, sizing, and the shared preview metrics |
| `Services/SVGGeometryParser.swift` | Arbitrary SVG → one flattened `CGPath` |
| `Services/SymbolValidator.swift` | Import front door: usable / not, plus warnings |
| `Services/FavoriteSyncCoordinator.swift` | The single reconcile pass; also `SidebarReconciler` |
| `Services/MigrationService.swift` | Read-only pre-flight and consent-gated teardown |
| `Services/ConfigManager.swift` | `config.json` persistence and recovery |
| `Views/MigrationConsentSheet.swift` | Renders the pre-flight plan; nothing runs until Upgrade |
| `Views/AddEditFavoriteSheet.swift` | Import, size slider, live preview, Apply |

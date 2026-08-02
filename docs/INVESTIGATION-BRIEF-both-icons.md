# Investigation request: can a folder have a custom folder icon AND a stable custom sidebar icon?

**Status:** open question, worth a serious attempt. Two users have now asked for it independently.
**Target platform:** macOS 26.6 (build 25G72), Apple Silicon. Behaviour differs from macOS 26.2 — see §2.
**Repository:** `/Users/ivg/github/SidebarFavorites` (app: SidebarFavorites, Developer ID distribution, not App Store).

---

## 1. The question, precisely

A user wants **both** of these on the same folder, at the same time:

- **A custom folder icon** — the artwork you paste in Get Info, which Finder draws on the Desktop, in Finder windows, in Open/Save dialogs, and (the motivating case) **in the Dock** when the folder is placed there.
- **A custom sidebar icon** — a distinct glyph on that folder's row in Finder's sidebar Favorites section, which is what this app provides.

Today these are mutually exclusive **in practice**, because the presence of the first one causes the second to be erased visually (§2). The app currently resolves this by detecting the folder's own icon and offering to delete it.

**The deliverable is an answer to: is there any mechanism, supported or private, by which both can be true simultaneously and stably on macOS 26?** "Stably" means the sidebar icon survives ordinary use — copying files in, saving into the folder, a Finder restart, a reboot — without a background process constantly repairing it (see §5 for how much a background process would cost, if it turns out to be the only route).

A clear, well-evidenced **"no, and here is why"** is a perfectly acceptable outcome. Do not manufacture a workaround that only appears to work.

---

## 2. Established facts (verified on this machine — do not re-derive, but do sanity-check)

### 2.1 How the app puts an icon on a sidebar row

1. Each favorite is allocated a private four-character OSType code (`S000`, `S001`, …).
2. That code is written onto the row as the private per-item property `com.apple.LSSharedFileList.OverrideIcon.OSType` (see `SidebarFavoritesManager/Services/SFLBridge.m`).
3. A helper bundle at `~/Library/Application Support/SidebarFavorites/SidebarFavoritesIcons.app` exports one UTI per favorite, tagged with `com.apple.ostype` = that code, whose `UTTypeIcons → UTTypeSymbolName` names an SF Symbol (custom SVGs are compiled into an `Assets.car` inside that bundle).
4. Finder resolves code → UTI → symbol through Launch Services.

Disassembly of `+[SFLList(LSSharedFileListSupport) copyBindingFromItem:]` (SharedFileList.framework, confirmed on 26.6) shows the override is read **before** bookmark/URL resolution for every item that is not a "special item", converted via `UTType(tag:tagClass:"com.apple.ostype")` into an LS binding.

Apple's own stock sidebar glyph codes work as overrides with no helper bundle at all: `sbTM` (Time Machine), `sbED` (external disk), `sbIn`, `sbRm`, `sbNw`, `sbOD`. Verified by putting `sbTM` on a plain folder row and seeing the Time Machine clock.

### 2.2 The wipe — the whole problem

**On macOS 26, Finder redraws a sidebar row from its target's own icon whenever that target's metadata changes, discarding the drawn override. The `OverrideIcon.OSType` property itself is never removed.**

- The trigger is metadata, not content: a bare `touch -m <folder>` is sufficient. No file copy needed.
- **It only affects targets that carry an icon of their own**: a folder with `Icon\r` + `kHasCustomIcon`, or a volume with `.VolumeIcon.icns`. A plain folder never loses its icon, indefinitely. A volume *without* `.VolumeIcon.icns` is likewise immune (verified on a disposable disk image, bidirectionally: plain → immune; add icon → wipes; remove icon → immune again).
- Proven bidirectionally on folders too: a scratch folder survived repeated copies while plain; the same folder wiped on the very next copy after `Icon\r` + `SetFile -a C` were added; and stopped wiping when they were removed.
- The property surviving is directly observable: dump the row after a wipe and the code is still there and still correct. A user independently confirmed the same thing from the other end — his icons kept drawing correctly in **Save dialogs** (a different process, resolving the row afresh) while the Finder window had reverted.
- **The folder's own icon does NOT appear in the sidebar after the wipe.** The row falls back to a generic folder glyph. Sidebar rows only ever draw template symbols, never the colour `.icns`. (This kills the naive hope that "if the folder icon matched the sidebar glyph, the wipe wouldn't be visible".)
- Independently confirmed in the field by two unrelated users (GitHub issues #17 and #19), both of whom had Get Info icons on the affected folders, and for both of whom removing those icons fixed it.
- **This is a regression.** The same tests on macOS 26.2 did not reproduce it. Filing with Apple is a separate track and is worth doing regardless of the outcome here.

### 2.3 Repair works, and is what the app ships today

Rewriting the sidebar row makes Finder redraw it correctly **immediately, with no Finder restart**:

- **Favorites:** an in-place `LSSharedFileListInsertItemURL` upsert with the same URL/name/code, anchored on the preceding row (preserves position and durable item ID).
- **Locations (`com.apple.LSSharedFileList.FavoriteVolumes`):** re-setting the same value with `LSSharedFileListItemSetProperty`. (Do **not** upsert that list — it creates duplicate rows.)
- Note: `~/Library/CloudStorage` FileProvider paths **refuse** the insert, so repair must be skipped for them. They are immune to the wipe anyway.

### 2.4 The strongest existing lead — Finder Sync survived the wipe

This is the single most important prior result for this investigation, and it is **incomplete**.

The app's pre-1.0 mechanism was a Finder Sync extension (`com.apple.FinderSync`) whose **host app's** `CFBundleIcons → CFBundlePrimaryIcon → CFBundleSymbolName` supplied the sidebar icon for its monitored root. Re-tested on 26.6:

- A first attempt appeared to show it also wiped. **That was a false negative** — the v0.5 recipe signs the extension with `com.apple.security.app-sandbox = false`, which makes PlugInKit silently refuse to register it. The extension never ran.
- Signed with **`app-sandbox = true`** plus hardened runtime and notarisation, it registered immediately, and:
  - it decorated the target's row **with no `OverrideIcon.OSType` property involved at all**;
  - it appeared in **both** the Favorites and Locations sections;
  - **it survived `touch -m` and 200 writes — on a volume that DID carry a custom `.VolumeIcon.icns`.**

That last point is the crux: **a Finder Sync-supplied sidebar icon appears to be immune to the very repaint that destroys the property-based override, even on a target that has its own icon.** If that holds for *folders* with `Icon\r` icons — which was never tested — then "both at once" is solved.

Known limits of that route as measured: the icon is lost on unmount (only the Favorites row recovers on Finder relaunch), it requires a notarised sandboxed extension the user must enable in System Settings, and the icon is per-extension (the pre-1.0 design generated one app+extension per favorite, which is why it was abandoned). Apple's *documented* classic route for this (a loose `.iconset` with `sidebar_16x16`/`18x18`/`32x32` template images referenced by `CFBundleIconFile`, explicitly not an asset catalog) was tested and **does not work** — all variants fell back to the generic app icon. Only `CFBundleSymbolName` worked.

---

## 3. What to investigate, in priority order

### Lead A — Finder Sync on a folder with a custom folder icon (highest value)

Build a minimal Finder Sync extension monitoring an ordinary **folder** (not a volume), sandboxed, hardened-runtime signed, notarised, host app declaring `CFBundleIcons → CFBundlePrimaryIcon → CFBundleSymbolName`. Then:

1. Confirm the sidebar row shows the extension's symbol.
2. Give the folder a Get Info custom icon (`Icon\r` + `kHasCustomIcon`).
3. Confirm the folder icon shows on the Desktop / in windows / **in the Dock**.
4. Hammer the folder: `touch -m`, copy files in, save into it from an app, restart Finder, reboot.
5. Report whether the sidebar glyph survives all of it while the folder icon remains.

If yes, this answers the question. Then characterise the costs precisely: does it need one extension per distinct icon, or can one extension monitor many roots with different icons (`FIFinderSyncController.directoryURLs` takes a set — but the icon comes from the host bundle, which suggests one icon per extension; **check whether `-[FIFinderSyncController setBadgeImage:label:forBadgeIdentifier:]` or any sidebar-specific API allows per-directory icons**). Also verify what happens with the extension disabled or the app deleted.

### Lead B — is the wipe actually about "the target has an icon", or about "the icon changed"?

The model in §2.2 is empirical. Worth probing the mechanism rather than the correlation:

- Does the wipe still happen if the folder's `Icon\r` exists but `kHasCustomIcon` is **cleared** (icon inert)?
- Does it happen if the `Icon\r` file is unreadable (permissions) or zero-length?
- Does the icon cache matter — does `killall iconservicesagent` change the behaviour?
- Is there a per-row property that suppresses the re-derivation? Known per-item keys seen in the SharedFileList binary include `ForceTemplateIcons` (measured to be a **list**-level key, already true on both lists — a per-row copy did nothing), `ItemIsManaged`, `ItemIsHidden`, `TargetIsVolume`, `TargetIsDirectory`, `ItemIsLocked`. All of those were tried and failed, but the enumeration may be incomplete — dump the full property key set from the binary and from live rows and look for anything untried.

### Lead C — FileProvider domains

Cloud-provider rows (Google Drive, Dropbox) get branded sidebar glyphs via a File Provider extension declaring `CFBundleSymbolName`, and **those rows visibly do not suffer the wipe**. Could an arbitrary local folder be vended through an `NSFileProviderDomain` to inherit that immunity? The obvious cost is that the path relocates under `~/Library/CloudStorage`, which is probably disqualifying for this use case — but establish whether the immunity is real and where it comes from, because it may point at the mechanism in Lead B.

### Lead D — the event-driven repair, characterised honestly

Already prototyped; treat as the fallback of last resort, and only if A–C fail. Measured behaviour on 26.6:

- A 3 GB copy produced 404 FSEvents that coalesced into **2 repairs at 15–17 ms each, with no visible flicker**. Bulk copying is not the problem.
- **Root-mtime churn is the problem.** At 0.15 s intervals the icon stayed wiped for the whole burst. At 2 s intervals, six repairs each returned `noErr` and the row was **still wiped 20 s later** with no events pending — i.e. a single debounced repair loses the race and never notices.
- Re-stamping at **~0.3 s / 1.2 s / 3.0 s** after the last event held reliably.

If this is the only route, the open questions are: can the race be won deterministically rather than by a retry ladder (is there an observable signal that Finder has finished repainting?), and what is the real cost of the background process in battery/CPU terms.

---

## 4. How to reproduce and measure

Two small Objective-C CLI tools make all of this tractable. They existed in a scratch directory and may need rewriting; both need `#pragma clang diagnostic ignored "-Wdeprecated-declarations"` and link `Foundation` + `CoreServices`.

- **`dump_favorites`** — enumerate `kLSSharedFileListFavoriteItems`, printing per row: `LSSharedFileListItemGetID`, display name, the `com.apple.LSSharedFileList.OverrideIcon.OSType` property, and the resolved path (resolve with `kLSSharedFileListNoUserInteraction | kLSSharedFileListDoNotMountVolumes`). Extend it to `com.apple.LSSharedFileList.FavoriteVolumes` for the Locations section.
- **`insert_test`** — insert/patch/remove rows: `LSSharedFileListInsertItemURL` with a properties dictionary carrying the OSType key; support anchoring after a given item ID; removal by item ID.

Method notes that cost real time to learn:

- **Verify the property with `dump_favorites` BEFORE judging what Finder draws.** An early false negative came from relaunching Finder before a write had settled.
- **Screenshot and actually look.** The property being set is not evidence the icon draws.
- If any interaction anomaly appears (a row that will not click, focus jumping to the desktop), **enumerate the window stack at those coordinates** (`CGWindowListCopyWindowInfo`) before blaming Finder — hours were lost to an unrelated app leaving a stuck invisible overlay window.
- `pluginkit -m -i <id>` reported "no matches" for an extension that was demonstrably working. Do not trust it as evidence of absence.
- A Finder Sync host app must live somewhere PlugInKit accepts (`~/Library/Application Support/...` worked; `/tmp` did not), and the **host app must be launched once** to register the extension.

---

## 5. Constraints on any proposed solution

- **Distribution is Developer ID**, not the App Store. Private API is therefore permissible if it degrades gracefully — the app already depends on the deprecated `LSSharedFileList` API and, as of 1.1.0, drives the private CoreThemeDefinition/CoreUI asset-catalog engine directly (guarded by `objc_getClass`/`respondsToSelector:` with a fallback chain).
- **"Nothing runs in the background" is a design promise of 1.0**, made publicly and in the README, and it is a large part of why the app was rewritten. A solution requiring a permanent background process is not disqualified, but it must be worth the cost and should be opt-in.
- **Anything requiring the user to enable an extension in System Settings is a significant regression in setup experience** — that confusion was the single most common support complaint in the 0.x era (issues #1, #2, #9, #13). Again not disqualifying, but it must be justified.
- **Never destroy user data.** The folder's own icon must be preserved (the app currently backs it up before removing it).

---

## 6. Deliverable

1. **A verdict on the question in §1**: possible or not, with the evidence that establishes it.
2. **If possible:** the mechanism described concretely enough to implement — frameworks, classes, selectors, plist keys, signing/entitlement requirements — plus its failure modes (what happens on unmount, on reboot, when the extension is disabled, when the app is deleted) and its cost against the constraints in §5.
3. **If not possible:** which of Leads A–D were tested, how, and what each did; plus a recommendation on whether Lead D (background repair) is worth shipping as an opt-in for users who want both.
4. **Corrections.** Any claim in §2 that turns out to be wrong or overstated — several earlier conclusions in this project were, and finding them is as valuable as finding a workaround.

# Architecture Review - SidebarFavorites

This review validates key assumptions in `ARCHITECTURE.md`, highlights likely blockers,
and suggests corrections and next-step experiments.

## Validation Summary

### High-Risk Assumptions / Likely Blockers

1) Finder Sync behavior vs "Favorites"
- Finder Sync provides a single sidebar item per enabled extension. It is not the same
  as a true "Favorite" entry that points directly to a folder. In practice the sidebar
  entry is the extension item, not the underlying folder. This means the UI might not
  match user expectations even if it appears in the sidebar.
- Users must explicitly enable each Finder Sync extension in System Settings. There is
  no public API to auto-enable multiple extensions. If you generate N apps, the user
  must enable N extensions manually.

2) App icon resolution and `CFBundleSymbolName`
- `CFBundleSymbolName` only supports system SF Symbols. It does not point to custom
  SVG symbols. For custom icons, the app must ship an actual app icon (e.g. `AppIcon`
  asset or `.icns`) and set `CFBundleIconName` or `CFBundleIconFile`.
- The plan to compile custom SVG to `Assets.car` via `actool` is not enough unless the
  output is a proper AppIcon set. A symbol asset is not used as the app icon.

3) Finder Sync entitlements and sandboxing
- Finder Sync extensions require sandboxing. Setting `com.apple.security.app-sandbox`
  to `false` will prevent the extension from loading.
- The extension must include the Finder Sync entitlement (`com.apple.developer.finder-sync`),
  plus appropriate file access entitlements if it needs folder access.

4) Code signing and distribution
- Ad-hoc signing can work during local development, but Finder Sync extensions commonly
  fail to load on other machines without proper signing and (usually) notarization.
- If the manager generates new apps post-install, you are effectively creating new
  code-signed binaries. Gatekeeper and extension loading are sensitive to that.

5) Folder access and persistence
- The plan stores raw folder paths. In a sandboxed app, you should store security-scoped
  bookmarks and resolve them in the extension. This is not covered in the current plan.

### Feasible / Sound Elements

- The separation between a manager app and generated "icon apps" is a reasonable strategy
  if the Finder Sync path is viable.
- Using a template app bundle is a practical way to avoid re-building an extension from
  scratch for each icon.
- A config file model with a stable UUID per favorite is good for repeatable updates.

## Detailed Findings

### Finder Sync Sidebar Item Semantics

- The plan assumes Finder Sync yields a folder-like Favorite entry with a custom icon.
  In practice, Finder Sync gives a single sidebar item representing the extension.
  That item does not necessarily behave like a folder favorite.
- This difference should be validated with a minimal prototype before committing to a
  multi-app architecture.

### Extension Enablement UX

- Each generated app includes a Finder Sync extension that must be manually enabled.
  This creates high friction and undermines "add favorite and done" UX.
- There is no documented API to programmatically enable Finder Sync extensions.

### App Icon Pipeline

- For system symbols, `CFBundleSymbolName` is fine.
- For custom icons, generate a true app icon asset:
  - Build an AppIcon set or `.icns`
  - Update `CFBundleIconName` / `CFBundleIconFile`
  - Ensure the Finder Sync sidebar item uses the app icon, not a symbol asset
- If you keep SF Symbols for built-ins, you still need to confirm Finder uses the
  app icon on the sidebar item (not the extension icon or a cached symbol).

### Bundle IDs and Extension IDs

- The plan updates the main app `CFBundleIdentifier` but does not mention changing
  the Finder Sync extension bundle ID. Duplicate extension IDs across generated apps
  will conflict.
- You need to update:
  - Main app bundle ID
  - Finder Sync extension bundle ID
  - `NSExtension` dictionary if it references the bundle ID anywhere

### URL Configuration

- The "Resources/URLs" file is not a Finder Sync feature. The extension must read it
  and call `FIFinderSyncController.default().directoryURLs` at runtime.
- If you write this file into the bundle after signing, it must be re-signed.

### Resource Usage Estimate

- The "14 MB RAM per favorite" estimate is not validated. Finder Sync extensions can
  be memory-heavy once loaded. Expect usage to scale with number of extensions.

## Suggestions / Corrections

1) Validate Finder Sync viability immediately
- Build a single Finder Sync extension that:
  - sets a custom app icon
  - sets a single directory URL
  - verifies sidebar appearance, icon usage, and click behavior
- If the sidebar item is not a true folder entry, this architecture will not match
  user expectations.

2) Rework custom icon handling
- Use `.icns` or AppIcon assets for custom icons.
- Avoid `CFBundleSymbolName` for custom SVGs; it only supports system symbols.

3) Fix entitlements and sandboxing
- Set `com.apple.security.app-sandbox` to `true`
- Add Finder Sync entitlement
- Use security-scoped bookmarks for folder paths

4) Reduce extension enablement friction
- Consider a single app with multiple Finder Sync extensions only if you accept the
  same enablement problem.
- If the real requirement is "Favorites with custom icons," consider a File Provider
  extension instead. It provides a true sidebar location but is a larger investment.

5) Clarify bundle ID strategy
- Introduce an explicit ID scheme for both app and extension IDs.
- Update all Info.plist files accordingly during generation.

## Open Questions

- Does the sidebar item from Finder Sync behave like a folder favorite (open to path)?
- Does Finder respect `CFBundleSymbolName` for the extension sidebar icon?
- Can custom app icons be reliably refreshed without restarting Finder?
- What is the minimum signing/notarization requirement for the extension to load on
  a non-development machine?

## Recommendation

Before building the manager and generator, implement a one-day spike to validate:
1) Finder Sync sidebar behavior
2) App icon rendering using `CFBundleSymbolName` vs `AppIcon`
3) Extension enablement UX
If any of these fail, pivot to a File Provider-based architecture or a different UX
model (e.g. alias management + user instructions).

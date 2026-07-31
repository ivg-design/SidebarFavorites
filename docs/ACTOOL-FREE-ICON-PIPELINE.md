# Compiling custom symbols without Xcode

**Verdict: there is a working route.** Custom SVG icons can be compiled into a real
`Assets.car` on a machine with no Xcode installed, in-process, using
`CoreThemeDefinition.framework` — the private OS framework that `actool` itself drives.
The output is bit-for-bit equivalent to `actool`'s at the rendition level, and it draws
on a real Finder sidebar row.

This closes issue #18 without a fallback and without asking the user to install Xcode.

Everything below was measured on macOS 26.6 (25G72), Apple Silicon, on 2026-07-29.
Working files: `/private/tmp/claude-501/-Users-ivg/8ac5d66a-.../scratchpad/work`.

---

## 1. The finding that makes it work

`actool` is a thin front end. It does not contain the asset-catalog compiler:

```
$ dyld_info -dependents /Applications/Xcode.app/Contents/Developer/usr/bin/actool
    /System/Library/Frameworks/Security.framework/Versions/A/Security
    /usr/lib/libSystem.B.dylib
```

`actool` links nothing but Security and libSystem, and Xcode ships **no** copy of
`CoreThemeDefinition.framework` or `CoreUI.framework` (`find /Applications/Xcode.app
-iname 'CoreThemeDefinition*' -o -iname 'CoreUI.framework'` → empty). It `dlopen`s the
operating system's copies:

```
/System/Library/PrivateFrameworks/CoreThemeDefinition.framework   (dyld shared cache)
/System/Library/PrivateFrameworks/CoreUI.framework                (dyld shared cache)
```

Both live on `/`, which is `apfs, sealed, read-only` — the Signed System Volume. They are
part of macOS, not part of Xcode. The `Authoring Tool` string baked into an
`actool`-produced `Assets.car` says so out loud: `PROJECT:CoreThemeDefinition-653.4`, the
OS framework's version, appears in a catalog compiled by Xcode 26.6 and in one compiled by
this route.

So "no Xcode" never meant "no compiler". It only meant no `argv` front end. We can supply
our own.

Also present and OS-shipped, and useful:

| Path | What it is |
| --- | --- |
| `/usr/bin/assetutil` | Inspect/validate a `.car` (`--info`, `--validate-file`) |
| `/System/Library/PrivateFrameworks/CoreThemeDefinition.framework/Versions/A/Resources/distill` | A command-line `.cotd` → `.car` distiller (the *back half* of `actool`) |

---

## 2. The working route (Route 1) — verdict: **WORKS, proven end to end**

### 2.1 Shape

```
synthesized Template v.7.0 SVG   (unchanged - SymbolTemplateSynthesizer)
   -> TDVectorGlyphReader           validate (same errors actool prints)
   -> CoreThemeDocument             build an in-memory/on-disk .cotd, import each SVG
                                    as a kCUIRenditionTypeVectorGlyph named asset
   -> TDDistiller                   distill the document straight to Assets.car
```

No subprocess. No `xcrun`. No `/Applications/Xcode.app`. Verified with
`DYLD_PRINT_LIBRARIES=1`: **zero** dylibs loaded from any Xcode path.

### 2.2 Frameworks, classes, selectors

`dlopen("/System/Library/PrivateFrameworks/CoreThemeDefinition.framework/CoreThemeDefinition", RTLD_NOW)`
brings in `CoreUI` transitively. Classes are then reachable by `objc_getClass`.

**Validation (optional but recommended — see §2.6)**

```objc
@interface TDVectorGlyphReader : NSObject
+ (instancetype)vectorGlyphReaderWithURL:(NSURL *)url platform:(long long)p error:(NSError **)e;
- (BOOL)canDrawWithWeight:(long long)w size:(long long)s;   // Regular = 4, Medium = 2
- (float)templateVersion;                                    // 7.0 for Template v.7.0
@end
```

**Document**

```objc
@interface CoreThemeDocument : NSPersistentDocument
+ (long long)platformForPersistentString:(NSString *)s;      // @"macosx" -> 0
+ (instancetype)createConfiguredDocumentAtURL:(NSURL *)url
                               targetPlatform:(long long)platform
                                        error:(NSError **)error;
- (void)setMinimumDeploymentVersion:(NSString *)v;           // @"13.0"
- (void)importNamedAssetsWithImportInfos:(NSArray *)infos
                          referenceFiles:(BOOL)ref
                       completionHandler:(void (^)(BOOL ok))handler;
- (NSArray *)namedArtworkProductions;
@end
```

**Per-symbol import descriptor**

```objc
@interface TDNamedAssetImportInfo : NSObject
- (void)setName:(NSString *)name;                 // becomes the runtime symbol name
- (void)setFileURL:(NSURL *)url;                  // the Template v.7.0 SVG
- (void)setRenditionType:(long long)t;            // 1017 = kCUIRenditionTypeVectorGlyph
- (void)setScaleFactor:(unsigned long long)s;     // 1
- (void)setIdiom:(long long)i;                    // 0 = universal
- (void)setVectorGlyphRenderingMode:(long long)m; // 0 = automatic
@end
```

**Distiller**

```objc
@interface TDDistiller : NSObject
- (instancetype)initWithDocument:(id)doc outputPath:(NSString *)carPath versionString:(NSString *)v;
- (void)setDeploymentPlatform:(NSString *)p;         // @"macosx"
- (void)setDeploymentPlatformVersion:(NSString *)v;  // @"13.0"
- (void)setAuthoringTool:(NSString *)t;
- (void)saveAndDistillWithCompletionHandler:(void (^)(BOOL ok))handler;
- (BOOL)isSuccessful;
- (NSString *)accumulatedErrorDescription;
@end
```

**Post-check (reading a catalog back)**

```objc
@interface CUICommonAssetStorage : NSObject
- (instancetype)initWithPath:(NSString *)carPath;
- (NSArray *)allRenditionNames;
@end
```

### 2.3 Constants, established by enumerating the framework's own Core Data model

Read out of `CoreThemeDocument -allObjectsForEntity:withSortDescriptors:` on the
`RenditionType` / `ThemeDeploymentTarget` entities, so they are the OS's own numbers, not
guesses:

| Constant | Value |
| --- | --- |
| `kCUIRenditionTypeVectorGlyph` | `1017` |
| target platform `macosx` | `0` (`iphoneos` = 1) |
| idiom universal | `0` |
| `kCoreThemeVectorGlyphRenderingModeAutomatic` | `0` |
| glyph weight Ultralight / Regular / Black | `1` / `4` / `9` |
| glyph size Small / Medium / Large | `1` / `2` / `3` |
| `kCoreThemeDeploymentTarget2019` | `5` |

### 2.4 Threading and lifecycle — load-bearing

* `CoreThemeDocument` is an `NSPersistentDocument`, so **AppKit must be loaded** and a
  `CFRunLoop` must be pumping. The app already links AppKit.
* `importNamedAssetsWithImportInfos:…` delivers its completion **on the main queue**
  (confirmed from a crash backtrace through `_dispatch_main_queue_drain`). Therefore:
  * calling from a background thread and blocking on a semaphore works **only while the
    main thread is free**; the current `enqueue`d detached task satisfies that, but it is
    a real coupling and should be commented as one; or
  * hop the whole build onto the main actor. It costs 5 ms per symbol, so this is the
    safer choice and costs nothing measurable.
* The completion handler signature is `void(^)(BOOL)`, **not** `void(^)(NSError *)`.
  Declaring it as `(id)` and retaining the argument segfaults (`objc_retain` on `0x1`).
  Same for `saveAndDistillWithCompletionHandler:`.
* `createConfiguredDocumentAtURL:` writes a `Foo.cotd` file **plus** a sibling
  `Foo-Artwork/` directory. Both must be created in a scratch directory and deleted after.

### 2.5 Proof

**a) The catalog is identical to `actool`'s.** One synthesized `Template v.7.0` SVG
(a solid triangle, generated with the app's own artboard geometry), compiled twice:

```
actool  gt/Assets.car   23656 bytes
ours    mine.car        23656 bytes
```

`assetutil --info` on both, with `Timestamp` / `AssetStorageVersion` / `Authoring Tool` /
`MainVersion` masked out, differs **only** in two fields:

* `NameIdentifier`: `10905` (actool) vs `1` (ours) — an internal name token, remapped
  through the catalog's own name table, so it is not part of the contract.
* `SchemaVersion`: `2` vs `5`. `-[TDDistiller setAssetSchemaVersion:]` does *not*
  override it (tested); the document supplies it. It has no observable effect —
  see (c) and (d).

Every one of the 17 renditions per symbol matches on **`SHA1Digest`** — the 5 `Vector
Glyph` renditions (Ultralight-S, Regular-S/M/L, Black-S, each carrying Baseline, Capline,
Reference Point Size 13, `Template Version 7`, `Interpolatable`) and the 12 pre-rasterized
`deepmap2` glyph-cache bitmaps (Regular × {Medium, Large} × scale {1,2} × cached index
{0,1,2}). The compiled artwork is byte-identical.

`assetutil --validate-file mine.car` → `valid keyformat`, `all image blocks are valid`.

**b) It loads as a symbol.** `Bundle(url:).image(forResource: "sbf.xcode.free.triangle")`
from a bundle whose `Contents/Resources/Assets.car` is ours returns an
`18.0 × 17.0` **template** `NSImage` that draws the triangle. (`work/mine-glyph.png`.)

**c) The UTI resolves.** A helper-shaped bundle was built — `CFBundlePackageType APPL`,
no-op shell executable, one `UTExportedTypeDeclarations` entry with
`com.apple.ostype = SZZ9`, `UTTypeConformsTo = public.folder`, and
`UTTypeIcons = { UTTypeSymbolName = sbf.xcode.free.triangle }` — registered with
`lsregister -f -R -trusted`. `UTType(tag: "SZZ9", tagClass: "com.apple.ostype")` resolved
to the declared, non-dynamic identifier.

**d) It draws on a real Finder sidebar row.** A disposable folder was inserted into
`kLSSharedFileListFavoriteItems` with
`com.apple.LSSharedFileList.OverrideIcon.OSType = "SZZ9"`, Finder was restarted, and the
row was screenshotted:

```
  ▲  sbf-xcode-free-proof
```

The triangle glyph — compiled with no Xcode involved — rendered at sidebar size, in the
sidebar's own template tint, next to Apple's stock rows. Screenshot: `work/proof3.png`.
The row, the folder and the bundle registration were removed afterwards.

**e) Nothing from Xcode is touched.** `DYLD_PRINT_LIBRARIES=1` over the whole run: no
dylib from any `/Applications/Xcode.app` path. The process also ran with
`DEVELOPER_DIR=/Library/Developer/CommandLineTools`, and correctly with hardened runtime
enabled (`codesign --options runtime`) — library validation is satisfied because the
frameworks are Apple platform binaries.

**f) It is faster.** Five symbols: `actool` 1.84 s wall; this route 0.60 s wall
*including process launch*. In-process it is ~50 ms.

### 2.6 Failure behaviour — one real difference from `actool`

`actool` refuses a non-template SVG loudly:

```
error: Symbol image file '…/bad.svg' must have a glyph for Regular weight Medium size
```

`CoreThemeDocument` **silently drops it**. `importNamedAssets…` reports `ok=1`,
`namedArtworkProductions` counts it, `TDDistiller` reports success, and the resulting
catalog contains the *name* but zero renditions for it. So the validation lives in
`actool`'s front end, not in the document.

Two independent gates recover the old semantics, and both are cheap:

1. **Pre-flight, per symbol.** `+[TDVectorGlyphReader vectorGlyphReaderWithURL:platform:error:]`
   returns `nil` and an `NSError` in domain `com.apple.CoreThemeDefinition.ErrorDomain`,
   code `1023`, whose `localizedDescription` is *the exact string `actool` prints*. This
   is the same validator, reachable directly, per file, with no batch to lose. It makes
   `SymbolCatalogBuilder.compilable(_:)` — the one-`actool`-run-per-symbol retry loop —
   obsolete.
2. **Post-flight.** Open the produced catalog and confirm the symbol actually renders:
   `Bundle(url:).image(forResource: name)` returns `nil` for a dropped symbol (verified).
   `-[CUICommonAssetStorage allRenditionNames]` is **not** sufficient — it still lists a
   dropped name.

`SymbolCatalogBuilder.synchronize` already returns "the set of names that made it", so
this maps onto the existing contract exactly: pre-flight decides the set, post-flight
confirms it, and the difference becomes the same per-favorite warning it is today.

### 2.7 Prototype (complete, compiles with Command Line Tools only)

```objc
// clang -isysroot /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk \
//       -fobjc-arc -framework Cocoa -o carbuild carbuild.m
#import <Cocoa/Cocoa.h>
#import <objc/runtime.h>
#import <objc/message.h>
#import <dlfcn.h>

int main(int argc, const char **argv) { @autoreleasepool {
  // argv: workdir outCarPath  name1 svg1 [name2 svg2 ...]
  if (!dlopen("/System/Library/PrivateFrameworks/CoreThemeDefinition.framework/CoreThemeDefinition", RTLD_NOW))
      return 2;
  Class CTD  = objc_getClass("CoreThemeDocument");
  Class INFO = objc_getClass("TDNamedAssetImportInfo");
  Class DIST = objc_getClass("TDDistiller");
  if (!CTD || !INFO || !DIST) return 2;                       // -> fall back

  NSString *work = @(argv[1]), *outCar = @(argv[2]);
  [[NSFileManager defaultManager] createDirectoryAtPath:work withIntermediateDirectories:YES attributes:nil error:nil];
  NSURL *cotd = [NSURL fileURLWithPath:[work stringByAppendingPathComponent:@"Build.cotd"]];

  NSError *err = nil;
  id doc = ((id(*)(id,SEL,id,long long,NSError**))objc_msgSend)(
      CTD, @selector(createConfiguredDocumentAtURL:targetPlatform:error:), cotd, 0LL /*macosx*/, &err);
  if (!doc) return 3;
  ((void(*)(id,SEL,id))objc_msgSend)(doc, @selector(setMinimumDeploymentVersion:), @"13.0");

  NSMutableArray *infos = [NSMutableArray array];
  for (int i = 3; i + 1 < argc; i += 2) {
      id info = ((id(*)(id,SEL))objc_msgSend)([INFO alloc], @selector(init));
      ((void(*)(id,SEL,id))objc_msgSend)(info, @selector(setName:), @(argv[i]));
      ((void(*)(id,SEL,id))objc_msgSend)(info, @selector(setFileURL:), [NSURL fileURLWithPath:@(argv[i+1])]);
      ((void(*)(id,SEL,long long))objc_msgSend)(info, @selector(setRenditionType:), 1017LL);
      ((void(*)(id,SEL,unsigned long long))objc_msgSend)(info, @selector(setScaleFactor:), 1ULL);
      ((void(*)(id,SEL,long long))objc_msgSend)(info, @selector(setIdiom:), 0LL);
      ((void(*)(id,SEL,long long))objc_msgSend)(info, @selector(setVectorGlyphRenderingMode:), 0LL);
      [infos addObject:info];
  }

  __block BOOL importDone = NO;
  void (^ich)(BOOL) = ^(BOOL ok) { importDone = YES; };        // NOTE: BOOL, not NSError*
  ((void(*)(id,SEL,id,BOOL,id))objc_msgSend)(
      doc, @selector(importNamedAssetsWithImportInfos:referenceFiles:completionHandler:), infos, NO, ich);
  NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:60];
  while (!importDone && [deadline timeIntervalSinceNow] > 0)
      [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.05]];

  id dist = ((id(*)(id,SEL,id,id,id))objc_msgSend)([DIST alloc],
      @selector(initWithDocument:outputPath:versionString:), doc, outCar, @"SidebarFavorites");
  ((void(*)(id,SEL,id))objc_msgSend)(dist, @selector(setDeploymentPlatform:), @"macosx");
  ((void(*)(id,SEL,id))objc_msgSend)(dist, @selector(setDeploymentPlatformVersion:), @"13.0");
  ((void(*)(id,SEL,id))objc_msgSend)(dist, @selector(setAuthoringTool:), @"SidebarFavorites");

  __block BOOL distDone = NO;
  void (^dch)(BOOL) = ^(BOOL ok) { distDone = YES; };
  ((void(*)(id,SEL,id))objc_msgSend)(dist, @selector(saveAndDistillWithCompletionHandler:), dch);
  deadline = [NSDate dateWithTimeIntervalSinceNow:120];
  while (!distDone && [deadline timeIntervalSinceNow] > 0)
      [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.05]];

  return ((BOOL(*)(id,SEL))objc_msgSend)(dist, @selector(isSuccessful)) ? 0 : 5;
} }
```

Multi-symbol, `custom.`-namespaced names, and the mixed good/bad case were all exercised:
`custom.multi.a` + `custom.multi.b` both land; `custom.multi.a` + a broken SVG lands
`custom.multi.a` only.

### 2.8 How to ship it

Put it behind `SymbolTemplateSynthesizer.compileSymbols(_:to:)`, which is already the only
door to `actool`:

1. Write a thin ObjC shim (`CoreThemeCatalogWriter.{h,m}`) exposing two Swift-visible
   entry points: `+ (BOOL)isAvailable` and
   `+ (BOOL)compileTemplates:(NSDictionary<NSString*,NSURL*>*)templates toCatalogAtPath:error:`.
   Keep every private symbol behind `objc_getClass` / `respondsToSelector:` — never a
   compile-time reference, so a missing class is a runtime `nil`, not a link failure.
2. Order of attempts in `compileSymbols`:
   `CoreThemeCatalogWriter` → `xcrun actool` (unchanged, for the paranoid and for
   comparison) → existing "no catalog" warning path. Each fallback is already written.
3. Validate every template with `TDVectorGlyphReader` **before** import, and confirm the
   produced catalog resolves each name via `Bundle.image(forResource:)` after. Delete the
   per-symbol `actool` retry loop; it has no analogue here.
4. **Bump `IconHelperBundle`'s pipeline version to `4`.** The digest describes
   declarations, not the code that makes artwork — an upgraded user must recompile once.
5. Clean up `Build.cotd` and `Build-Artwork/` in a `defer`.
6. Keep writing the catalog to a scratch path and swapping it in only on success, exactly
   as today.

---

## 3. Route 2 — template `.icns` via `_UTTypeTemplateIconFile` / `UTTypeIconFile`

**Verdict: does not work. Independently reproduced as failing, with caches flushed.**

The prior negative result was re-tested from scratch and from a tracked fixture. Four
extra UTIs were declared in one registered bundle, alongside the working `SZZ9`, each
pointing at a real template `.icns`:

| OSType | `UTTypeIcons` contents | Result on a real sidebar row |
| --- | --- | --- |
| `SZZ9` | `UTTypeSymbolName` (our Xcode-free catalog) | **triangle glyph** ✔ |
| `SZZ8` | `_UTTypeTemplateIconFile: Tri.icns` | plain folder ✘ |
| `SZZ7` | `UTTypeIconFile: Tri.icns` | plain folder ✘ |
| `SZZ6` | `_UTTypeTemplateIconFile` + `UTTypeIconFile` + `UTTypeIconName` | plain folder ✘ |
| `SZZ5` | `_UTTypeTemplateIconFile: SidebarExternalDisk.icns` (**Apple's own file, byte-for-byte**) | plain folder ✘ |

Method: bundle `CFBundleVersion` bumped, `lsregister -f -R -trusted`,
`killall iconservicesagent`, `killall Finder`, then a single screenshot of all five rows
(`work/proof4.png`, `work/proof5.png`). `SZZ9` drew; the other four did not.

`Tri.icns` was built with `iconutil` from a full sidebar-family iconset — black-plus-alpha
template art at 16/18/24/32 pt, each with `@2x` and each with a `[selected]` variant,
mirroring Apple's own layout (verified by round-tripping
`/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/SidebarExternalDisk.icns`
through `iconutil -c iconset`, which yields exactly those 16 files). The `SZZ5` row used
Apple's original file untouched, so artwork quality, type codes and `slct` chunk are not
the explanation.

Why Apple's own declaration is not a counter-example: `com.apple.storage-external` in
`CoreTypes.bundle` carries `UTTypeIconFile`, `UTTypeIconName`, `_UTTypeTemplateIconFile`
**and** `UTTypeSymbolName: externaldrive`. The symbol is doing the work; the `.icns` keys
are legacy companions. That is consistent with everything measured here and with
`ARCHITECTURE.md`'s existing note that shipped `.icns` art rendered as an opaque black
silhouette or a plain folder.

**`UTTypeSymbolName` from a compiled catalog remains the only key the sidebar honours.**

---

## 4. Route 3 — ship a prebuilt catalog and patch artwork at runtime

**Verdict: unnecessary, and structurally impossible anyway.**

A symbol's artwork is not a replaceable blob inside the `.car`. Each symbol is 17
renditions: 5 CSI vector-glyph records carrying interpolatable point arrays plus per-weight
`Baseline` / `Capline` / `Reference Point Size` metrics derived from the source artboard,
and 12 `deepmap2`-compressed grayscale bitmaps at sizes that depend on the glyph's own
aspect ratio (`custom.sidebar.github.rectangle.fixed` produces 21×16, 25×19, 32×25 … while
a square mark produces 14×14, 17×17, 22×22 …). Patching artwork means regenerating all 17
and rewriting the BOM trees, the name table and the packed-asset atlas — i.e. writing the
compiler. Route 1 *is* that compiler, already written by Apple. Moot.

---

## 5. Route 4 — other symbol-delivery mechanisms

**Verdict: none found.**

* An uncompiled `.symbolset` directory in `Contents/Resources` is not read by Launch
  Services or CoreUI; only `Assets.car` is.
* There is no public or private "register this `NSImage` as a symbol for this UTI" call.
  The sidebar resolves through Launch Services → the declaring bundle's catalog; nothing
  in that chain accepts a live object.
* `UTTypeIconName` alone resolves nothing (tested as part of `SZZ6`).

---

## 6. Route 5 — other OS-shipped compilers

**Verdict: one exists, and it is the same engine — but it only does the second half.**

`/System/Library/PrivateFrameworks/CoreThemeDefinition.framework/Versions/A/Resources/distill`
is a universal Mach-O CLI shipped with macOS:

```
usage: distill [OPTION...] inputfile outputfile
  --minimum-deployment-target=version / -d
  --mode=mode / -m     --logging=verbosity / -l     --pack / -p     --version / -V
```

Its input is a `.cotd` CoreThemeDocument, not an `.xcassets`. So it replaces `TDDistiller`
but not `CoreThemeDocument`, and it costs a subprocess. Route 1's in-process `TDDistiller`
is strictly better. It is worth knowing about as a debugging tool and as a *third*
fallback rung.

`CUIMutableCommonAssetStorage` + `CSIGenerator` (the original lead) were dumped and are
sufficient in principle — `setAsset:forKey:`, `setRenditionKey:hotSpot:forName:`,
`CSIGenerator.setVectorSizes:/setBaseline:/setCapHeight:/setTemplateVersion:/
setVectorGlyphRenderingMode:/setInterpolatable:`, plus the 12-token rendition key format
`{appearance, localization, element=85, part=59|181, size, identifier, dimension2,
layer, scale, deploymentTarget=5, glyphWeight, glyphSize}` recovered from a working
catalog. But it means hand-encoding the CSI vector-glyph payload and reproducing the
glyph-cache bitmaps and the `ZZZZPackedAsset` atlas. Route 1 gets all of that from Apple's
own code for a fraction of the surface area. **Not recommended.** Recorded here only so
nobody re-derives it.

---

## 7. Risk assessment

**What is actually being relied on.** Four classes and nine selectors in one OS private
framework, plus one numeric constant read out of that framework's own data model at
runtime. That is a smaller surface than it sounds: `CoreThemeDefinition` is the *only*
implementation of asset-catalog authoring on the system, every Xcode that has ever
compiled a `.car` on this machine went through it, and Apple has no second copy to
migrate to.

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Class/selector renamed or removed in a future macOS | Medium | Every lookup is `objc_getClass` / `respondsToSelector:`; a `nil` falls through to `actool`, then to the existing warning + folder fallback. No crash, no regression against today's behaviour. |
| `kCUIRenditionTypeVectorGlyph` changes value | Low | Do not hard-code `1017`. Read it at runtime: `allObjectsForEntity:@"RenditionType"` → the object whose `constantName` is `kCUIRenditionTypeVectorGlyph` → `identifier`. Costs one fetch; removes the constant entirely. |
| Completion-handler signature changes | Low-Medium | Both are `void(^)(BOOL)` and a wrong assumption **segfaults**. Guard with a wall-clock timeout (already in the prototype) and treat "timed out" as failure → fallback. A crash in the reconcile path is the one outcome that must not happen; consider building the catalog in a short-lived XPC/child process if that risk is judged unacceptable. |
| `NSPersistentDocument` needs AppKit + a runloop | Low | The app is AppKit. Documented in §2.4; run on the main actor. |
| Hardened runtime / notarization | None measured | Verified working under `codesign --options runtime`. Developer ID distribution, not MAS, so private API use is not a review problem. |
| App Sandbox | N/A | The app is not sandboxed (no entitlements file in the project). If that ever changes, the scratch `.cotd` must live inside the container — it already would. |
| `SchemaVersion` 5 vs `actool`'s 2 | None observed | The catalog validates, loads, and draws. `setAssetSchemaVersion:` does not override it. Watch for it if a future OS ever rejects the catalog. |
| Silent drop of an invalid template | Medium if unhandled | This is the one genuine semantic difference. Both gates in §2.6 are mandatory, not optional. |

**Recommendation.** Ship Route 1 as the primary path, keep `xcrun actool` as the second
rung (it costs nothing to keep, and it is a useful A/B when a user reports a bad icon),
and keep today's "no catalog → `public.folder` fallback + warning" as the third. Telling
the user "install Xcode" — the least-bad fallback if nothing had worked — is no longer
necessary and should not ship.

---

## 8. Artifacts

Everything below is under
`/private/tmp/claude-501/-Users-ivg/8ac5d66a-206a-4f49-a318-57a77b730bd1/scratchpad/work`
(temporary; reproduce with the source in §2.7):

| File | What it shows |
| --- | --- |
| `carbuild.m` / `carbuild` | The working Xcode-free compiler |
| `gt/Assets.car` vs `mine.car` | `actool` output vs ours, same input |
| `gt-info.json` / `mine-info.json` | `assetutil --info` for both |
| `mine-glyph.png` | The symbol loaded back out of our catalog |
| `proof3.png` | The glyph on a real Finder sidebar row |
| `proof4.png`, `proof5.png` | The four `.icns` variants failing on real rows |
| `vgcheck.m` | `TDVectorGlyphReader` pre-flight validation |
| `carnames.m`, `cardump.m`, `dumper.m` | Catalog and runtime-interface inspection |

No repo source was modified. The user's live helper bundle at
`~/Library/Application Support/SidebarFavorites/SidebarFavoritesIcons.app` was copied for
reference and never written to; the test bundle, its Launch Services registration, the
five disposable sidebar rows and their folders were all removed.

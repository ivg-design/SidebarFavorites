//
//  CoreThemeCatalogWriter.h
//  SidebarFavoritesManager
//
//  Compiles symbol templates into an `Assets.car` without `actool`.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

extern NSString * const CoreThemeCatalogWriterErrorDomain;

/// Writes a compiled asset catalog using the asset-catalog engine that ships with
/// macOS itself.
///
/// `actool` is not the compiler - it is an argv front end that links only Security
/// and libSystem. The compiler is `CoreThemeDefinition.framework` plus
/// `CoreUI.framework`, both on the sealed system volume of every Mac. `actool`
/// only ships inside Xcode, so every user without Xcode lost custom SVG icons;
/// driving the same engine directly removes that requirement entirely.
///
/// Every symbol is looked up at runtime through `objc_getClass` and
/// `respondsToSelector:`, so a macOS release that renames or removes any of it
/// makes `+isAvailable` answer NO and the caller falls back to `actool`.
@interface CoreThemeCatalogWriter : NSObject

/// Whether the engine is present and has the shape this code expects.
@property (class, readonly) BOOL isAvailable;

/// Why this template cannot be compiled, or nil when it is fine.
///
/// The engine SILENTLY DROPS a template it dislikes - the import reports success,
/// the distiller reports success, and the symbol is simply missing from the
/// catalog. Callers must pre-flight every template through this, which returns
/// the same message `actool` would have printed.
+ (nullable NSString *)validationFailureForTemplateAtURL:(NSURL *)templateURL
    NS_SWIFT_NAME(validationFailure(forTemplateAt:));

/// Compiles `symbols` (symbol name -> Template v.7.0 SVG) into `destinationURL`.
///
/// `scratchDirectoryURL` receives the intermediate document and is emptied
/// afterwards; it must not be inside the bundle being built.
///
/// The destination is only replaced once a catalog has been produced, so a failed
/// compile leaves any previously compiled catalog untouched.
+ (BOOL)writeCatalogAtURL:(NSURL *)destinationURL
                  symbols:(NSDictionary<NSString *, NSURL *> *)symbols
      scratchDirectoryURL:(NSURL *)scratchDirectoryURL
                    error:(NSError **)error
    NS_SWIFT_NAME(writeCatalog(at:symbols:scratchDirectoryURL:));

+ (instancetype)new NS_UNAVAILABLE;
- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END

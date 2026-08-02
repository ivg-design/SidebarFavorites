//
//  SFLBridge.h
//  SidebarFavoritesManager
//
//  Objective-C wrapper around the (deprecated) LSSharedFileList API used to read
//  and mutate Finder's Favorites list.
//
//  This header deliberately imports Foundation ONLY. It is pulled in by the
//  bridging header, which every Swift file in the target sees, so importing
//  <CoreServices/CoreServices.h> here would leak the API_DEPRECATED
//  LSSharedFileList declarations into the whole module. All of that stays
//  confined to SFLBridge.m.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// The per-item property Finder consults in `+[SFLList copyBindingFromItem:]`
/// before its FileProvider short-circuit, which is why an override applies
/// equally to local, iCloud and ~/Library/CloudStorage rows.
///
/// The value is ALWAYS a CFString carrying a 4-character OSType code. Passing an
/// NSNumber crashes the caller inside UniformTypeIdentifiers' `isTagValid`, and
/// codes are case-sensitive ('BLT1' and 'blt1' are different tags), so the string
/// is written through verbatim with no normalization.
extern NSString * const SFLOverrideIconOSTypeKey;

/// Error domain for every failure reported by SFLBridge.
///
/// `code` is the underlying OSStatus when one is available. OSStatus values here
/// are always <= 0, so the small positive `SFLBridgeErrorCode` values below can
/// never collide with one.
extern NSString * const SFLBridgeErrorDomain;

/// Keys of the dictionaries returned by `+snapshotWithError:`.
extern NSString * const SFLItemIDKey;           ///< NSNumber wrapping a uint32_t. Always present.
extern NSString * const SFLItemDisplayNameKey;  ///< NSString. Always present (empty string if unnamed).
extern NSString * const SFLItemPathKey;         ///< NSString. ABSENT when the row cannot be resolved.
extern NSString * const SFLItemOSTypeKey;       ///< NSString. ABSENT when no override is set.

/// Failures that have no OSStatus of their own.
typedef NS_ENUM(NSInteger, SFLBridgeErrorCode) {
    SFLBridgeErrorCodeListUnavailable = 1,
    SFLBridgeErrorCodeSnapshotFailed  = 2,
    SFLBridgeErrorCodeItemNotFound    = 3,
    SFLBridgeErrorCodeInsertFailed    = 4,
    SFLBridgeErrorCodeInvalidOSType   = 5,
};

/// The only code in the project permitted to touch LSSharedFileList.
///
/// Every method creates its own list reference, takes its own snapshot, and holds
/// that snapshot alive until it returns — item references are owned by the
/// snapshot CFArray and using one after the array is released is an immediate
/// crash.
@interface SFLBridge : NSObject

/// Rows in list order.
///
/// Dictionary keys are `SFLItemIDKey`, `SFLItemDisplayNameKey`, `SFLItemPathKey`
/// (absent when unresolvable) and `SFLItemOSTypeKey` (absent when unset).
+ (nullable NSArray<NSDictionary<NSString *, id> *> *)snapshotWithError:(NSError **)error
    NS_SWIFT_NAME(snapshot());

/// Insert-or-patch.
///
/// When `url` is already in the list this is an IN-PLACE UPSERT: the row's
/// position and its persistent item ID are preserved while the display name and
/// the OSType override are updated (measured). Otherwise the row is appended.
///
/// The Favorites list de-duplicates by URL, so this can never produce a second
/// row for the same folder.
///
/// `name` must never be empty: passing no display name resets the row's label to
/// the folder's file-system name (measured).
///
/// `preexisting` reports whether this was a patch or a genuine insert, and it is
/// the ONLY trustworthy answer to that question: it is read from the snapshot the
/// insert itself anchors against, taken microseconds earlier under the same lock,
/// rather than from a snapshot the caller took at some earlier point in its pass.
/// On return it holds the row as it was immediately BEFORE the write (same keys as
/// `snapshotWithError:`) when the list already had one for `url`, and nil when the
/// row was genuinely created - or when the call failed, since nothing was written
/// then. Pass NULL when the answer is not needed.
///
/// The caller's ownership rule - only a row this app actually created may later be
/// renamed or deleted - rests on this value.
+ (BOOL)upsertURL:(NSURL *)url
      displayName:(NSString *)name
           osType:(NSString *)osType
      preexisting:(NSDictionary<NSString *, id> * _Nullable * _Nullable)preexisting
            error:(NSError **)error
    NS_SWIFT_NAME(upsert(url:displayName:osType:preexisting:));

/// Removes the OverrideIcon.OSType property while leaving the row otherwise intact.
///
/// Clearing goes exclusively through `LSSharedFileListInsertItemURL`'s
/// propertiesToClear array. `LSSharedFileListItemSetProperty(item, key, NULL)`
/// SIGSEGVs, so there is deliberately no API here that can clear a property that
/// way.
///
/// `name` MUST be the row's current display name — this call rewrites the label,
/// and omitting it resets the row to its file-system name (measured).
+ (BOOL)clearOSTypeForURL:(NSURL *)url
              displayName:(NSString *)name
                    error:(NSError **)error
    NS_SWIFT_NAME(clearOSType(url:displayName:));

/// Patches only the override property on an existing row, never its display name.
///
/// This is the adoption path: a row the user created keeps the name they gave it.
+ (BOOL)setOSType:(NSString *)osType
        forItemID:(uint32_t)itemID
            error:(NSError **)error
    NS_SWIFT_NAME(setOSType(_:itemID:));

/// Sets - or with a nil `osType`, clears - the icon override on the row for
/// `path` in Finder's **Locations** section.
///
/// Locations rows belong to Finder: it adds them when a volume mounts and prunes
/// them when it unmounts, so this only ever patches a row that is already there
/// and never inserts, removes or renames one. A volume that is not mounted (or a
/// row Finder marks as a special item, which stores an override but never draws
/// it) is reported as success with nothing done.
///
/// Re-setting the value a row already holds is what makes Finder repaint it, so
/// this is also the repair path for Locations.
///
/// `patched` reports whether a row was actually found and written. A mounted
/// **network share** has no row here at all - Finder synthesises its Locations
/// entry from the mount table - so the call succeeds having done nothing, and
/// only this flag distinguishes that from a real write.
+ (BOOL)setOSType:(nullable NSString *)osType
    forVolumePath:(NSString *)path
          patched:(BOOL *)patched
            error:(NSError **)error
    NS_SWIFT_NAME(setOSType(_:volumePath:patched:));

/// Removes a row by its persistent item ID. There is deliberately no
/// remove-by-path: the caller owns the decision about which rows may be deleted.
+ (BOOL)removeItemID:(uint32_t)itemID error:(NSError **)error
    NS_SWIFT_NAME(remove(itemID:));

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END

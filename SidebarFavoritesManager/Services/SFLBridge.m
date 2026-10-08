//
//  SFLBridge.m
//  SidebarFavoritesManager
//
//  Every LSSharedFileList* symbol is API_DEPRECATED(macos(10.5, 10.11)). Swift's
//  "enclosing declaration is deprecated" suppression does not end the warning, it
//  only relocates it to the wrapper's call site and cascades upward, so the whole
//  API lives in this one Objective-C file with the diagnostic disabled here and
//  nowhere else.
//

#import "SFLBridge.h"
#import <CoreServices/CoreServices.h>
#include <dlfcn.h>

#pragma clang diagnostic ignored "-Wdeprecated-declarations"

NSString * const SFLOverrideIconOSTypeKey = @"com.apple.LSSharedFileList.OverrideIcon.OSType";
NSString * const SFLBridgeErrorDomain     = @"com.ivg-design.SidebarFavorites.SFL";

NSString * const SFLItemIDKey          = @"itemID";
NSString * const SFLItemDisplayNameKey = @"displayName";
NSString * const SFLItemPathKey        = @"path";
NSString * const SFLItemRecordedPathKey = @"recordedPath";
NSString * const SFLItemOSTypeKey      = @"osType";

#pragma mark - Helpers

/// Populates `*error` and returns NO so callers can `return SFLFail(...)`.
static BOOL SFLFail(NSError **error, NSInteger code, NSString *description) {
    if (error != NULL) {
        *error = [NSError errorWithDomain:SFLBridgeErrorDomain
                                     code:code
                                 userInfo:@{ NSLocalizedDescriptionKey: description }];
    }
    return NO;
}

/// A fresh Favorites list reference. Created per call and released before returning;
/// the API is documented thread safe, and holding one across calls buys nothing.
static LSSharedFileListRef SFLCreateFavoritesList(void) {
    return LSSharedFileListCreate(NULL, kLSSharedFileListFavoriteItems, NULL);
}

/// The list behind Finder's **Locations** section.
///
/// Finder populates and prunes this itself as volumes mount and unmount - unlike
/// Favorites, rows are never ours and must never be inserted or removed. The only
/// safe operation is setting or clearing the icon override on a row that is
/// already there, which is why this list has no upsert path anywhere below.
static LSSharedFileListRef SFLCreateVolumesList(void) {
    return LSSharedFileListCreate(NULL, CFSTR("com.apple.LSSharedFileList.FavoriteVolumes"), NULL);
}

/// Resolves a row to a file-system path, or nil when the bookmark is stale.
///
/// kLSSharedFileListNoUserInteraction | kLSSharedFileListDoNotMountVolumes keeps a
/// dead network bookmark from blocking the call behind a mount attempt.
static NSString * _Nullable SFLResolvedPath(LSSharedFileListItemRef item) {
    CFURLRef resolved = NULL;
    OSStatus status = LSSharedFileListItemResolve(item,
                                                  kLSSharedFileListNoUserInteraction | kLSSharedFileListDoNotMountVolumes,
                                                  &resolved,
                                                  NULL);
    NSURL *url = (__bridge_transfer NSURL *)resolved;
    if (status != noErr || url == nil) {
        return nil;
    }
    return url.path;
}

static NSString * _Nullable SFLDisplayName(LSSharedFileListItemRef item) {
    return (__bridge_transfer NSString *)LSSharedFileListItemCopyDisplayName(item);
}

/// Reads the override property, accepting a string value only.
///
/// A non-string value (which this code never writes) is reported as "unset" so the
/// next reconcile rewrites it correctly instead of propagating a value that would
/// crash UniformTypeIdentifiers downstream.
static NSString * _Nullable SFLOSType(LSSharedFileListItemRef item) {
    CFTypeRef value = LSSharedFileListItemCopyProperty(item, (__bridge CFStringRef)SFLOverrideIconOSTypeKey);
    if (value == NULL) {
        return nil;
    }
    id boxed = (__bridge_transfer id)value;
    return [boxed isKindOfClass:[NSString class]] ? (NSString *)boxed : nil;
}

/// The path a row's bookmark was recorded with, read WITHOUT resolving it.
///
/// `SFLResolvedPath` answers nil whenever resolution fails - a volume that is not
/// mounted yet, a File Provider domain still starting up - and a row that cannot
/// be found is a row that gets inserted again. The list de-duplicates by URL, so
/// that "insert" lands on the user's own row and moves it to wherever the anchor
/// says (measured on macOS 26.6: an insert anchored after the last row moves an
/// existing row to the bottom and keeps its ID). The recorded path still says
/// which folder the row is for, which is all matching needs.
///
/// `LSSharedFileListItemCopyBookmarkData` is exported but undeclared. It takes the
/// item alone and returns a +1 CFData (measured: disassembly reads only x0; the
/// data parses as an ordinary bookmark). It is looked up at run time, so a macOS
/// without it degrades to resolution-only matching instead of failing to launch.
typedef CFDataRef _Nullable (*SFLCopyBookmarkDataFunction)(LSSharedFileListItemRef);

static NSString * _Nullable SFLRecordedPath(LSSharedFileListItemRef item) {
    static SFLCopyBookmarkDataFunction copyBookmarkData = NULL;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        copyBookmarkData = (SFLCopyBookmarkDataFunction)dlsym(RTLD_DEFAULT, "LSSharedFileListItemCopyBookmarkData");
    });
    if (copyBookmarkData == NULL) {
        return nil;
    }
    CFDataRef data = copyBookmarkData(item);
    if (data == NULL) {
        return nil;
    }
    id boxed = (__bridge_transfer id)data;
    if (![boxed isKindOfClass:[NSData class]]) {
        return nil;
    }
    NSDictionary<NSURLResourceKey, id> *values = [NSURL resourceValuesForKeys:@[ NSURLPathKey ]
                                                             fromBookmarkData:(NSData *)boxed];
    NSString *path = values[NSURLPathKey];
    return ([path isKindOfClass:[NSString class]] && path.length > 0) ? path : nil;
}

/// Where a row points: its resolved path, or failing that the recorded one.
///
/// The recorded path is only a fallback. A row that DOES resolve, but somewhere
/// else, is a folder that moved, and must not be matched to its old location.
static NSString * _Nullable SFLRowPath(LSSharedFileListItemRef item) {
    return SFLResolvedPath(item) ?: SFLRecordedPath(item);
}

/// True when two paths denote the same location.
///
/// Plain string equality is not enough: a bookmark can resolve through a different
/// but equivalent spelling of the same directory (measured: a row resolved to
/// /private/tmp/... while the caller held /tmp/...), and 0.6.0 users were told to
/// point favorites at symlinks into ~/Library/CloudStorage.
static BOOL SFLPathsMatch(NSString * _Nullable lhs, NSString * _Nullable rhs) {
    if (lhs == nil || rhs == nil) {
        return NO;
    }
    if ([lhs isEqualToString:rhs]) {
        return YES;
    }
    if ([lhs.stringByStandardizingPath isEqualToString:rhs.stringByStandardizingPath]) {
        return YES;
    }
    if ([lhs.stringByResolvingSymlinksInPath isEqualToString:rhs.stringByResolvingSymlinksInPath]) {
        return YES;
    }
    return NO;
}

/// Index of `url` within the snapshot, or -1 when the list has no row for it.
static CFIndex SFLIndexOfURL(CFArrayRef snapshot, NSURL *url) {
    NSString *wanted = url.path;
    CFIndex count = CFArrayGetCount(snapshot);
    for (CFIndex index = 0; index < count; index++) {
        LSSharedFileListItemRef item = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snapshot, index);
        if (SFLPathsMatch(SFLRowPath(item), wanted)) {
            return index;
        }
    }
    return -1;
}

/// The row to insert after.
///
/// NEVER kLSSharedFileListItemLast / kLSSharedFileListItemBeforeFirst: those globals
/// hold the bogus pointer values 0x2 and 0x1, which the modern framework dereferences
/// (measured on macOS 26.5.2). A NULL anchor is safe and means "before the first row"
/// (measured), which is exactly what preserves the position of a row already at
/// index 0 and is the only sensible anchor for an empty list.
static LSSharedFileListItemRef _Nullable SFLAnchorForIndex(CFArrayRef snapshot, CFIndex existingIndex) {
    CFIndex count = CFArrayGetCount(snapshot);
    if (existingIndex > 0) {
        // In-place upsert: anchoring on the preceding row keeps position and ID.
        return (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snapshot, existingIndex - 1);
    }
    if (existingIndex == 0) {
        // The row is already first; a NULL anchor keeps it there.
        return NULL;
    }
    // Not in the list yet: append.
    return count > 0 ? (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snapshot, count - 1) : NULL;
}

/// OSType tags are exactly four ASCII characters and are case-sensitive.
static BOOL SFLIsWellFormedOSType(NSString * _Nullable osType) {
    if (osType.length != 4) {
        return NO;
    }
    return [osType canBeConvertedToEncoding:NSASCIIStringEncoding];
}

@implementation SFLBridge

#pragma mark - Reading

+ (nullable NSArray<NSDictionary<NSString *, id> *> *)snapshotWithError:(NSError **)error {
    LSSharedFileListRef list = SFLCreateFavoritesList();
    if (list == NULL) {
        SFLFail(error, SFLBridgeErrorCodeListUnavailable, @"Finder's Favorites list is unavailable.");
        return nil;
    }

    UInt32 seed = 0;
    CFArrayRef snapshot = LSSharedFileListCopySnapshot(list, &seed);
    if (snapshot == NULL) {
        CFRelease(list);
        SFLFail(error, SFLBridgeErrorCodeSnapshotFailed, @"Couldn't read Finder's Favorites list.");
        return nil;
    }

    CFIndex count = CFArrayGetCount(snapshot);
    NSMutableArray<NSDictionary<NSString *, id> *> *rows = [NSMutableArray arrayWithCapacity:(NSUInteger)count];
    for (CFIndex index = 0; index < count; index++) {
        LSSharedFileListItemRef item = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snapshot, index);

        NSMutableDictionary<NSString *, id> *row = [NSMutableDictionary dictionaryWithCapacity:4];
        row[SFLItemIDKey] = @(LSSharedFileListItemGetID(item));

        NSString *path = SFLResolvedPath(item);
        if (path != nil) {
            row[SFLItemPathKey] = path;
        } else {
            NSString *recorded = SFLRecordedPath(item);
            if (recorded != nil) {
                row[SFLItemRecordedPathKey] = recorded;
            }
        }

        NSString *name = SFLDisplayName(item);
        row[SFLItemDisplayNameKey] = name ?: (path.lastPathComponent ?: @"");

        NSString *osType = SFLOSType(item);
        if (osType != nil) {
            row[SFLItemOSTypeKey] = osType;
        }

        [rows addObject:row];
    }

    // The snapshot owns every item ref used above; nothing escapes this scope.
    CFRelease(snapshot);
    CFRelease(list);
    return rows;
}

#pragma mark - Writing

+ (BOOL)upsertURL:(NSURL *)url
      displayName:(NSString *)name
           osType:(NSString *)osType
      preexisting:(NSDictionary<NSString *, id> * _Nullable * _Nullable)preexisting
            error:(NSError **)error {
    if (preexisting != NULL) {
        *preexisting = nil;
    }
    if (!SFLIsWellFormedOSType(osType)) {
        return SFLFail(error, SFLBridgeErrorCodeInvalidOSType,
                       [NSString stringWithFormat:@"'%@' is not a valid 4-character icon code.", osType]);
    }
    // The value is an NSString by construction. An NSNumber here crashes the caller
    // inside UniformTypeIdentifiers' isTagValid.
    return [self insertURL:url
               displayName:name
           propertiesToSet:@{ SFLOverrideIconOSTypeKey: osType }
         propertiesToClear:nil
               preexisting:preexisting
                     error:error];
}

+ (BOOL)clearOSTypeForURL:(NSURL *)url
              displayName:(NSString *)name
                    error:(NSError **)error {
    return [self insertURL:url
               displayName:name
           propertiesToSet:nil
         propertiesToClear:@[ SFLOverrideIconOSTypeKey ]
               preexisting:NULL
                     error:error];
}

/// Shared body of the two upsert entry points.
///
/// Deliberately does not report the item ID of the ref returned by
/// LSSharedFileListInsertItemURL: that ID is transient and can differ from the one
/// persisted for the row (measured 1421353828 vs the durable 2475624774). Callers
/// re-snapshot to learn the durable ID.
///
/// `preexisting` (optional) is filled from the same snapshot the anchor is picked
/// from, so it answers "was this a patch or a genuine insert?" for THIS write. The
/// index is computed either way to place the anchor; reporting it costs nothing and
/// is the only such answer that cannot have gone stale.
+ (BOOL)insertURL:(NSURL *)url
      displayName:(NSString *)name
  propertiesToSet:(nullable NSDictionary<NSString *, id> *)propertiesToSet
propertiesToClear:(nullable NSArray<NSString *> *)propertiesToClear
      preexisting:(NSDictionary<NSString *, id> * _Nullable * _Nullable)preexisting
            error:(NSError **)error {
    if (preexisting != NULL) {
        *preexisting = nil;
    }
    if (name.length == 0) {
        // A nil/empty display name resets the row's label to the folder's
        // file-system name (measured), which would silently rename adopted rows.
        return SFLFail(error, SFLBridgeErrorCodeInsertFailed,
                       @"A sidebar row cannot be written without a display name.");
    }

    LSSharedFileListRef list = SFLCreateFavoritesList();
    if (list == NULL) {
        return SFLFail(error, SFLBridgeErrorCodeListUnavailable, @"Finder's Favorites list is unavailable.");
    }

    UInt32 seed = 0;
    CFArrayRef snapshot = LSSharedFileListCopySnapshot(list, &seed);
    if (snapshot == NULL) {
        CFRelease(list);
        return SFLFail(error, SFLBridgeErrorCodeSnapshotFailed, @"Couldn't read Finder's Favorites list.");
    }

    CFIndex existingIndex = SFLIndexOfURL(snapshot, url);
    LSSharedFileListItemRef anchor = SFLAnchorForIndex(snapshot, existingIndex);

    // Read the row we are about to overwrite BEFORE overwriting it. Same shape as
    // a snapshotWithError: row, so the caller maps it with the same code.
    if (preexisting != NULL && existingIndex >= 0) {
        LSSharedFileListItemRef existing =
            (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snapshot, existingIndex);

        NSMutableDictionary<NSString *, id> *row = [NSMutableDictionary dictionaryWithCapacity:4];
        row[SFLItemIDKey] = @(LSSharedFileListItemGetID(existing));

        NSString *existingPath = SFLResolvedPath(existing);
        if (existingPath != nil) {
            row[SFLItemPathKey] = existingPath;
        } else {
            NSString *recorded = SFLRecordedPath(existing);
            if (recorded != nil) {
                row[SFLItemRecordedPathKey] = recorded;
            }
        }

        NSString *existingName = SFLDisplayName(existing);
        row[SFLItemDisplayNameKey] = existingName ?: (existingPath.lastPathComponent ?: @"");

        NSString *existingOSType = SFLOSType(existing);
        if (existingOSType != nil) {
            row[SFLItemOSTypeKey] = existingOSType;
        }

        *preexisting = row;
    }

    LSSharedFileListItemRef inserted = LSSharedFileListInsertItemURL(list,
                                                                     anchor,
                                                                     (__bridge CFStringRef)name,
                                                                     NULL,
                                                                     (__bridge CFURLRef)url,
                                                                     (__bridge CFDictionaryRef)propertiesToSet,
                                                                     (__bridge CFArrayRef)propertiesToClear);
    BOOL succeeded = (inserted != NULL);
    if (inserted != NULL) {
        CFRelease(inserted);
    }

    // Held until here: `anchor` and `inserted` are only valid while the snapshot is.
    CFRelease(snapshot);
    CFRelease(list);

    if (!succeeded) {
        // Nothing was written, so there is no "row as it was before the write" to
        // report: a failed call always leaves the out-parameter nil.
        if (preexisting != NULL) {
            *preexisting = nil;
        }
        return SFLFail(error, SFLBridgeErrorCodeInsertFailed,
                       [NSString stringWithFormat:@"Couldn't add '%@' to Finder's sidebar.", name]);
    }
    return YES;
}

/// Put the row for `url` straight after the row `anchorID`, or first when nil.
///
/// The repair for an insert that moved a row. Re-inserting a URL the list already
/// holds is an in-place update anchored wherever the caller says, so this moves the
/// row and keeps its persistent ID; with no properties passed, the row's icon
/// override is left exactly as it was (both measured on macOS 26.6).
+ (BOOL)placeURL:(NSURL *)url
     displayName:(NSString *)name
     afterItemID:(nullable NSNumber *)anchorID
           error:(NSError **)error {
    if (name.length == 0) {
        return SFLFail(error, SFLBridgeErrorCodeInsertFailed,
                       @"A sidebar row cannot be written without a display name.");
    }

    LSSharedFileListRef list = SFLCreateFavoritesList();
    if (list == NULL) {
        return SFLFail(error, SFLBridgeErrorCodeListUnavailable, @"Finder's Favorites list is unavailable.");
    }

    UInt32 seed = 0;
    CFArrayRef snapshot = LSSharedFileListCopySnapshot(list, &seed);
    if (snapshot == NULL) {
        CFRelease(list);
        return SFLFail(error, SFLBridgeErrorCodeSnapshotFailed, @"Couldn't read Finder's Favorites list.");
    }

    // Only ever a move: a URL with no row would be added, which is not this call's job.
    if (SFLIndexOfURL(snapshot, url) < 0) {
        CFRelease(snapshot);
        CFRelease(list);
        return SFLFail(error, SFLBridgeErrorCodeItemNotFound, @"That sidebar row is no longer in Finder's Favorites.");
    }

    LSSharedFileListItemRef anchor = NULL;
    if (anchorID != nil) {
        CFIndex count = CFArrayGetCount(snapshot);
        for (CFIndex index = 0; index < count; index++) {
            LSSharedFileListItemRef item = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snapshot, index);
            if (LSSharedFileListItemGetID(item) == anchorID.unsignedIntValue) {
                anchor = item;
                break;
            }
        }
        if (anchor == NULL) {
            CFRelease(snapshot);
            CFRelease(list);
            return SFLFail(error, SFLBridgeErrorCodeItemNotFound, @"The row this one belongs after is no longer in Finder's Favorites.");
        }
    }

    LSSharedFileListItemRef placed = LSSharedFileListInsertItemURL(list,
                                                                   anchor,
                                                                   (__bridge CFStringRef)name,
                                                                   NULL,
                                                                   (__bridge CFURLRef)url,
                                                                   NULL,
                                                                   NULL);
    BOOL succeeded = (placed != NULL);
    if (placed != NULL) {
        CFRelease(placed);
    }
    CFRelease(snapshot);
    CFRelease(list);

    if (!succeeded) {
        return SFLFail(error, SFLBridgeErrorCodeInsertFailed,
                       [NSString stringWithFormat:@"Couldn't move '%@' back to its place in Finder's sidebar.", name]);
    }
    return YES;
}

+ (BOOL)setOSType:(NSString *)osType
        forItemID:(uint32_t)itemID
            error:(NSError **)error {
    if (!SFLIsWellFormedOSType(osType)) {
        return SFLFail(error, SFLBridgeErrorCodeInvalidOSType,
                       [NSString stringWithFormat:@"'%@' is not a valid 4-character icon code.", osType]);
    }

    LSSharedFileListRef list = SFLCreateFavoritesList();
    if (list == NULL) {
        return SFLFail(error, SFLBridgeErrorCodeListUnavailable, @"Finder's Favorites list is unavailable.");
    }

    UInt32 seed = 0;
    CFArrayRef snapshot = LSSharedFileListCopySnapshot(list, &seed);
    if (snapshot == NULL) {
        CFRelease(list);
        return SFLFail(error, SFLBridgeErrorCodeSnapshotFailed, @"Couldn't read Finder's Favorites list.");
    }

    OSStatus status = noErr;
    BOOL found = NO;
    CFIndex count = CFArrayGetCount(snapshot);
    for (CFIndex index = 0; index < count; index++) {
        LSSharedFileListItemRef item = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snapshot, index);
        if (LSSharedFileListItemGetID(item) != itemID) {
            continue;
        }
        found = YES;
        // Never pass NULL as the value here — LSSharedFileListItemSetProperty
        // SIGSEGVs on it. Clearing goes through clearOSTypeForURL:displayName:.
        status = LSSharedFileListItemSetProperty(item,
                                                 (__bridge CFStringRef)SFLOverrideIconOSTypeKey,
                                                 (__bridge CFTypeRef)osType);
        break;
    }

    CFRelease(snapshot);
    CFRelease(list);

    if (!found) {
        return SFLFail(error, SFLBridgeErrorCodeItemNotFound, @"That sidebar row is no longer in Finder's Favorites.");
    }
    if (status != noErr) {
        return SFLFail(error, status,
                       [NSString stringWithFormat:@"Couldn't set the sidebar icon (error %d).", (int)status]);
    }
    return YES;
}

#pragma mark - Locations (FavoriteVolumes)

/// Row in Finder's Locations section matching `path`, or NULL.
///
/// Rows carrying a `SpecialItemIdentifier` are skipped: iCloud Drive, Computer,
/// AirDrop and the File Provider entries store an override happily and never draw
/// it (measured), so stamping one would report a success the user cannot see.
static LSSharedFileListItemRef SFLVolumeRowForPath(CFArrayRef snapshot, NSString *path) {
    CFIndex count = CFArrayGetCount(snapshot);
    for (CFIndex index = 0; index < count; index++) {
        LSSharedFileListItemRef item = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snapshot, index);

        CFTypeRef special = LSSharedFileListItemCopyProperty(item, CFSTR("com.apple.LSSharedFileList.SpecialItemIdentifier"));
        if (special != NULL) {
            CFRelease(special);
            continue;
        }

        NSString *resolved = SFLResolvedPath(item);
        if (resolved != nil && [resolved isEqualToString:path]) {
            return item;
        }
    }
    return NULL;
}

+ (BOOL)setOSType:(nullable NSString *)osType
    forVolumePath:(NSString *)path
         patched:(BOOL *)patched
            error:(NSError **)error {
    if (patched != NULL) { *patched = NO; }
    if (osType != nil && !SFLIsWellFormedOSType(osType)) {
        return SFLFail(error, SFLBridgeErrorCodeInvalidOSType,
                       [NSString stringWithFormat:@"'%@' is not a valid 4-character icon code.", osType]);
    }

    LSSharedFileListRef list = SFLCreateVolumesList();
    if (list == NULL) {
        return SFLFail(error, SFLBridgeErrorCodeListUnavailable, @"Finder's Locations list is unavailable.");
    }

    UInt32 seed = 0;
    CFArrayRef snapshot = LSSharedFileListCopySnapshot(list, &seed);
    if (snapshot == NULL) {
        CFRelease(list);
        return SFLFail(error, SFLBridgeErrorCodeSnapshotFailed, @"Couldn't read Finder's Locations list.");
    }

    LSSharedFileListItemRef row = SFLVolumeRowForPath(snapshot, path);
    OSStatus status = noErr;
    if (row != NULL) {
        // kCFNull is the documented "remove this" value here; passing NULL
        // SIGSEGVs, and unlike Favorites this list must never be re-inserted into.
        // Re-setting the SAME value is also what repaints a Locations row, so this
        // one call covers apply, repair and clear.
        status = LSSharedFileListItemSetProperty(row,
                                                 (__bridge CFStringRef)SFLOverrideIconOSTypeKey,
                                                 osType != nil ? (__bridge CFTypeRef)osType : (CFTypeRef)kCFNull);
    }

    CFRelease(snapshot);
    CFRelease(list);

    if (row == NULL) {
        // Not an error: the volume is not mounted, Finder is not showing it, or -
        // for a network server - Finder synthesises the row from the mount table
        // instead of storing one here, so there is nothing to patch. The caller
        // needs to know the difference, which is what `patched` reports.
        return YES;
    }
    if (patched != NULL) { *patched = (status == noErr); }
    if (status != noErr) {
        return SFLFail(error, status,
                       [NSString stringWithFormat:@"Couldn't set the Locations icon (error %d).", (int)status]);
    }
    return YES;
}

#pragma mark - Removing

+ (BOOL)removeItemID:(uint32_t)itemID error:(NSError **)error {
    LSSharedFileListRef list = SFLCreateFavoritesList();
    if (list == NULL) {
        return SFLFail(error, SFLBridgeErrorCodeListUnavailable, @"Finder's Favorites list is unavailable.");
    }

    UInt32 seed = 0;
    CFArrayRef snapshot = LSSharedFileListCopySnapshot(list, &seed);
    if (snapshot == NULL) {
        CFRelease(list);
        return SFLFail(error, SFLBridgeErrorCodeSnapshotFailed, @"Couldn't read Finder's Favorites list.");
    }

    OSStatus status = noErr;
    BOOL found = NO;
    CFIndex count = CFArrayGetCount(snapshot);
    for (CFIndex index = 0; index < count; index++) {
        LSSharedFileListItemRef item = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snapshot, index);
        if (LSSharedFileListItemGetID(item) != itemID) {
            continue;
        }
        found = YES;
        status = LSSharedFileListItemRemove(list, item);
        break;
    }

    CFRelease(snapshot);
    CFRelease(list);

    if (!found) {
        // Already gone — macOS auto-prunes rows whose target directory is deleted.
        return SFLFail(error, SFLBridgeErrorCodeItemNotFound, @"That sidebar row is no longer in Finder's Favorites.");
    }
    if (status != noErr) {
        return SFLFail(error, status,
                       [NSString stringWithFormat:@"Couldn't remove the sidebar row (error %d).", (int)status]);
    }
    return YES;
}

@end

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

#pragma clang diagnostic ignored "-Wdeprecated-declarations"

NSString * const SFLOverrideIconOSTypeKey = @"com.apple.LSSharedFileList.OverrideIcon.OSType";
NSString * const SFLBridgeErrorDomain     = @"com.ivg-design.SidebarFavorites.SFL";

NSString * const SFLItemIDKey          = @"itemID";
NSString * const SFLItemDisplayNameKey = @"displayName";
NSString * const SFLItemPathKey        = @"path";
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
        if (SFLPathsMatch(SFLResolvedPath(item), wanted)) {
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

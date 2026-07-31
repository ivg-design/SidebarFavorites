// sfl — swiss-army SharedFileList CLI for the sidebar icon investigation.
//
// Usage:
//   sfl dump <fav|vol> [--all]        dump list rows (--all = every property)
//   sfl set <fav|vol> <itemID> <key> <value>   setProperty (value "NULL" -> kCFNull)
//   sfl setcode <fav|vol> <itemID> <code>      shorthand for OverrideIcon.OSType
//   sfl clearprop <fav|vol> <itemID> <key>     set kCFNull
//   sfl upsert <fav|vol> <path> <name> [code]  in-place upsert anchored on preceding row
//   sfl add <fav|vol> <path> <name> [code]     append
//   sfl rm <fav|vol> <itemID>
//   sfl listprops <fav|vol>                    per-LIST properties
//   sfl setlistprop <fav|vol> <key> <value>
//   sfl watchrepair <path> <code> [--vol] [--fav]   FSEvents-driven re-stamp loop
#import <Foundation/Foundation.h>
#import <CoreServices/CoreServices.h>

#pragma clang diagnostic ignored "-Wdeprecated-declarations"

#define OVKEY CFSTR("com.apple.LSSharedFileList.OverrideIcon.OSType")

static LSSharedFileListRef makeList(const char *which) {
    if (strcmp(which, "vol") == 0)
        return LSSharedFileListCreate(NULL, CFSTR("com.apple.LSSharedFileList.FavoriteVolumes"), NULL);
    return LSSharedFileListCreate(NULL, kLSSharedFileListFavoriteItems, NULL);
}

static NSString *pathOf(LSSharedFileListItemRef it) {
    CFURLRef u = LSSharedFileListItemCopyResolvedURL(it,
        kLSSharedFileListNoUserInteraction | kLSSharedFileListDoNotMountVolumes, NULL);
    if (!u) return nil;
    NSString *p = [(__bridge NSURL *)u path];
    NSString *r = [p copy];
    CFRelease(u);
    return r;
}

static LSSharedFileListItemRef findByID(CFArrayRef snap, UInt32 target) {
    for (CFIndex i = 0; i < CFArrayGetCount(snap); i++) {
        LSSharedFileListItemRef it = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snap, i);
        if (LSSharedFileListItemGetID(it) == target) return it;
    }
    return NULL;
}

static NSArray *kProbeKeys(void) {
    return @[@"com.apple.LSSharedFileList.ApplicationRecentDocuments",
             @"com.apple.LSSharedFileList.AutomountedServers",
             @"com.apple.LSSharedFileList.Binding",
             @"com.apple.LSSharedFileList.DockApplications",
             @"com.apple.LSSharedFileList.FavoriteItems",
             @"com.apple.LSSharedFileList.FavoriteServers",
             @"com.apple.LSSharedFileList.FavoriteVolumes",
             @"com.apple.LSSharedFileList.FavoriteVolumes.ComputerIsVisible",
             @"com.apple.LSSharedFileList.FavoriteVolumes.iCloudDriveIsVisible",
             @"com.apple.LSSharedFileList.FavoriteVolumes.ICloudDriveIsVisible",
             @"com.apple.LSSharedFileList.FavoriteVolumes.iDiskIsVisible",
             @"com.apple.LSSharedFileList.FavoriteVolumes.NetworkIsVisible",
             @"com.apple.LSSharedFileList.FavoriteVolumes.ShowEjectableVolumes",
             @"com.apple.LSSharedFileList.FavoriteVolumes.ShowEjectableVolumesExceptions",
             @"com.apple.LSSharedFileList.FavoriteVolumes.ShowHardDrives",
             @"com.apple.LSSharedFileList.FavoriteVolumes.ShowHardDrivesExceptions",
             @"com.apple.LSSharedFileList.FavoriteVolumes.ShowNetworkVolumes",
             @"com.apple.LSSharedFileList.FavoriteVolumes.ShowNetworkVolumesExceptions",
             @"com.apple.LSSharedFileList.FavoriteVolumes.ShowRepairing",
             @"com.apple.LSSharedFileList.ForceTemplateIcons",
             @"com.apple.LSSharedFileList.GlobalLoginItems",
             @"com.apple.LSSharedFileList.iCloudItems",
             @"com.apple.LSSharedFileList.IsCloudStorage",
             @"com.apple.LSSharedFileList.IsComputer",
             @"com.apple.LSSharedFileList.IsEjectableVolume",
             @"com.apple.LSSharedFileList.IsHome",
             @"com.apple.LSSharedFileList.IsICloudDrive",
             @"com.apple.LSSharedFileList.IsIDisk",
             @"com.apple.LSSharedFileList.IsMeetingRoom",
             @"com.apple.LSSharedFileList.IsMobileDevice",
             @"com.apple.LSSharedFileList.IsMobileTimeMachine",
             @"com.apple.LSSharedFileList.IsNetwork",
             @"com.apple.LSSharedFileList.IsRemoteDisc",
             @"com.apple.LSSharedFileList.IsShared",
             @"com.apple.LSSharedFileList.IsTrash",
             @"com.apple.LSSharedFileList.IsVideoDisc",
             @"com.apple.LSSharedFileList.ItemAddedViaAPI",
             @"com.apple.LSSharedFileList.ItemIsHidden",
             @"com.apple.LSSharedFileList.ItemIsLocked",
             @"com.apple.LSSharedFileList.ItemIsManaged",
             @"com.apple.LSSharedFileList.ItemIsPersistent",
             @"com.apple.LSSharedFileList.ManagedSessionLoginItems",
             @"com.apple.LSSharedFileList.ManagedShared",
             @"com.apple.LSSharedFileList.MaxAmount",
             @"com.apple.LSSharedFileList.NetworkBrowser",
             @"com.apple.LSSharedFileList.OverrideIcon.OSType",
             @"com.apple.LSSharedFileList.ProjectsItems",
             @"com.apple.LSSharedFileList.RecentApplications",
             @"com.apple.LSSharedFileList.RecentApplications.sfl",
             @"com.apple.LSSharedFileList.RecentDocuments",
             @"com.apple.LSSharedFileList.RecentDocuments.sfl",
             @"com.apple.LSSharedFileList.RecentHosts",
             @"com.apple.LSSharedFileList.RecentServers",
             @"com.apple.LSSharedFileList.RepairedVolume",
             @"com.apple.LSSharedFileList.Restricted.Sharing.FileSecurity",
             @"com.apple.LSSharedFileList.Restricted.Sharing.FSProperties",
             @"com.apple.LSSharedFileList.Restricted.Sharing.OnWritableVolume",
             @"com.apple.LSSharedFileList.Restricted.Sharing.Owner",
             @"com.apple.LSSharedFileList.Restricted.Sharing.VolumeSupportsPerms",
             @"com.apple.LSSharedFileList.SavedSearches",
             @"com.apple.LSSharedFileList.SessionLoginItems",
             @"com.apple.LSSharedFileList.SFLLaunchdJobs",
             @"com.apple.LSSharedFileList.SFLServiceManagementLoginItems",
             @"com.apple.LSSharedFileList.SharePoints",
             @"com.apple.LSSharedFileList.SpecialItemIdentifier",
             @"com.apple.LSSharedFileList.TargetIsDirectory",
             @"com.apple.LSSharedFileList.TargetIsVolume",
             @"com.apple.LSSharedFileList.TargetName",
             @"com.apple.LSSharedFileList.TopSidebarSection",
             @"com.apple.LSSharedFileList.VolumeRefNum"];
}

static void dumpList(const char *which, BOOL all) {
    LSSharedFileListRef list = makeList(which);
    if (!list) { fprintf(stderr, "no list\n"); exit(1); }
    UInt32 seed = 0;
    CFArrayRef snap = LSSharedFileListCopySnapshot(list, &seed);
    if (!snap) { fprintf(stderr, "no snapshot\n"); exit(1); }
    for (CFIndex i = 0; i < CFArrayGetCount(snap); i++) {
        LSSharedFileListItemRef it = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snap, i);
        CFStringRef name = LSSharedFileListItemCopyDisplayName(it);
        CFTypeRef code = LSSharedFileListItemCopyProperty(it, OVKEY);
        CFTypeRef spec = LSSharedFileListItemCopyProperty(it,
            CFSTR("com.apple.LSSharedFileList.SpecialItemIdentifier"));
        printf("[%ld] %u | name='%s' | code=%s | special=%s | path=%s\n",
               (long)i, (unsigned)LSSharedFileListItemGetID(it),
               name ? [(__bridge NSString *)name UTF8String] : "(nil)",
               code ? [[NSString stringWithFormat:@"%@", code] UTF8String] : "-",
               spec ? [[NSString stringWithFormat:@"%@", spec] UTF8String] : "-",
               pathOf(it) ? [pathOf(it) UTF8String] : "(unresolved)");
        if (all) {
            for (NSString *k in kProbeKeys()) {
                CFTypeRef v = LSSharedFileListItemCopyProperty(it, (__bridge CFStringRef)k);
                if (v) {
                    printf("      %s = %s\n", [k UTF8String],
                           [[NSString stringWithFormat:@"%@", v] UTF8String]);
                    CFRelease(v);
                }
            }
        }
        if (name) CFRelease(name);
        if (code) CFRelease(code);
        if (spec) CFRelease(spec);
    }
    CFRelease(snap);
    CFRelease(list);
}

static int doSet(const char *which, UInt32 id_, NSString *key, NSString *val) {
    LSSharedFileListRef list = makeList(which);
    UInt32 seed = 0;
    CFArrayRef snap = LSSharedFileListCopySnapshot(list, &seed);
    LSSharedFileListItemRef it = findByID(snap, id_);
    if (!it) { fprintf(stderr, "item %u not found\n", (unsigned)id_); return 1; }
    CFTypeRef v;
    if ([val isEqualToString:@"NULL"]) v = kCFNull;
    else if ([val isEqualToString:@"true"]) v = kCFBooleanTrue;
    else if ([val isEqualToString:@"false"]) v = kCFBooleanFalse;
    else v = (__bridge CFTypeRef)val;
    OSStatus st = LSSharedFileListItemSetProperty(it, (__bridge CFStringRef)key, v);
    printf("setProperty(%u, %s, %s) -> %d\n", (unsigned)id_, [key UTF8String], [val UTF8String], (int)st);
    CFRelease(snap);
    CFRelease(list);
    return st == noErr ? 0 : 1;
}

// In-place upsert: anchor on the preceding row so position + item ID survive.
static int doUpsert(const char *which, NSString *path, NSString *name, NSString *code, BOOL append) {
    LSSharedFileListRef list = makeList(which);
    NSURL *url = [NSURL fileURLWithPath:path];
    UInt32 seed = 0;
    CFArrayRef snap = LSSharedFileListCopySnapshot(list, &seed);
    LSSharedFileListItemRef anchor = kLSSharedFileListItemLast;
    if (!append) {
        for (CFIndex i = 0; i < CFArrayGetCount(snap); i++) {
            LSSharedFileListItemRef it = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snap, i);
            NSString *p = pathOf(it);
            if (p && [p isEqualToString:url.path]) {
                anchor = (i > 0) ? (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snap, i-1)
                                 : kLSSharedFileListItemBeforeFirst;
                break;
            }
        }
    }
    NSDictionary *props = code.length ? @{ @"com.apple.LSSharedFileList.OverrideIcon.OSType": code } : nil;
    LSSharedFileListItemRef item = LSSharedFileListInsertItemURL(
        list, anchor, (__bridge CFStringRef)name, NULL,
        (__bridge CFURLRef)url, (__bridge CFDictionaryRef)props, NULL);
    printf("upsert %s -> %s", [path UTF8String], item ? "ok" : "FAILED");
    if (item) { printf(" itemID=%u", (unsigned)LSSharedFileListItemGetID(item)); CFRelease(item); }
    printf("\n");
    CFRelease(snap);
    CFRelease(list);
    return item ? 0 : 1;
}

static int doRemove(const char *which, UInt32 id_) {
    LSSharedFileListRef list = makeList(which);
    UInt32 seed = 0;
    CFArrayRef snap = LSSharedFileListCopySnapshot(list, &seed);
    LSSharedFileListItemRef it = findByID(snap, id_);
    if (!it) { fprintf(stderr, "item %u not found\n", (unsigned)id_); return 1; }
    OSStatus st = LSSharedFileListItemRemove(list, it);
    printf("remove %u -> %d\n", (unsigned)id_, (int)st);
    CFRelease(snap); CFRelease(list);
    return 0;
}

static void listProps(const char *which) {
    LSSharedFileListRef list = makeList(which);
    CFTypeRef v;
    NSArray *keys = @[@"com.apple.LSSharedFileList.ForceTemplateIcons",
                      @"com.apple.LSSharedFileList.FavoriteVolumes.ShowEjectableVolumes",
                      @"com.apple.LSSharedFileList.FavoriteVolumes.ShowRemovableVolumes",
                      @"com.apple.LSSharedFileList.FavoriteVolumes.ShowHardDisks",
                      @"com.apple.LSSharedFileList.ShowsSpecialItems"];
    for (NSString *k in keys) {
        v = LSSharedFileListCopyProperty(list, (__bridge CFStringRef)k);
        if (v) { printf("%s = %s\n", [k UTF8String], [[NSString stringWithFormat:@"%@", v] UTF8String]); CFRelease(v); }
        else printf("%s = (absent)\n", [k UTF8String]);
    }
    CFRelease(list);
}

// ---- watchrepair: FSEvents on the target; re-stamp Favorites (upsert) + Locations (setProperty)
static NSString *gPath, *gCode;
static BOOL gDoFav = YES, gDoVol = YES;
static NSUInteger gRepairs = 0, gEvents = 0;
static dispatch_source_t gTimer;

static void repairNow(void) {
    gRepairs++;
    NSDate *t0 = [NSDate date];
    if (gDoFav) {
        // find live display name
        LSSharedFileListRef list = makeList("fav");
        UInt32 seed = 0; CFArrayRef snap = LSSharedFileListCopySnapshot(list, &seed);
        NSString *nm = [gPath lastPathComponent];
        for (CFIndex i = 0; i < CFArrayGetCount(snap); i++) {
            LSSharedFileListItemRef it = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snap, i);
            NSString *p = pathOf(it);
            if (p && [p isEqualToString:gPath]) {
                CFStringRef n = LSSharedFileListItemCopyDisplayName(it);
                if (n) { nm = [(__bridge NSString *)n copy]; CFRelease(n); }
                break;
            }
        }
        CFRelease(snap); CFRelease(list);
        doUpsert("fav", gPath, nm, gCode, NO);
    }
    if (gDoVol) {
        LSSharedFileListRef list = makeList("vol");
        UInt32 seed = 0; CFArrayRef snap = LSSharedFileListCopySnapshot(list, &seed);
        for (CFIndex i = 0; i < CFArrayGetCount(snap); i++) {
            LSSharedFileListItemRef it = (LSSharedFileListItemRef)CFArrayGetValueAtIndex(snap, i);
            NSString *p = pathOf(it);
            if (p && [p isEqualToString:gPath]) {
                OSStatus st = LSSharedFileListItemSetProperty(it, OVKEY, (__bridge CFStringRef)gCode);
                printf("  vol restamp id=%u -> %d\n", (unsigned)LSSharedFileListItemGetID(it), (int)st);
            }
        }
        CFRelease(snap); CFRelease(list);
    }
    printf("REPAIR #%lu events=%lu took=%.1fms at %s\n", (unsigned long)gRepairs, (unsigned long)gEvents,
           -[t0 timeIntervalSinceNow]*1000.0,
           [[[NSDate date] description] UTF8String]);
    fflush(stdout);
}

static void fsCallback(ConstFSEventStreamRef s, void *info, size_t n, void *paths,
                       const FSEventStreamEventFlags flags[], const FSEventStreamEventId ids[]) {
    gEvents += n;
    printf("EVENT n=%zu total=%lu\n", n, (unsigned long)gEvents); fflush(stdout);
    // debounce 250ms
    if (gTimer) dispatch_source_cancel(gTimer);
    gTimer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());
    dispatch_source_set_timer(gTimer, dispatch_time(DISPATCH_TIME_NOW, 250*NSEC_PER_MSEC),
                              DISPATCH_TIME_FOREVER, 20*NSEC_PER_MSEC);
    dispatch_source_set_event_handler(gTimer, ^{ repairNow(); });
    dispatch_resume(gTimer);
}

int main(int argc, char *argv[]) {
    @autoreleasepool {
        if (argc < 2) { fprintf(stderr, "see source for usage\n"); return 2; }
        const char *cmd = argv[1];
        if (strcmp(cmd, "dump") == 0) {
            dumpList(argv[2], argc > 3 && strcmp(argv[3], "--all") == 0);
            return 0;
        }
        if (strcmp(cmd, "listprops") == 0) { listProps(argv[2]); return 0; }
        if (strcmp(cmd, "set") == 0)
            return doSet(argv[2], (UInt32)strtoul(argv[3], NULL, 10), @(argv[4]), @(argv[5]));
        if (strcmp(cmd, "setcode") == 0)
            return doSet(argv[2], (UInt32)strtoul(argv[3], NULL, 10),
                         @"com.apple.LSSharedFileList.OverrideIcon.OSType", @(argv[4]));
        if (strcmp(cmd, "clearprop") == 0)
            return doSet(argv[2], (UInt32)strtoul(argv[3], NULL, 10), @(argv[4]), @"NULL");
        if (strcmp(cmd, "upsert") == 0)
            return doUpsert(argv[2], @(argv[3]), @(argv[4]), argc > 5 ? @(argv[5]) : nil, NO);
        if (strcmp(cmd, "add") == 0)
            return doUpsert(argv[2], @(argv[3]), @(argv[4]), argc > 5 ? @(argv[5]) : nil, YES);
        if (strcmp(cmd, "rm") == 0)
            return doRemove(argv[2], (UInt32)strtoul(argv[3], NULL, 10));
        if (strcmp(cmd, "watchrepair") == 0) {
            gPath = @(argv[2]); gCode = @(argv[3]);
            for (int i = 4; i < argc; i++) {
                if (strcmp(argv[i], "--vol-only") == 0) gDoFav = NO;
                if (strcmp(argv[i], "--fav-only") == 0) gDoVol = NO;
            }
            CFStringRef p = (__bridge CFStringRef)gPath;
            CFArrayRef pa = CFArrayCreate(NULL, (const void **)&p, 1, &kCFTypeArrayCallBacks);
            FSEventStreamContext ctx = {0};
            FSEventStreamRef st = FSEventStreamCreate(NULL, &fsCallback, &ctx, pa,
                kFSEventStreamEventIdSinceNow, 0.05,
                kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagNoDefer |
                kFSEventStreamCreateFlagWatchRoot);
            FSEventStreamSetDispatchQueue(st, dispatch_get_main_queue());
            FSEventStreamStart(st);
            printf("watching %s code=%s fav=%d vol=%d\n", argv[2], argv[3], gDoFav, gDoVol);
            fflush(stdout);
            dispatch_main();
        }
        fprintf(stderr, "unknown cmd %s\n", cmd);
        return 2;
    }
}

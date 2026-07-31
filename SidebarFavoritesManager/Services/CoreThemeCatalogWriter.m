//
//  CoreThemeCatalogWriter.m
//  SidebarFavoritesManager
//

#import "CoreThemeCatalogWriter.h"
#import <AppKit/AppKit.h>
#import <dlfcn.h>
#import <objc/message.h>
#import <objc/runtime.h>

// Every selector here belongs to a private framework, so none of them are
// declared anywhere the compiler can see. That is the point of the runtime
// lookups below, and warning about it once per call site buries real warnings.
#pragma clang diagnostic ignored "-Wundeclared-selector"

NSString * const CoreThemeCatalogWriterErrorDomain = @"com.ivg-design.SidebarFavorites.CoreThemeCatalogWriter";

/// Constants read out of the engine's own tables. Named here rather than inline
/// so a future OS that changes one is a one-line diff.
static const long long kPlatformMacOS          = 0;     // CoreThemeDocument platform id
static const long long kRenditionTypeVectorGlyph = 1017; // kCUIRenditionTypeVectorGlyph
static const long long kIdiomUniversal         = 0;
static const long long kVectorGlyphRenderingAutomatic = 0;
static const long long kSymbolWeightRegular    = 4;
static const long long kSymbolSizeRegular      = 2;
static NSString * const kDeploymentVersion     = @"13.0";
static NSString * const kDeploymentPlatform    = @"macosx";

static BOOL SFLFailWriter(NSError **error, NSString *description) {
    if (error != NULL) {
        *error = [NSError errorWithDomain:CoreThemeCatalogWriterErrorDomain
                                     code:1
                                 userInfo:@{ NSLocalizedDescriptionKey: description }];
    }
    return NO;
}

/// Loads CoreThemeDefinition once. CoreUI comes along as a dependency.
static BOOL SFLLoadEngine(void) {
    static BOOL loaded = NO;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        loaded = dlopen("/System/Library/PrivateFrameworks/CoreThemeDefinition.framework/CoreThemeDefinition",
                        RTLD_NOW) != NULL;
    });
    return loaded;
}

/// How long the whole compile may take before it is abandoned.
static const NSTimeInterval kCompileTimeout = 120.0;

@implementation CoreThemeCatalogWriter

+ (BOOL)isAvailable {
    if (!SFLLoadEngine()) { return NO; }

    Class document = objc_getClass("CoreThemeDocument");
    Class importInfo = objc_getClass("TDNamedAssetImportInfo");
    Class distiller = objc_getClass("TDDistiller");
    Class reader = objc_getClass("TDVectorGlyphReader");
    if (document == Nil || importInfo == Nil || distiller == Nil || reader == Nil) { return NO; }

    // Shape check: every selector this file sends, asked for by name. A rename in
    // a future macOS turns the whole route off instead of crashing.
    return [document respondsToSelector:@selector(createConfiguredDocumentAtURL:targetPlatform:error:)]
        && [reader respondsToSelector:@selector(vectorGlyphReaderWithURL:platform:error:)]
        && [importInfo instancesRespondToSelector:@selector(setRenditionType:)]
        && [distiller instancesRespondToSelector:@selector(saveAndDistillWithCompletionHandler:)];
}

+ (nullable NSString *)validationFailureForTemplateAtURL:(NSURL *)templateURL {
    if (!SFLLoadEngine()) { return @"The system's icon compiler is unavailable."; }

    Class reader = objc_getClass("TDVectorGlyphReader");
    if (reader == Nil) { return @"The system's icon compiler is unavailable."; }

    NSError *readerError = nil;
    id instance = ((id (*)(id, SEL, id, long long, NSError **))objc_msgSend)(
        reader, @selector(vectorGlyphReaderWithURL:platform:error:),
        templateURL, kPlatformMacOS, &readerError);

    if (instance == nil) {
        return readerError.localizedDescription ?: @"This artwork could not be read as a symbol template.";
    }

    // A reader that cannot draw the regular weight produces a symbol that resolves
    // to nothing at runtime, which is the silent-drop case.
    if ([instance respondsToSelector:@selector(canDrawWithWeight:size:)]) {
        BOOL drawable = ((BOOL (*)(id, SEL, long long, long long))objc_msgSend)(
            instance, @selector(canDrawWithWeight:size:), kSymbolWeightRegular, kSymbolSizeRegular);
        if (!drawable) {
            return @"This artwork has no drawable geometry at the regular weight.";
        }
    }

    return nil;
}

+ (BOOL)writeCatalogAtURL:(NSURL *)destinationURL
                  symbols:(NSDictionary<NSString *, NSURL *> *)symbols
      scratchDirectoryURL:(NSURL *)scratchDirectoryURL
                    error:(NSError **)error {
    if (symbols.count == 0) {
        return SFLFailWriter(error, @"No symbols to compile.");
    }
    if (!self.isAvailable) {
        return SFLFailWriter(error, @"The system's icon compiler is unavailable on this version of macOS.");
    }

    // MUST be called off the main thread.
    //
    // The engine is document-based and delivers both of its completion handlers
    // ON THE MAIN QUEUE. Occupying the main thread and waiting there - however the
    // waiting is done - stops the queue that has to deliver the answer, so the
    // work is started on the main queue from here and waited for on this thread.
    // (Measured: the earlier main-thread version simply timed out every time.)
    if ([NSThread isMainThread]) {
        return SFLFailWriter(error, @"Icons cannot be compiled on the main thread.");
    }

    dispatch_semaphore_t finished = dispatch_semaphore_create(0);
    __block BOOL succeeded = NO;
    __block NSError *failure = nil;

    dispatch_async(dispatch_get_main_queue(), ^{
        [self buildWithSymbols:symbols
                destinationURL:destinationURL
           scratchDirectoryURL:scratchDirectoryURL
                    completion:^(BOOL ok, NSError *buildError) {
            succeeded = ok;
            failure = buildError;
            dispatch_semaphore_signal(finished);
        }];
    });

    if (dispatch_semaphore_wait(finished,
                                dispatch_time(DISPATCH_TIME_NOW,
                                              (int64_t)(kCompileTimeout * NSEC_PER_SEC))) != 0) {
        return SFLFailWriter(error, @"Compiling the icons timed out.");
    }

    if (!succeeded) {
        if (error != NULL) {
            *error = failure ?: [NSError errorWithDomain:CoreThemeCatalogWriterErrorDomain
                                                    code:1
                                                userInfo:@{ NSLocalizedDescriptionKey: @"The icon catalog could not be compiled." }];
        }
        return NO;
    }
    return YES;
}

/// Main-queue half of the compile: import, distill, install. Every step hands off
/// through a callback rather than waiting, so the queue stays free to deliver the
/// engine's own callbacks.
+ (void)buildWithSymbols:(NSDictionary<NSString *, NSURL *> *)symbols
          destinationURL:(NSURL *)destinationURL
     scratchDirectoryURL:(NSURL *)scratchDirectoryURL
              completion:(void (^)(BOOL, NSError * _Nullable))completion {
    NSFileManager *fileManager = NSFileManager.defaultManager;

    // The document writes a `.cotd` plus a sibling `-Artwork` directory, so it
    // gets a directory of its own that is torn down on every exit path.
    NSURL *workURL = [scratchDirectoryURL URLByAppendingPathComponent:NSUUID.UUID.UUIDString];
    NSError *setupError = nil;
    if (![fileManager createDirectoryAtURL:workURL withIntermediateDirectories:YES attributes:nil error:&setupError]) {
        completion(NO, setupError);
        return;
    }

    void (^finish)(BOOL, NSString *) = ^(BOOL ok, NSString *message) {
        [fileManager removeItemAtURL:workURL error:NULL];
        NSError *wrapped = nil;
        if (!ok) {
            wrapped = [NSError errorWithDomain:CoreThemeCatalogWriterErrorDomain
                                          code:1
                                      userInfo:@{ NSLocalizedDescriptionKey: message ?: @"The icons could not be compiled." }];
        }
        completion(ok, wrapped);
    };

    NSURL *documentURL = [workURL URLByAppendingPathComponent:@"catalog.cotd"];
    NSError *documentError = nil;
    id document = ((id (*)(id, SEL, id, long long, NSError **))objc_msgSend)(
        objc_getClass("CoreThemeDocument"),
        @selector(createConfiguredDocumentAtURL:targetPlatform:error:),
        documentURL, kPlatformMacOS, &documentError);

    if (document == nil) {
        finish(NO, documentError.localizedDescription ?: @"The icon catalog document could not be created.");
        return;
    }

    if ([document respondsToSelector:@selector(setMinimumDeploymentVersion:)]) {
        ((void (*)(id, SEL, id))objc_msgSend)(document, @selector(setMinimumDeploymentVersion:), kDeploymentVersion);
    }

    NSMutableArray *infos = [NSMutableArray arrayWithCapacity:symbols.count];
    Class importInfoClass = objc_getClass("TDNamedAssetImportInfo");
    for (NSString *name in symbols) {
        id info = [[importInfoClass alloc] init];
        ((void (*)(id, SEL, id))objc_msgSend)(info, @selector(setName:), name);
        ((void (*)(id, SEL, id))objc_msgSend)(info, @selector(setFileURL:), symbols[name]);
        ((void (*)(id, SEL, long long))objc_msgSend)(info, @selector(setRenditionType:), kRenditionTypeVectorGlyph);
        ((void (*)(id, SEL, unsigned long long))objc_msgSend)(info, @selector(setScaleFactor:), 1ULL);
        ((void (*)(id, SEL, long long))objc_msgSend)(info, @selector(setIdiom:), kIdiomUniversal);
        if ([info respondsToSelector:@selector(setVectorGlyphRenderingMode:)]) {
            ((void (*)(id, SEL, long long))objc_msgSend)(info, @selector(setVectorGlyphRenderingMode:), kVectorGlyphRenderingAutomatic);
        }
        [infos addObject:info];
    }

    NSURL *stagedURL = [workURL URLByAppendingPathComponent:@"Assets.car"];

    // The completion handler takes a BOOL. Declaring it as an object and retaining
    // the argument crashes on a tagged non-pointer value.
    void (^importHandler)(BOOL) = ^(BOOL imported) {
        if (!imported) {
            finish(NO, @"The icon artwork could not be imported.");
            return;
        }

        id distiller = [[objc_getClass("TDDistiller") alloc] init];
        distiller = ((id (*)(id, SEL, id, id, id))objc_msgSend)(
            distiller, @selector(initWithDocument:outputPath:versionString:),
            document, stagedURL.path, kDeploymentVersion);
        if (distiller == nil) {
            finish(NO, @"The icon catalog compiler could not be started.");
            return;
        }

        if ([distiller respondsToSelector:@selector(setDeploymentPlatform:)]) {
            ((void (*)(id, SEL, id))objc_msgSend)(distiller, @selector(setDeploymentPlatform:), kDeploymentPlatform);
        }
        if ([distiller respondsToSelector:@selector(setDeploymentPlatformVersion:)]) {
            ((void (*)(id, SEL, id))objc_msgSend)(distiller, @selector(setDeploymentPlatformVersion:), kDeploymentVersion);
        }

        void (^distillHandler)(BOOL) = ^(BOOL distilledOK) {
            (void)distilledOK;
            BOOL produced = [NSFileManager.defaultManager fileExistsAtPath:stagedURL.path];
            if ([distiller respondsToSelector:@selector(isSuccessful)]) {
                produced = produced && ((BOOL (*)(id, SEL))objc_msgSend)(distiller, @selector(isSuccessful));
            }
            if (!produced) {
                NSString *detail = nil;
                if ([distiller respondsToSelector:@selector(accumulatedErrorDescription)]) {
                    detail = ((id (*)(id, SEL))objc_msgSend)(distiller, @selector(accumulatedErrorDescription));
                }
                finish(NO, detail.length > 0 ? detail : @"The icons could not be compiled.");
                return;
            }

            // Only now is the previously compiled catalog replaced: a failure above
            // must leave the bundle exactly as it was.
            NSFileManager *fm = NSFileManager.defaultManager;
            [fm removeItemAtURL:destinationURL error:NULL];
            NSError *moveError = nil;
            if (![fm moveItemAtURL:stagedURL toURL:destinationURL error:&moveError]) {
                finish(NO, moveError.localizedDescription ?: @"The compiled icons could not be installed.");
                return;
            }
            finish(YES, nil);
        };

        ((void (*)(id, SEL, id))objc_msgSend)(distiller, @selector(saveAndDistillWithCompletionHandler:), distillHandler);
    };

    ((void (*)(id, SEL, id, BOOL, id))objc_msgSend)(
        document, @selector(importNamedAssetsWithImportInfos:referenceFiles:completionHandler:),
        infos, NO, importHandler);
}

@end

#import <AppKit/AppKit.h>
#import <ScreenSaver/ScreenSaver.h>

// macOS exposes these extension-host classes but omits public declarations.
// Kept isolated here so an OS compatibility update does not affect the renderer.
@interface ScreenSaverExtension : NSObject
@end
@interface ScreenSaverViewController : NSViewController
@end
extern int NSExtensionMain(int argc, char * _Nullable * _Nonnull argv);

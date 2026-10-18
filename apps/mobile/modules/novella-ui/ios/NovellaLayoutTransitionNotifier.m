#import <UIKit/UIKit.h>
#import <objc/runtime.h>

/// Posted on the main thread right before a view-controller size transition
/// starts: rotation, a fold/unfold display change, or an iPad window resize.
/// The Expo module forwards it to JS so the app can cover the surface before
/// the new layout is applied.
NSNotificationName const NovellaLayoutWillChangeNotification =
    @"NovellaLayoutWillChangeNotification";

/// Posted when UIKit finishes (or cancels) the size transition, so the cover
/// can fade out on the real end instead of guessing a duration.
NSNotificationName const NovellaLayoutDidChangeNotification =
    @"NovellaLayoutDidChangeNotification";

typedef void (*NovellaViewWillTransitionIMP)(
    id, SEL, CGSize, id<UIViewControllerTransitionCoordinator>);

static NovellaViewWillTransitionIMP NovellaOriginalViewWillTransition = NULL;

/// Whether this call is a window size transition or just UIKit sizing a
/// presented hierarchy.
///
/// Presenting a popover (the reading-settings panels) or a sheet walks the
/// presented controller through the same method so its content can adapt. That
/// call carries the presented content's size, not the window's, and the screen
/// behind it does not lay out again. Posting for it raised the cover over an
/// unchanged screen, which read as a blur flash when a popover opened.
///
/// The presentation also forwards to the presented controller's children, so
/// the check walks the parent chain instead of looking only at `self`.
static BOOL NovellaIsInPresentedHierarchy(UIViewController *controller) {
  for (UIViewController *current = controller; current != nil;
       current = current.parentViewController) {
    if (current.presentingViewController != nil) {
      return YES;
    }
  }
  return NO;
}

static BOOL NovellaIsWindowSizeTransition(
    UIViewController *controller,
    CGSize size) {
  if (NovellaIsInPresentedHierarchy(controller)) {
    return NO;
  }
  UIWindow *window = controller.viewIfLoaded.window;
  if (window != nil && CGSizeEqualToSize(size, window.bounds.size)) {
    // The view already has this size: a presentation or layout pass, not a
    // window transition.
    return NO;
  }
  return YES;
}

static void NovellaViewWillTransition(
    id self,
    SEL selector,
    CGSize size,
    id<UIViewControllerTransitionCoordinator> coordinator) {
  BOOL isWindowTransition = NovellaIsWindowSizeTransition(
      (UIViewController *)self, size);
  if (isWindowTransition) {
    [[NSNotificationCenter defaultCenter]
        postNotificationName:NovellaLayoutWillChangeNotification
                      object:nil];
    if (coordinator != nil) {
      [coordinator animateAlongsideTransition:nil
                                   completion:^(
                                       id<UIViewControllerTransitionCoordinatorContext> context) {
                                     [[NSNotificationCenter defaultCenter]
                                         postNotificationName:NovellaLayoutDidChangeNotification
                                                       object:nil];
                                   }];
    }
  }
  if (NovellaOriginalViewWillTransition != NULL) {
    NovellaOriginalViewWillTransition(self, selector, size, coordinator);
  }
}

/// Swizzles the base `UIViewController` implementation. The app's own view
/// controllers (react-native-screens and Expo Router) do not override
/// `viewWillTransitionToSize:withTransitionCoordinator:`, so the size
/// transition that UIKit already drives for the screen runs through here.
/// The class exists (instead of a C constructor) so `-ObjC` keeps the object
/// file when the pod is linked as a static library.
@interface NovellaLayoutTransitionNotifier : NSObject
@end

@implementation NovellaLayoutTransitionNotifier

+ (void)load {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Method method = class_getInstanceMethod(
        [UIViewController class],
        @selector(viewWillTransitionToSize:withTransitionCoordinator:));
    if (method == NULL) {
      return;
    }
    NovellaOriginalViewWillTransition =
        (NovellaViewWillTransitionIMP)method_getImplementation(method);
    method_setImplementation(method, (IMP)NovellaViewWillTransition);
  });
}

@end

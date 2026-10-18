#import <UIKit/UIKit.h>
#import <objc/runtime.h>

/// Posted on the main thread right before a view-controller size transition
/// starts: rotation, a fold/unfold display change, or an iPad window resize.
/// The Expo module forwards it to JS so the reader can cover the surface before
/// the new layout is applied.
NSNotificationName const NovellaLayoutWillChangeNotification =
    @"NovellaLayoutWillChangeNotification";

/// Posted when UIKit finishes (or cancels) the size transition, so the reader
/// can fade the cover out on the real end instead of guessing a duration.
NSNotificationName const NovellaLayoutDidChangeNotification =
    @"NovellaLayoutDidChangeNotification";

typedef void (*NovellaViewWillTransitionIMP)(
    id, SEL, CGSize, id<UIViewControllerTransitionCoordinator>);

static NovellaViewWillTransitionIMP NovellaOriginalViewWillTransition = NULL;

static void NovellaViewWillTransition(
    id self,
    SEL selector,
    CGSize size,
    id<UIViewControllerTransitionCoordinator> coordinator) {
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

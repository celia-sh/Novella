#import <Foundation/Foundation.h>
#import <objc/runtime.h>

/// iOS 26 can attach navigation-owned views directly to the UIScrollView hosted
/// by a Fabric ScrollView component. React Native 0.86 recycles that component
/// without removing UIKit-owned subviews, which can carry a large-title view
/// into an unrelated screen after a size change.
///
/// Install the same opt-out used by react-native-screens container components.
/// This only disables cross-mount Fabric component pooling; FlatList cell reuse
/// and scrolling behavior are unaffected.
static BOOL NovellaFabricScrollViewShouldBeRecycled(__unused id self, __unused SEL command);

@interface NovellaFabricScrollViewRecyclingFix : NSObject
@end

@implementation NovellaFabricScrollViewRecyclingFix

+ (void)load
{
  Class componentClass = NSClassFromString(@"RCTScrollViewComponentView");
  if (componentClass == Nil) {
    return;
  }

  SEL selector = NSSelectorFromString(@"shouldBeRecycled");
  Class metaClass = object_getClass(componentClass);
  if (metaClass == Nil || class_respondsToSelector(metaClass, selector)) {
    return;
  }

  class_addMethod(
    metaClass,
    selector,
    (IMP)NovellaFabricScrollViewShouldBeRecycled,
    "c@:"
  );
}

@end

static BOOL NovellaFabricScrollViewShouldBeRecycled(__unused id self, __unused SEL command)
{
  return NO;
}

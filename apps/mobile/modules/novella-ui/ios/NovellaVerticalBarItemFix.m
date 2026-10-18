#import <UIKit/UIKit.h>
#import <objc/runtime.h>

/// iOS 27 renders navigation bars vertically on displays such as the iPhone
/// Duo. UIKit infers a custom-view bar button item as horizontal-only unless
/// `axisBehavior` says otherwise, and the property has to be set *before* the
/// item reaches the navigation item.
///
/// react-native-screens 4.30 does not expose `axisBehavior` (the v5 header-item
/// API does), and its stable header path just wraps an
/// `RNSScreenStackHeaderSubview` in a plain `UIView` before handing it to
/// `UIBarButtonItem(customView:)`. So the axis is applied in two places:
///
/// 1. `-[UIBarButtonItem initWithCustomView:]`: covers the gamma header path
///    (`RNSStackHeaderItemWrapperView`) and any other direct creation.
/// 2. The `UINavigationItem` item setters: covers `RNSScreenStackHeaderSubview`
///    custom views, which are the ones the reader's title and progress
///    capsule actually use. Applying the axis here is still before insertion:
///    the item is only handed to UIKit by the original setter.
///
/// Only custom views that belong to a react-native-screens header item are
/// touched. Bottom toolbar items go through `viewController.toolbarItems`, not
/// these setters, so they keep their horizontal placement.
static BOOL NovellaIsScreenHeaderItemView(UIView *view, NSInteger depth)
{
  if (view == nil || depth > 3) {
    return NO;
  }

  NSString *className = NSStringFromClass(view.class);
  if ([className hasPrefix:@"RNSStackHeaderItem"] ||
      [className hasPrefix:@"RNSScreenStackHeaderSubview"] ||
      [className hasPrefix:@"RNSScreenStackHeaderLeftView"] ||
      [className hasPrefix:@"RNSScreenStackHeaderRightView"]) {
    return YES;
  }

  for (UIView *subview in view.subviews) {
    if (NovellaIsScreenHeaderItemView(subview, depth + 1)) {
      return YES;
    }
  }

  return NO;
}

static void NovellaApplyVerticalBarAxis(UIBarButtonItem *item)
{
  if (@available(iOS 27.0, *)) {
    UIView *customView = item.customView;
    if (customView == nil || !NovellaIsScreenHeaderItemView(customView, 0)) {
      return;
    }
    // A vertical bar has a fixed width and a flexible, much shorter height than
    // a horizontal one. When the column is rebuilt (a fold moves the bars
    // between displays), UIKit compresses items and moves the lowest-priority
    // ones into the overflow menu. The reader's title and progress are the
    // reason the controls are in the bar at all, so ask for them to be kept.
    item.visibilityPriority = UIBarButtonItemVisibilityPriorityHigh;
    if (@available(iOS 27.1, *)) {
      item.axisBehavior = UIBarButtonItemAxisBehaviorVerticalPreferred;
    }
  }
}

/// When the tab bar and navigation items share a vertical column, UIKit's
/// default compression behavior keeps the tab bar and compresses the
/// navigation items. The reader wants the opposite: its column carries the
/// chapter title and progress, so the tab bar should give up space first.
static void NovellaPreferVerticalBarItems(UINavigationItem *navigationItem)
{
  if (@available(iOS 27.1, *)) {
    navigationItem.verticalBarCompressionBehavior = UIVerticalBarCompressionBehaviorPrefersBarItems;
  }
}

static BOOL NovellaApplyVerticalBarAxisToItems(NSArray<UIBarButtonItem *> *items)
{
  BOOL touchedHeaderItem = NO;
  for (UIBarButtonItem *item in items) {
    UIView *customView = item.customView;
    if (customView != nil && NovellaIsScreenHeaderItemView(customView, 0)) {
      touchedHeaderItem = YES;
    }
    NovellaApplyVerticalBarAxis(item);
  }
  return touchedHeaderItem;
}

@interface UIBarButtonItem (NovellaVerticalBarAxis)
@end

@implementation UIBarButtonItem (NovellaVerticalBarAxis)

- (instancetype)novella_initWithCustomView:(UIView *)customView
{
  UIBarButtonItem *item = [self novella_initWithCustomView:customView];
  NovellaApplyVerticalBarAxis(item);
  return item;
}

@end

@interface UINavigationItem (NovellaVerticalBarAxis)
@end

@implementation UINavigationItem (NovellaVerticalBarAxis)

- (void)novella_setLeftBarButtonItems:(NSArray<UIBarButtonItem *> *)items
{
  if (NovellaApplyVerticalBarAxisToItems(items)) {
    NovellaPreferVerticalBarItems(self);
  }
  [self novella_setLeftBarButtonItems:items];
}

- (void)novella_setLeftBarButtonItems:(NSArray<UIBarButtonItem *> *)items animated:(BOOL)animated
{
  if (NovellaApplyVerticalBarAxisToItems(items)) {
    NovellaPreferVerticalBarItems(self);
  }
  [self novella_setLeftBarButtonItems:items animated:animated];
}

- (void)novella_setRightBarButtonItems:(NSArray<UIBarButtonItem *> *)items
{
  if (NovellaApplyVerticalBarAxisToItems(items)) {
    NovellaPreferVerticalBarItems(self);
  }
  [self novella_setRightBarButtonItems:items];
}

- (void)novella_setRightBarButtonItems:(NSArray<UIBarButtonItem *> *)items animated:(BOOL)animated
{
  if (NovellaApplyVerticalBarAxisToItems(items)) {
    NovellaPreferVerticalBarItems(self);
  }
  [self novella_setRightBarButtonItems:items animated:animated];
}

@end

static void NovellaSwizzleInstanceMethod(Class cls, SEL originalSelector, SEL replacementSelector)
{
  Method original = class_getInstanceMethod(cls, originalSelector);
  Method replacement = class_getInstanceMethod(cls, replacementSelector);
  if (original != NULL && replacement != NULL) {
    method_exchangeImplementations(original, replacement);
  }
}

@interface NovellaVerticalBarItemFix : NSObject
@end

@implementation NovellaVerticalBarItemFix

+ (void)load
{
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NovellaSwizzleInstanceMethod(
        [UIBarButtonItem class],
        @selector(initWithCustomView:),
        @selector(novella_initWithCustomView:));

    NovellaSwizzleInstanceMethod(
        [UINavigationItem class],
        @selector(setLeftBarButtonItems:),
        @selector(novella_setLeftBarButtonItems:));
    NovellaSwizzleInstanceMethod(
        [UINavigationItem class],
        @selector(setLeftBarButtonItems:animated:),
        @selector(novella_setLeftBarButtonItems:animated:));
    NovellaSwizzleInstanceMethod(
        [UINavigationItem class],
        @selector(setRightBarButtonItems:),
        @selector(novella_setRightBarButtonItems:));
    NovellaSwizzleInstanceMethod(
        [UINavigationItem class],
        @selector(setRightBarButtonItems:animated:),
        @selector(novella_setRightBarButtonItems:animated:));
  });
}

@end

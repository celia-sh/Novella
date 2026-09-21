# Technical Design: Native Top-Bar Blur

## Architecture

Make the Expo Router native stack the sole iOS top-bar background owner.

1. `apps/mobile/src/theme/stack-preset.ts` imports `isLiquidGlassAvailable` and supplies the Hot Chocolate-style native options from the shared preset:
   - `headerTransparent = hasLiquidGlass`
   - `headerBlurEffect = hasLiquidGlass ? undefined : 'systemMaterial'`
2. Native stack layouts already consume this preset (`src/app/_layout.tsx`, tab stack layouts, and `src/app/settings/_layout.tsx`), so no screen-by-screen background component is needed.
3. iOS route components that currently override the native header (`BookDetailNavigation`, `ReaderNavigation`, `NativeScreenScaffold`, and grouped-list platform code) stop setting null backgrounds, `headerBlurEffect: 'none'`, or unconditional transparency.
4. Content scroll owners render directly beneath their screen/scaffold where the only purpose of the previous marker was to hide UIKit's scroll-edge material. The native stack and native scroll views can therefore coordinate their own material.

## Data and control flow

- Theme colors continue to flow into `contentStyle`, title tint, and toolbar tint exactly as before.
- `isLiquidGlassAvailable()` is a static capability decision, matching the reference app. Native UIKit owns the actual material, contrast, and scroll-edge transition.
- `BookDetailScreen` keeps its animated hero backdrop and `useScrollViewOffset` because those control the content hero, not the navigation-bar material. Its JS top-bar visibility state and ordinary `onScroll` callback are removed.
- Announcement detail keeps its loading/content scroll-owner handling but no longer publishes top-bar visibility to an overlay.
- Reader navigation keeps status bar, title, toolbar actions, and chrome visibility. Its fake top-bar props and edge suppression are removed; the native header's visibility follows `chromeHidden` while the native material follows the shared preset.
- Android continues to use `NativeTopAppBarScaffold` and existing route flags.

## Cleanup boundary

The following support code exists solely for the imitation and should be removed after references are gone:

- `src/components/ios-top-bar-background(.ios).tsx`
- `src/components/ios-progressive-blur(.ios).tsx`
- `src/components/ios-progressive-blur-config.ts`
- `src/components/ios-scroll-view-marker(.ios).tsx`
- `src/components/ios-scroll-view-marker.types.ts`
- `modules/novella-ui/src/native-scroll-edge-marker(.ios).tsx`
- `modules/novella-ui/src/native-scroll-edge-marker.types.ts`
- `modules/novella-ui/ios/NovellaScrollEdgeMarkerView.swift`
- `modules/novella-ui/ios/NovellaHiddenTopScrollEdgeEffectModifier.swift`
- The marker registration and view definition in `NovellaUiModule.swift`.

`NativeScrollEdgeMarker` is removed from reader screens as well: the current instances only hide the system effects that the old overlay replaced. Other native module exports (search, progress, bottom sheets, Compose top app bar, etc.) remain untouched.

## Compatibility and risk controls

- Do not change `UIViewControllerBasedStatusBarAppearance`; status-bar ownership remains with Expo `StatusBar`.
- Do not add a custom UIKit blur view, private API, or native module dependency.
- Keep route-specific `headerTintColor` and content backgrounds, but let parent `screenOptions` provide native header material. Remove only overrides that shadow that material.
- Preserve direct scroll-view ownership by removing wrappers rather than replacing them with another RN `View`. Where a marker carried `flex: 1`, transfer that style to the actual `ScrollView`/`FlatList`.
- Validate with source searches so a future route cannot silently reintroduce `headerBackground: () => null`, `headerBlurEffect: 'none'`, or an app-owned top-bar renderer.

## Rollback

The migration is isolated to iOS navigation presentation and cleanup. If native visual acceptance exposes a route-specific regression, restore the affected route's previous content structure and native preset change together; do not add a second overlay. Git can revert the migration commit without touching reader data, route contracts, or Android implementation.

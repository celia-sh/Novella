# Native Stack Top-Bar Blur Research

## User decision

The requested scope is all iOS navigation top bars. Android's existing Compose `NativeTopAppBarScaffold` remains unchanged because it is already a native platform implementation. The reference is `the iOS navigation reference implementation`.

## Reference pattern

`the iOS navigation reference implementation` uses:

```ts
const hasLiquidGlass = isLiquidGlassAvailable();

export const SystemScreenStackPreset = {
  headerTransparent: hasLiquidGlass,
  headerBlurEffect: hasLiquidGlass ? undefined : 'systemMaterial',
  headerLargeTitleShadowVisible: false,
  contentStyle: { backgroundColor: systemGroupedBackground },
};
```

The app uses this preset from its Expo Router `Stack` layouts and does not render an app-owned blur overlay.

## Current Novella implementation

- `apps/mobile/src/theme/stack-preset.ts` currently makes iOS headers transparent, sets `headerBlurEffect: 'none'`, and hides the native top scroll-edge effect.
- `apps/mobile/src/components/ios-top-bar-background.ios.tsx` renders an app-owned absolute overlay.
- `apps/mobile/src/components/ios-progressive-blur.ios.tsx` builds a `MaskedView`/`expo-blur`/gradient approximation of Apple's material.
- `NativeScreenScaffold`, `NativeGroupedListPlatform`, `BookDetailScreen`, `AnnouncementDetailScreen`, and `ReaderNavigation` mount or coordinate that overlay.
- `IosScrollViewMarker` and `NativeScrollEdgeMarker` suppress native scroll-edge effects so the app-owned overlay does not double-compose with UIKit's effect.
- iOS-specific navigation components for book detail and reader also override `headerBackground`, `headerTransparent`, or `headerBlurEffect`, preventing the shared native preset from owning the header.
- A separate comparison of Swiftgram's pinned-message/header-accessory architecture is recorded in [`native-header-accessory.md`](native-header-accessory.md). That research is deferred and does not change this blur migration.

## Migration implication

Use the shared native stack preset as the only iOS top-bar background owner. Remove the app-owned overlay and its visibility callbacks, native edge-effect suppression used only to support it, and route-specific header overrides that disable the preset. The native stack should be allowed to use Liquid Glass on supported iOS versions and `systemMaterial` on older iOS versions.

## Evidence to verify after implementation

- No source imports or JSX references remain for `IosTopBarBackground`, `IosProgressiveBlur`, or `IosScrollViewMarker`.
- No ordinary route sets `headerBackground: () => null`, `headerBlurEffect: 'none'`, or unconditional iOS `headerTransparent: true` to fake a transparent/blurred header.
- Native reader bottom toolbar behavior and Android Compose top bars remain unchanged.
- Workspace checks and mobile iOS bundle/build complete; device appearance remains user acceptance because the native blur is visual and platform-dependent.

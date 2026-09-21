# Reader navigation UI improvements

## Goal

Make the reader's iOS top-edge material explicit and investigate public APIs for controlling reader navigation-bar title/button colors and system status-bar appearance.

## Confirmed facts

- Branch: `feat/reader-ui-improvements`, based on `main`.
- Novel and comic readers both render the shared `apps/mobile/src/components/reader-navigation.ios.tsx` component.
- `react-native-screens` exposes `scrollEdgeEffects` on native stack screen options for iOS 26+, including an explicit `soft` style.
- The current iOS reader navigation options hide the header shadow but do not set `scrollEdgeEffects`.
- The current reader navigation already passes `headerTintColor` and toolbar button `tintColor` from the reader foreground color.
- Expo Router's native-stack `headerTitleStyle.color` maps to React Native Screens' native `titleColor`; `headerTintColor` maps to the general native header item color.
- React Native Screens exposes `statusBarStyle`, but its iOS path requires controller-based status-bar appearance, which this Expo/RN app intentionally keeps disabled for the Toast bridge.
- The existing React Native `StatusBar` component can explicitly set `barStyle` through the app's current status-bar manager mode. iOS does not expose an independent opaque status-bar background color; the header/content behind the transparent status bar supplies that surface.

## First implementation slice

- Set the iOS reader navigation screen's top scroll-edge effect explicitly to `soft`.
- Set the other scroll edges explicitly to `hidden` so the native default does not vary by device or OS.
- Because the component is shared, the change must apply to both novel and comic readers.
- Do not change Android behavior.

## Follow-up investigation

- Explicitly pass the reader foreground color to `headerTitleStyle.color` as well as the existing `headerTintColor`/toolbar tint.
- Explicitly pass a matching `StatusBar` `barStyle` for novel and comic readers without changing `UIViewControllerBasedStatusBarAppearance` or using private UIKit APIs.
- Document that the iOS status-bar background is controlled by the translucent navigation/content surface rather than a separate color property.

## Deferred top-header accessory research

Swiftgram's standard chat page places its pinned panel in the content layer below the native navigation bar, which is the closest match to a future reader accessory. Its embedded/custom navigation path additionally uses a Telegram-owned `navigationBar.additionalContentNode`; Expo Router has no public equivalent top-header-bottom slot. The comparison and future options are recorded in [`08-24-native-top-bar-blur/research/native-header-accessory.md`](../08-24-native-top-bar-blur/research/native-header-accessory.md).

This task does not implement a reader top accessory. If revisited later, keep the native header and first try a screen-owned accessory driven by the existing `chromeHidden` state; only pursue native header ownership if exact native layout/animation is required.

A follow-up investigation of wrapping the chapter title in a Swiftgram-like glass card is recorded in [`research/reader-title-glass-accessory.md`](research/reader-title-glass-accessory.md). It distinguishes a glass-wrapped native `headerTitle` from the separate under-navbar accessory that requires reader inset/layout work.

## Acceptance criteria

- [ ] iOS novel and comic reader navigation options pass `top: 'soft'` and hide the other scroll edges.
- [ ] Android and web navigation behavior remain unchanged.
- [ ] Typecheck, reader tests, boundary checks, and diff checks pass.
- [ ] The navbar/status-bar API investigation reports supported and unsupported controls separately.
- [ ] Native visual behavior remains user-verified on iOS 26+.

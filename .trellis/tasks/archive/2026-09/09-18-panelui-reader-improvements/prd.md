# Migrate HeroUI to PanelUI and improve reader media controls

## Goal

Replace the mobile app's `heroui-native` integration with the official `panelui-native` package, update to the release that provides `ImageViewer`, and make reader image previews feel spatially connected to the image the user tapped.

## Requirements

- Remove the `heroui-native` dependency, imports, stylesheet import, provider, and HeroUI-specific theme naming from `apps/mobile`.
- Add the latest `panelui-native` release available for the Expo SDK used by the app (`0.99.0` at planning time) and configure its theme CSS and provider without disturbing Expo Router, keyboard, gesture, toast, or safe-area providers.
- Migrate all HeroUI components used by the mobile app, including buttons, cards, chips, fields, OTP input, avatars, spinners, skeletons, and skeleton groups, while preserving existing behavior, accessibility labels, localization, and visual palette.
- Use PanelUI's `ImageViewer` for React-rendered reader/comic images wherever a trigger rectangle is available, retaining image loading/retry, dimensions, caching, and reader image actions.
- Replace the reader preview's three-button toolbar with a PanelUI LiquidGlass FAB group that exposes share, close, and save actions with localized accessibility labels and loading/disabled states.
- Preserve existing save/share error handling and reader navigation behavior, including tap/long-press preferences and native Readium image callbacks.

## Acceptance Criteria

- [ ] `rg` finds no `heroui-native`, `HeroUI`, or HeroUI stylesheet/provider usage in mobile source, package manifests, or lockfile; the PanelUI package is locked at the selected latest version.
- [ ] TypeScript typecheck passes and the existing mobile test suites pass.
- [ ] All former HeroUI loading surfaces render with PanelUI `Skeleton` (or an equivalent PanelUI skeleton composition), including auth, home, community, announcements, comments, book detail, and grids.
- [ ] Reader/comic images open with a source-to-viewer transition, support PanelUI zoom/dismiss behavior, and keep save/share actions available.
- [ ] The preview actions are presented through a LiquidGlass FAB group, with a graceful non-glass fallback on unsupported platforms and no accidental reader interaction after dismissal.
- [ ] Theme variables continue to follow the app's iOS light/dark palette and PanelUI components remain styled in a production Metro build.

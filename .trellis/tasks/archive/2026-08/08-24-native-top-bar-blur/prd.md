# Use Native Top-Bar Blur

## Goal

Replace Novella's app-owned iOS top-bar blur approximation with the native Expo Router / UIKit navigation-bar material, matching the implementation pattern used by `the iOS navigation reference implementation`. This gives every iOS navigation top bar the system Liquid Glass/material behavior instead of a JavaScript-composed imitation.

## Background

Novella currently disables the native iOS header material and renders `IosTopBarBackground` over screen content. That component delegates to `IosProgressiveBlur`, which combines `MaskedView`, `expo-blur`, gradient masks, and replay colors to approximate Apple's edge material. Scroll-edge markers and visibility callbacks exist only to coordinate that app-owned layer.

The Hot Chocolate reference uses one shared native-stack preset:

- iOS versions with Liquid Glass: `headerTransparent: true`, no explicit blur effect.
- Older iOS versions: `headerBlurEffect: 'systemMaterial'`.
- No app-owned top-bar overlay.

Android's `NativeTopAppBarScaffold` is already a native Jetpack Compose top bar and is outside this iOS migration.

## Requirements

### R1 — Native shared iOS header material

The shared Expo Router stack preset must select the native header behavior using `isLiquidGlassAvailable()`:

- Liquid Glass-capable iOS: transparent native header with the system material supplied by UIKit.
- Other iOS versions: native `systemMaterial` header blur.
- Preserve existing app theme colors, title/back-button behavior, large-title behavior, and route navigation semantics.

### R2 — Remove the app-owned iOS top-bar renderer

Remove `IosTopBarBackground`, `IosProgressiveBlur`, their configuration contract, and all screen-level mounting or visibility state associated with them. No screen should render or animate a JavaScript/RN top-bar blur overlay.

### R3 — Stop disabling native edge material

Remove the top-edge suppression and visibility plumbing that existed to prevent double composition with the app-owned overlay. Ordinary iOS scroll views/lists must be allowed to participate in native navigation-bar scroll-edge behavior. Reader-specific edge suppression must not disable the native top/bottom navigation material after this migration.

### R4 — Preserve route-specific content and controls

Book detail hero transitions, announcement loading/content ownership, native grouped-list rows, reader chrome/status-bar behavior, toolbars, and Android Compose navigation must remain functionally intact. Route-specific options may continue to set content colors and toolbar tint, but must not disable the shared native header blur.

### R5 — Keep platform boundaries explicit

The change applies to iOS navigation top bars. Android's Compose top-bar implementation and its existing OLED/theme handling must remain unchanged unless required only to keep TypeScript contracts valid.

## Acceptance Criteria

- [x] Every iOS native-stack route that shows a header uses the shared native Liquid Glass/systemMaterial preset; no app-owned RN blur is mounted.
- [x] `IosTopBarBackground`, `IosProgressiveBlur`, and their configuration/visibility contracts are no longer imported, rendered, or referenced by the app.
- [x] Native scroll-edge suppression used solely for the imitation is removed; ordinary lists and reader surfaces no longer hide UIKit's native top-bar material.
- [x] Book detail, announcement detail, grouped settings lists, reader top/bottom toolbars, large titles, back actions, and toolbar actions retain their existing behavior and colors according to static checks and automated tests.
- [x] Android Compose top bars and Android-specific route behavior are unchanged.
- [x] Automated type checks, boundary checks, relevant tests, `git diff --check`, and iOS bundle/build checks pass where the local toolchain permits.
- [ ] Native visual behavior on supported iOS versions is manually checked by the user after a rebuilt development client: large-title root, pushed route, book detail hero, announcement detail, reader, light/dark appearance, and scroll-edge transitions.

## Out of Scope

- Redesigning Android Compose top bars or adding a cross-platform blur abstraction.
- Replacing native bottom toolbars or reader progress controls.
- Changing route hierarchy, title text, status-bar ownership, reader gestures, list virtualization, or content layout.
- Reintroducing an app-owned blur wrapper or private UIKit APIs.

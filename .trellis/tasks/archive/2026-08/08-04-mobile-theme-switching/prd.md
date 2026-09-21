# Fix mobile light and dark theme switching

## Goal

Make the React Native mobile app consistently honor the user's selected appearance (`System`, `Light`, or `Dark`) across iOS and Android, including React Native content, native navigation surfaces, and the reader, without changing the app's established platform color-palette rules.

## Background and Confirmed Symptoms

- The Appearance setting currently persists `system`, `light`, or `dark`, but only `system` has an observable effect; selecting fixed `light` or `dark` does not update the app correctly.
- On Android, changing the system appearance updates native top/bottom navigation surfaces, while React Native content can remain in the previous appearance (for example, the shelf stays light after the system switches to dark).
- The Android novel reader currently remains dark regardless of the intended appearance; the iOS reader behaves correctly.

## Requirements

- The effective app appearance must be derived from the persisted user preference:
  - `system` follows the current operating-system appearance.
  - `light` remains light regardless of operating-system changes.
  - `dark` remains dark regardless of operating-system changes.
- Changing the Appearance setting must update all mounted React Native screens and applicable native surfaces without requiring an app restart.
- While `system` is selected, operating-system appearance changes must refresh both native navigation surfaces and React Native content in the same appearance.
- The novel reader must use the same effective appearance on Android and iOS unless an existing reader-specific background preference intentionally overrides it.
- Preserve the existing platform palette policy:
  - iOS uses the system palette and the app's current red tint for ordinary screens.
  - Android uses the app's Material palette for ordinary screens.
  - Book-detail routes and related routes may continue to override the ordinary palette with their Material/cover-derived palette when cover color extraction is enabled.
- Do not replace the platform palette architecture with a single cross-platform hard-coded palette.

## Acceptance Criteria

- [ ] With the device in dark mode, selecting `Light` immediately renders ordinary React Native content, navigation, status-bar treatment, and the novel reader in light appearance on both iOS and Android.
- [ ] With the device in light mode, selecting `Dark` immediately renders ordinary React Native content, navigation, status-bar treatment, and the novel reader in dark appearance on both iOS and Android.
- [ ] Selecting `System` immediately adopts the current device appearance, and a later device appearance change refreshes both native navigation and React Native content without an app restart.
- [ ] The Android shelf no longer remains light when the effective app appearance changes to dark.
- [ ] The Android novel reader no longer remains permanently dark and matches the effective app appearance under `System`, `Light`, and `Dark`.
- [ ] The iOS ordinary-screen red/system palette behavior remains intact.
- [ ] The Android ordinary-screen Material palette behavior remains intact.
- [ ] Book-detail and related route palette overrides continue to work as before.
- [ ] The selected appearance remains persisted across app restarts.

## Out of Scope

- Redesigning the Appearance settings UI.
- Changing the app tint/seed-color product rules.
- Removing cover-derived themes from book-detail routes.
- Introducing settings synchronization across devices.

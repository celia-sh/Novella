# Implementation Plan

## Implementation

- [ ] Add pure effective-scheme and reader-color helpers with focused unit tests for `system`, fixed light/dark, and OLED behavior.
- [ ] Add the root app-theme provider, platform palette hooks, and themed stylesheet helper.
- [ ] Load persisted settings during the existing root bootstrap probe and synchronize the selected mode through Uniwind/native appearance.
- [ ] Convert root navigation, status bar, native tabs, and stack presets to the effective scheme and reactive palette.
- [ ] Replace direct `useColorScheme()` calls in app-owned native hosts and theme consumers with the centralized effective scheme.
- [ ] Migrate every ordinary-route `@/theme/colors` consumer to the reactive app palette, including style sheets with captured color literals.
- [ ] Update the novel reader and reader chrome to use effective appearance, Material colors on Android, existing semantic visuals on iOS, and dark-only OLED black.
- [ ] Route book-detail theme calculation through the centralized effective scheme without changing cover-derived palette behavior.

## Validation

- [ ] Run the focused mobile theme tests.
- [ ] Run `npm run typecheck -w @novella/mobile`.
- [ ] Run `npm run check` for workspace type checking and package boundaries.
- [ ] Run `npm run test:client` and the mobile service test suite to guard shared and existing mobile behavior.
- [ ] Audit for remaining direct `useColorScheme()` calls outside the app-theme provider and intentional platform/framework internals.
- [ ] Audit for remaining imports of the removed static `@/theme/colors` singleton.
- [ ] Review the book-detail/cover-derived theme path for unchanged palette ownership.

## Device Acceptance

Per the frontend quality specification, simulator/device interaction is user-accepted unless explicitly requested for agent-driven verification. The user should smoke-test on both platforms:

1. Device dark + app Light.
2. Device light + app Dark.
3. App System followed by a live device appearance change.
4. Android shelf/content and native top/bottom navigation change together.
5. Android and iOS novel reader match the effective appearance without reloading the chapter.
6. Book-detail cover color extraction still overrides only its intended route family.

## Risk and Rollback Points

- Commit/checkpoint after the provider and pure helpers compile before migrating consumers.
- Do not key or remount the navigation tree on scheme changes.
- If a platform palette API is unavailable on one target, keep the provider contract and substitute only that platform's palette hook.
- No settings schema migration is allowed; rollback must leave existing persisted `theme` values valid.

# Implementation Plan

## Ordered checklist

1. [x] Record and confirm the native-stack pattern and current fake-blur ownership in the task research artifact.
2. [x] Update the shared iOS stack preset to match Hot Chocolate's `isLiquidGlassAvailable()` branching.
3. [x] Remove route-level iOS header overrides that disable the shared native material from book detail and reader navigation.
4. [x] Remove `IosTopBarBackground`/`IosProgressiveBlur` state, props, imports, and files from scaffolds, grouped lists, book detail, announcements, and reader navigation.
5. [x] Remove `IosScrollViewMarker` wrappers and top-edge suppression from ordinary iOS content, preserving list/scroll flex styles and direct scroll-owner hierarchy.
6. [x] Remove `NativeScrollEdgeMarker` top-bar/reader suppression and its now-unused native module registration/files without touching unrelated native UI modules.
7. [x] Remove obsolete shared props (`ownsTopBarBackground` and reader top-bar blur props) and update all call sites.
8. [x] Run source searches for fake blur, header disabling, and stale props; inspect the final diff for accidental Android or reader behavior changes.
9. [x] Run formatting/diff checks, workspace check, relevant mobile tests, and an iOS bundle/build if available.
10. [ ] Record any remaining iOS device visual checks for the user; do not drive a simulator/device without explicit request.

## Implementation record

- The shared preset now follows Hot Chocolate's static capability branch: Liquid
  Glass uses transparent native headers; older iOS uses `systemMaterial`.
- Route-specific disabling options, fake blur/edge-marker components, their
  visibility state, and the obsolete `NovellaUi` scroll-edge registration were
  removed. Actual lists and scroll views retain their required flex/background
  styles after wrapper removal.
- `ExpoUI` is no longer a dependency of the `NovellaUi` iOS pod because its only
  use was the removed private-purpose scroll-edge modifier registration.

## Validation record

- Passed `npm run check` (boundaries plus all workspace TypeScript projects).
- Passed `npm run test:client` and mobile reader/community/shelf/localization
  suites; mobile reader suite reports 42 passing tests.
- Passed `npx expo export --platform ios --clear` and the matching Android export
  from `apps/mobile`.
- Passed `pod install`, `git diff --check`, and the Debug generic iOS Simulator
  `Novella` build with code signing disabled.
- Source audit finds no app references to the removed fake-blur, marker, or
  native scroll-edge suppression symbols. iOS visual acceptance remains pending
  user testing on a rebuilt development client.


## Validation commands

```sh
npm run check
npm run test:reader --workspace @novella/mobile
npm run test:community --workspace @novella/mobile
npm run test:shelf --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
npx expo export --platform ios --clear
npx expo export --platform android --clear
git diff --check
```

If export/build commands are too expensive or unavailable, run the checks that are available and report the omission explicitly. Native iOS visual acceptance requires a freshly rebuilt development client and user testing.

## Risky files / rollback points

- `apps/mobile/src/theme/stack-preset.ts`: shared behavior for every native stack.
- `apps/mobile/src/components/reader-navigation.ios.tsx`: reader chrome and forced-light appearance.
- `apps/mobile/src/screens/book-detail-screen.tsx` and `announcement-detail-screen.tsx`: removing scroll callbacks must not affect hero/content behavior.
- `apps/mobile/modules/novella-ui/ios/NovellaUiModule.swift`: native module cleanup must leave all remaining views registered.
- All `IosScrollViewMarker` call sites: wrapper removal must not change list sizing or large-title ownership.

Rollback is a single migration revert if native visual acceptance fails; no replacement RN blur should be added.

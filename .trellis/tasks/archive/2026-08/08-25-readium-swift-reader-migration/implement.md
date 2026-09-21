# Implementation plan

## Phase 1: restore/adapt the iOS Readium foundation

1. Restore the prior Novella-owned Readium publication builder/cache, locator mapping, preference mapping, Expo bindings, and focused tests from Git history as a starting point.
2. Remove the Android native module and set `expo-module.config.json` to iOS-only. Add a TypeScript Android fallback and localized unsupported reader state.
3. Update publication materialization to consume the current `inlineNovelFootnotesAfterBlocks()` output, preserve relative image URLs/API rebasing, stable block fragments, WOFF2 gating, and target-chapter readiness.
4. Add native status/tap/image/link/locator/boundary events and imperative locator/progression commands. Verify observer/gesture cleanup and Readium 3.11 API usage against source/docs.

## Phase 2: integrate current reader behavior

5. Replace Skia-specific `ReaderScreen` layout/tiling/window/mode-transition code with the Readium view while retaining current navigation, chrome visibility, safe-area insets, theme resolution, settings route, chapter route selection, preload hook, lifecycle save, and preview host.
6. Implement canonical locator mapping and chapter percentage state/seek. Replace novel page-count labels with a percentage display variant while leaving comic page labels untouched.
7. Implement previous/next boundary events, edge taps, center chrome toggling, link/chapter navigation, and image-preview event suppression.
8. Adapt `ReaderImagePreview` to URI-only ownership; preserve zoom, save/share, dismissal timing, and safe-area toolbar placement.

## Phase 3: remove Skia and cleanup

9. Delete Skia components/services/layout package and novel-only tests. Remove Skia dependencies, native patch tooling, package-lock entries, tsconfig aliases, and dead imports. Keep shared comic layout/progress code.
10. Update test scripts and localization resources; add publication, locator, preferences, percentage, and Android fallback tests.

## Verification

- `npm run typecheck`
- `npm run test:reader`
- `npm run check:boundaries`
- `git diff --check`
- `npx expo export --platform ios` from `apps/mobile` when dependencies/native module are ready
- iOS `pod install`/native compile and device acceptance for publication open, fonts, safe areas, settings, image preview, progress, chapter boundaries, and reloads
- Android TypeScript/export/build smoke check must prove no Readium Kotlin/native module is referenced; Android novel screen is unsupported by design

## Risk gates

- Do not delete Skia until the iOS Readium path has a deterministic publication/locator test surface.
- Do not claim backend progress compatibility until a Readium fragment, text-anchor fallback, and percentage seek each map to the existing `{chapterId, position}` contract.
- Do not use Readium `totalProgression` for the novel chapter slider; use current-resource `progression`.
- Do not add Android Readium dependencies or alter the existing Android build baseline.

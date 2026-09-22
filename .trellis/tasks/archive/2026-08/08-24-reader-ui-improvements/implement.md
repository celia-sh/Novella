# Implementation plan

1. Add the explicit iOS `scrollEdgeEffects` option to the shared reader navigation.
2. Add the shared `statusBarStyle` prop and pass the reader foreground style from novel and comic screens.
3. Explicitly set `headerTitleStyle.color` on iOS and Android/native fallback while preserving existing tint colors.
4. Set React Native `StatusBar.barStyle` in reader navigation implementations; do not change Info.plist status-bar ownership.
5. Run typecheck, reader tests, workspace boundary checks, diff checks, and an Expo iOS/Android export when available.
6. Hand off iOS 26+ visual acceptance for the soft top edge, title color, toolbar color, and status-bar glyph color.

## Rollback points

- The one-line `scrollEdgeEffects` option can be removed independently if the iOS 26 visual effect is not desirable.
- The explicit title/status-bar props can be reverted without changing reader content, progress, or layout.

## Completed follow-up fixes

- **Required WOFF2 fonts** (`[COMMIT]`): `apps/mobile/src/services/skia-font-loader.ts` reuses the canonical `readerFontFile()` payload and passes WOFF2 directly to Skia's typeface factory. The JS Brotli/TTF fallback, `woff-lib` dependency, and temporary font diagnostics are removed; direct-loading failures propagate instead of silently falling back to the system font.
- **Novel mode-switch Metal crash** (`[COMMIT]`): `packages/reader-layout/src/tile-chapter.ts` partitions scroll content into bounded tiles (maximum `4096pt`) and repeats intersecting long blocks across clipped slices. `apps/mobile/src/screens/reader-screen.tsx` unmounts the old Skia list before changing mode, preventing overlapping old/new Metal drawables.
- **iOS glass title** (`[COMMIT]`): `apps/mobile/src/components/reader-navigation.ios.tsx` keeps the glass title inside a conservative explicit native-title slot and truncates long titles with a tail ellipsis. The under-navbar accessory remains deferred.

## Verification

- Mobile and workspace TypeScript checks passed.
- Reader-layout tests passed (27 tests).
- Mobile reader tests passed (43 tests).
- Package boundary and `git diff --check` checks passed.
- iOS and Android Expo exports passed for the direct-WOFF2 generation; final title-slot export remains a local rebuild/manual visual acceptance step.

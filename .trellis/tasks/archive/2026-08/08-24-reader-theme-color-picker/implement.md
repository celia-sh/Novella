# Implementation plan

1. **Settings contract**
   - Add the optional novel-reader background field and decoder validation.
   - Add pure reader color helpers and focused tests for default resolution, hex normalization, and black/white contrast selection.
2. **iOS-only settings UI**
   - Add the platform-resolved background-color settings section.
   - Use `ColorPicker` from the installed `@expo/ui/swift-ui` package with opacity disabled.
   - Debounce high-frequency selection callbacks and flush the latest pending value on unmount; do not publish/persist every pointer sample.
   - Keep the Android implementation a no-op and add localized `zh-CN` / `zh-TW` strings.
3. **Novel reader integration**
   - Resolve the effective background and contrast text color in `ReaderScreen`.
   - Apply them to the existing root, loading/reflow overlays, Skia `ReaderTheme`, navigation, and chapter navigation.
   - Leave Android and comic paths unchanged.
4. **Verification**
   - Run the focused reader-theme and debounced-commit tests and the existing reader/theme/localization suites.
   - Run `npm run typecheck`, `npm run check:boundaries`, and `git diff --check`.
   - Report iOS simulator/device interaction as user acceptance; specifically verify picker presentation, persistence, light/dark defaults, arbitrary light/dark colors, and reader/chrome contrast.

## Risk points

- Platform resolution must prevent an iOS-only import from reaching Android.
- An invalid stored color must not reach Skia, React Native styles, or the native picker.
- Color changes must not accidentally modify comic reader colors, pagination, or saved progress.

## Rollback point

Before reader integration, the settings/UI changes can be reverted independently. The pure helper tests provide the contract for a later implementation without requiring native UI changes.

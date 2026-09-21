# Design: novel reader background color picker

## Architecture

Keep the feature inside `apps/mobile`:

- `services/settings.ts` owns the durable optional `novelReaderBackgroundColor` value and validates it at the storage boundary.
- `theme/reader-theme.ts` owns the default background resolution, color normalization, and readable black/white foreground selection. It remains pure and platform-neutral within the mobile app.
- `components/reader-background-color-settings.tsx` is the Android/web no-op implementation.
- `components/reader-background-color-settings.ios.tsx` renders the existing native grouped-list section and the iOS-only `ColorPicker` from `@expo/ui/swift-ui`.
- The iOS picker boundary owns a trailing debounced commit: SwiftUI can emit `onSelectionChange` for every drag sample, but the React/settings tree receives only the settled value. The latest pending value is flushed on unmount so closing the sheet cannot lose a selection.
- `screens/settings/reader-settings-screen.tsx` supplies localized labels and the current effective color to the shared control. Because the content is reused by the full settings route and the reader sheet, both entry points receive the same control.
- `screens/reader-screen.tsx` resolves the selected iOS background and contrast foreground, then threads those values through the existing root, loading/reflow chrome, `ReaderTheme`, Skia tiles, and navigation chrome. Android retains its existing `resolveReaderColors` path.

## Data flow

```text
ColorPicker selection (#RRGGBB)
  → updateAppSettings({ novelReaderBackgroundColor })
  → settings decoder validates/uppercases persisted value
  → useAppSettings publishes synchronously
  → reader-theme resolves effective background + contrast foreground
  → ReaderScreen root / chrome / ReaderTheme / Skia presentation
```

`null` means “follow the current reader appearance default.” A malformed stored value also decodes to `null`; this preserves startup and avoids presenting an invalid CSS/Skia color.

## Color contract

- Accept six-digit hex colors and the eight-digit `#RRGGBBAA` form supported by Expo UI, preserving uppercase normalized bytes.
- The picker disables opacity so ordinary user selections are opaque six-digit colors.
- Effective unset defaults remain `#F2F2F7` in light mode and `#000000` in dark mode on iOS.
- Foreground selection compares WCAG-style contrast ratios for black and white against the effective background and chooses the higher-contrast color. Inline authored HTML colors remain owned by the reader style resolver.

## Compatibility

- Do not import `@expo/ui/swift-ui` from a shared or Android-resolved file. Platform resolution guarantees the Android implementation is a no-op.
- Do not add a dependency: `@expo/ui` is already installed and version-aligned with Expo SDK 57.
- Do not call `updateAppSettings` directly from every native ColorPicker drag callback; that publishes globally and queues SQLite writes.
- Do not modify comic reader settings or the global Material seed/theme setting.
- The reader's existing geometry and progress contracts remain unchanged; the background-only setting does not alter width, padding, pagination, tile offsets, or saved locators.

## Trade-offs and rollback

A pure color picker is simpler and avoids introducing a custom native module, but it does not provide a separate reset action in this first pass; clearing the setting can remain an internal/default path for future UI. If the native picker cannot be embedded reliably in the grouped-list accessory, rollback consists of removing the iOS control while retaining the validated setting and reader resolver, or use a dedicated iOS settings row without touching the reader pipeline.

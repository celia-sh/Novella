# Novel reader background color picker

## Goal

Allow iOS users to choose and persist the novel reader's page background color without changing comic-reader colors or the rest of the app theme.

## Confirmed facts

- The active implementation branch is `feat/reader-theme`, based on `main`.
- The current active Trellis task was cleared before creating this task.
- `@expo/ui` `~57.0.8` is already installed in `apps/mobile`.
- The installed `@expo/ui/swift-ui` package exports an iOS-only `ColorPicker` whose selection contract is a `#RRGGBB` or `#RRGGBBAA` string and whose callback returns the selected color string.
- Android support is intentionally out of scope for this feature; Android may render a no-op instead of importing the iOS-only component.
- `ReaderSettingsContent` is shared by the full reader settings route and the in-reader settings sheet.
- Durable app settings are owned by `apps/mobile/src/services/settings.ts`, decoded and persisted through the existing local storage pipeline.
- `apps/mobile/src/screens/reader-screen.tsx` currently derives the iOS novel reader background from the app color scheme (`#000000` in dark mode and `#F2F2F7` in light mode), then passes it to the root reader surface, reflow overlay, layout theme, and Skia tiles.
- The comic reader has a separate background path and must not consume the novel-only setting.

## Requirements

- Add one optional persisted novel-reader background color setting. When unset, preserve the current light/dark reader background defaults; when set, use the selected color.
- Add an iOS-only color picker control to the shared reader settings content so it is available from both reader settings entry points.
- Coalesce rapid native color-selection callbacks so dragging the picker does not publish and persist one app-settings write per pointer movement; keep the native picker responsive and flush the final selection reliably.
- Keep Android behavior unchanged and avoid importing `@expo/ui/swift-ui` into an Android bundle.
- Apply the selected color to the mounted novel reader surface and its transition/loading chrome without changing reader mode, layout geometry, font, progress, image behavior, or comic-reader appearance. Choose the default reader text color automatically from the selected background for readable contrast.
- Restore the selected background after app restart and safely fall back to the default when stored data is missing or invalid.
- Add localized Simplified Chinese and Taiwan Traditional Chinese labels/descriptions and preserve resource-shape parity.
- Preserve accessibility and native grouped-settings behavior.

## Acceptance criteria

- [ ] iOS reader settings show a native ColorPicker for the novel reader background.
- [ ] Selecting a color updates the open novel reader and persists across reload; the default text color automatically maintains readable contrast.
- [ ] Rapid color-picker dragging does not enqueue one settings/storage update per native callback; the latest selection commits after interaction settles and is flushed when the control unmounts.
- [ ] Missing, malformed, or unsupported stored colors decode to the default without preventing startup.
- [ ] Android does not render the feature and keeps the existing reader behavior.
- [ ] Comics, application theme settings, reader typography, layout/progress, and image behavior remain unchanged.
- [ ] Localization parity, focused tests, workspace typecheck, boundary checks, and diff checks pass.
- [ ] Native visual interaction remains user-verified on iOS; Android behavior is code-verified only.
- [ ] Keep ordinary system ColorPicker selection; do not add or promise a separate API for arbitrary screen-coordinate sampling.

## Out of scope

- Custom text-color selection.
- Comic-reader background customization.
- A cross-platform color picker or Android implementation.
- A custom screen-sampling/eyedropper API or control over the system ColorPicker's built-in sampler.
- Replacing the application's global theme color or Material seed color.
- New native modules or private UIKit APIs.

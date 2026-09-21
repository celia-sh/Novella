# Technical design

## Boundaries

- `panelui-native` owns the shared component primitives and `ImageViewer`/`Fab` motion. Existing `react-native-paper` surfaces and native Expo controls remain unchanged unless they are directly part of the old HeroUI integration.
- The app theme remains the source of truth. A renamed PanelUI token adapter maps `AppColors` to PanelUI's `--color-*` variables and keeps legacy semantic aliases only where existing app code still reads them.
- `PanelUIProvider` is mounted inside the existing localization/theme/gesture/keyboard/toast hierarchy and wraps the navigation tree. The app's own gesture root remains in place only if nesting is safe; avoid duplicating roots unnecessarily.

## Component migration

- `Card.Body` becomes `Card.Content`; `Card` receives the existing native `style` and keeps the app's explicit palette overrides.
- `Button` uses PanelUI variants (`primary`, `secondary`, `outline`, `ghost`, `destructive`), `disabled`, `loading`, `size="icon"`, `startContent`, and `endContent` instead of HeroUI-only props and slots.
- `Chip` maps selected/primary/soft behavior to PanelUI's `selected`, `variant`, and explicit style where needed. Existing Paper chips are left alone.
- `Input` is used as a self-contained labelled/error field where possible; `Field`/`Label`/`FieldError` provide composition where the screen needs custom helper/counter rows.
- `OtpInput` replaces HeroUI `InputOTP`; its controlled string API and numeric/text mode are adapted in the auth field without changing the auth hook contract.
- `Avatar` maps URL and fallback text to PanelUI's `source`, `fallback`, `size`, and native style overrides.
- Every skeleton uses PanelUI's pulsing `Skeleton`; old HeroUI shimmer/pulse configuration is removed or represented by the PanelUI default. `SkeletonGroup` has no PanelUI equivalent, so grouped book-detail placeholders become a themed container of individual `Skeleton` nodes.

## Reader image presentation

- `ReaderHtmlImage` and `ComicPage` wrap their existing image content in a shared `ImageViewer` root/trigger where the rendered thumbnail has a measurable React Native rectangle. The trigger receives the resolved URI, known width/height when available, radius, and localized `alt`; custom children keep existing BlurHash/error/retry rendering.
- A reusable reader image viewer action surface owns save/share state and is rendered inside the viewer host. PanelUI's viewer supplies the source-to-fitted-image flight, pinch/double-tap zoom, gallery/dismiss gestures, and backdrop. The action surface is a `Fab.Group` with `layout="dial"`, `glass`, and localized actions.
- For the native Readium callback, there is no React thumbnail rectangle to register. Keep a small imperative host fallback for that path, but remove the hand-rolled zoom/modal toolbar from the normal React-rendered path. The fallback shares the same action callbacks and LiquidGlass FAB group where a portal/root can host it; it must remain safe when the callback arrives during route cleanup.
- Do not make comic pages one gallery spanning the whole chapter unless the list lifecycle guarantees stable registration. A per-page viewer root avoids virtualized-list registration churn; the requested source-to-viewer animation still works for the tapped page.

## Theme and build

- `global.css` imports `panelui-native/theme.css` and sources PanelUI's source tree.
- `metro.config.js` registers the existing extra themes only if the app can switch to them; preserve the app's current Uniwind entry and d.ts path.
- Replace `hero-ui-theme.ts` with a PanelUI-named adapter/test (or update its exports and test names together) so comments, symbols, and test commands no longer claim HeroUI.
- Since `Color.ios.*` values are not strings, resolve them through the existing color resolver before passing them to `Uniwind.updateCSSVariables`.

## Risk controls

- First land dependency/provider/CSS/theme changes, then compile the component migrations, then integrate reader presentation. Run typecheck after each layer.
- Use `rg` to ensure no HeroUI import/manifest/stylesheet remains. Use existing mobile test scripts plus a Metro bundle/device check for PanelUI CSS and iOS image/FAB interaction.
- Preserve the old reader host until both native callback and React-rendered image flows typecheck; delete only after the fallback path is verified.

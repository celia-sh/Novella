# Replace Skia novel reader with Readium Swift Toolkit

## Goal

Replace the novel reader's Skia renderer with an iOS-only Readium Swift Toolkit navigator to remove the Skia performance/crash surface while preserving the current reader behavior, native chrome, backend progress contract, and chapter interactions.

## Scope

This migration changes the **novel reader content renderer only**. The comic reader remains unchanged. iOS uses a Novella-owned Expo native view backed by Readium Swift Toolkit 3.11.0. Android does not add Readium Kotlin; the novel reader uses a small unsupported-platform fallback because Android support will be removed in a later product change.

## Confirmed requirements

- Remove the Skia novel renderer and its package/runtime dependencies, including `@shopify/react-native-skia`, `packages/reader-layout`, Skia reader components/services, and the Skia package patch/install hook. Keep Skia-free shared comic reader code and image actions.
- Reuse the existing iOS Readium CocoaPods configuration already present in `apps/mobile/app.config.ts`: `ReadiumShared`, `ReadiumStreamer`, and `ReadiumNavigator` `~> 3.11.0` from the Readium podspec repository.
- Restore/adapt a Novella-owned iOS Expo native module. Do not add Readium Kotlin or Android native dependencies. The Expo module autolinks on iOS only; TypeScript has a no-op/unsupported Android implementation so the Android bundle still compiles.
- Preserve existing safe-area/chrome reservation by passing `createReaderChromeInsets()` values into Readium's `navigatorContentInset` delegate. Do not move the existing navigation bars or recreate them inside the native module.
- Preserve the current chapter HTML processing, specifically `processNovelFootnotes()`, `normalizeNovelBlocks(..., { sanitize: false })`, and `inlineNovelFootnotesAfterBlocks()`. Generated XHTML must render the resulting inline note blocks in the same order and retain current marker/body semantics.
- Preserve image preview, links, chapter selection, title/chrome, theme, font gating, settings, chapter preloading, route transitions, lifecycle saves, and backend progress synchronization.
- Preserve outward boundary gestures: a release past the beginning opens the previous chapter at `end`; a release past the end opens the next chapter at `start`. The native wrapper must emit a unified boundary event for JS rather than making the screen inspect Readium internals.
- Readium's reflowable content has percentage progression rather than stable device page numbers. The novel chapter slider must display and seek chapter percentage (`0%...100%`), not page current/total. Comic page sliders remain page based. The backend remains `SaveReadPosition { bookId, chapterId, position }` with the existing canonical block/XPath locator.

## Functional requirements

### Publication and resources

1. Generate a local EPUB-like Readium publication with a stable chapter href based on `chapterId`, a complete spine/TOC, target-chapter XHTML, stylesheet, and optional cached WOFF2 font.
2. Materialize only metadata, stylesheet, target chapter, and required font before first paint. Future chapter XHTML is materialized in the existing chapter preload path and must not block the active chapter.
3. Rebase relative chapter image URLs to the existing API origin. Image loading remains native/Readium-driven and non-blocking for text.
4. Keep deterministic `nv-block-N` fragments so locator mapping remains stable.

### Native bridge

Expose one iOS reader view contract with:

- publication URI/id and declared resource hrefs
- initial Readium locator
- normalized reader preferences
- safe-area/chrome content insets
- `onReady`, `onLocatorChange`, `onTap`, `onBoundary`, `onLink`, `onImage`, `onError`, and status events
- imperative `getCurrentLocator`, `goToLocator`, `goToProgression`, `goForward`, and `goBackward`

The JS reader screen must not import Readium Swift types or native navigator lifecycle details.

### Settings

Map current novel settings to `EPUBPreferences`: font size, line height, side margins, first-line indent, paragraph spacing, background/text colors, scroll/paged mode, and page animation fallback. Set `publisherStyles = false` so Novella typography preferences take effect. If Readium cannot exactly reproduce a current setting, document and test the fallback instead of silently dropping it.

### Progress

- On every native locator update, map the locator's stable fragment/text/progression to the current chapter's canonical block locator and pass it through `useReaderPositionSaver`.
- Use locator `locations.progression` for the novel slider and map slider seeks to a Readium locator within the current chapter.
- On exit, background, settings/mode changes, and chapter transitions, query `getCurrentLocator()` before committing the mapped canonical position.
- Ignore stale events from a previous chapter/publication instance.

### Android behavior

The Android novel route must not load a missing Readium native view or Readium Kotlin classes. Render a localized unsupported state (or a no-op native fallback if required by module resolution) while keeping the rest of the Android app buildable. Do not add Android Readium dependencies.

## Acceptance criteria

- [ ] No production novel-reader import or dependency references React Native Skia or `@novella/reader-layout`.
- [ ] iOS native module opens the generated publication, displays the target chapter, and uses Readium 3.11.0 pods.
- [ ] Android TypeScript bundle and native build do not require Readium Kotlin and render the unsupported fallback safely.
- [ ] Current safe-area reservation, title/navigation chrome, status bar, theme colors, and image preview behavior remain intact.
- [ ] Current font cache/WOFF2 gate remains enforced; required-font failure never shows encoded正文 as fallback text.
- [ ] Existing inline footnote extraction/order/marker rendering remains unchanged.
- [ ] Chapter selection, links, previous/next chapter boundary gestures, and `start`/`end` route positions work through the Readium view bridge.
- [ ] Novel progress slider displays percentage and seeks percentage; no novel page count is calculated or shown. Comic progress remains page based.
- [ ] Readium locator updates continue to save and restore the existing backend chapter/block locator protocol.
- [ ] `readerPreloadWindow` continues to materialize future chapter resources asynchronously without delaying the target chapter.
- [ ] Existing automated reader/type/boundary checks pass, plus publication/locator/preferences/percentage mapping tests.
- [ ] iOS native compile and device acceptance remain explicit verification steps; Android Readium implementation is not added.

## Out of scope

- Readium Kotlin integration.
- Comic reader migration or redesign.
- Backend progress schema changes or persisting raw Readium locators.
- Replacing the existing reader navigation/chrome UI.
- Adding a new generic publication service or changing the API chapter/preload protocol.

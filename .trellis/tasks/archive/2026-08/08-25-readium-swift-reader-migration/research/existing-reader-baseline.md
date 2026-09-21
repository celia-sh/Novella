# Existing reader and previous Readium baseline

## Current reader behavior to preserve

- The current `ReaderScreen` keeps native navigation/chrome outside the content renderer: `ReaderNavigation`, `ReaderChapterNavigation`, status-bar style, `createReaderChromeInsets()`, and safe-area handling remain the UI boundary.
- Chapter acquisition remains `useReaderChapter`; chapter preloading remains `useReaderChapterPreload` with `settings.readerPreloadWindow`; progress writes remain `useReaderPositionSaver` plus `stageReaderProgress`/`syncReaderProgress`.
- Current novel HTML processing is `processNovelFootnotes()` followed by `normalizeNovelBlocks(..., { sanitize: false })` and `inlineNovelFootnotesAfterBlocks()`. The generated Readium XHTML must consume this same processed block stream so inline note placement and marker behavior do not change.
- Image previews remain a React modal owned by `ReaderImagePreviewHost`, but the Readium native view must emit a unified image event instead of passing a Skia object.
- Chapter changes use route params and `getAdjacentChapterSortNum()`. Outward boundary gestures must continue calling `openChapter(previous, 'end')` or `openChapter(next, 'start')`.
- The current novel progress slider is page-number based only because the Skia layout knows page/tile counts. Under Readium it must become a 0–100% chapter progression slider; the backend locator format does not change.

## Previous Novella Readium implementation in Git history

Commit `4e22c2e^` contained these Novella-owned pieces:

- `apps/mobile/modules/novella-readium/`: Expo native view and Swift/Android wrappers.
- `apps/mobile/src/services/readium-publication.ts`: deterministic OPF/nav/XHTML generation, stable chapter hrefs, image URL rebasing, inline footnotes, and image preview user script.
- `apps/mobile/src/services/readium-publication-cache.ts`: cache-directory materialization and target-chapter readiness gate.
- `apps/mobile/src/services/readium-preferences.ts`: color, size, line-height, margin, indentation, and mode mapping.
- `apps/mobile/src/services/reader-locator-mapping.ts`: Readium locator ↔ chapter/block position mapping.
- `apps/mobile/src/hooks/use-readium-publication.ts`: book metadata/publication preparation and chapter preload materialization.
- An earlier `reader-screen.tsx` integration using `NovellaReadiumView`.

The current migration should reuse the proven data contracts and tests where they still match, but remove the old Kotlin implementation, add current native boundary-gesture handling, make percentage progress explicit, and retain current safe-area/chrome/footnote behavior.

## Skia removal scope

After Readium becomes the only novel renderer, remove the Skia-only package and runtime surface:

- `@shopify/react-native-skia` dependency and its native patch/package-install hook.
- `packages/reader-layout` and its Skia paragraph/layout code.
- `ReaderSkiaTile`, `ReaderSkiaScroll`, Skia image pool/lifecycle/cache, and Skia font loader.
- Novel-only Skia layout/reflow/window services and tests that have no comic/WebView consumer.
- Skia-specific preview ownership fields; the generic preview continues to load the URI with `expo-image`.

Keep shared comic reader code, generic image actions, current reader-engine normalization/progress contracts, and native UI module code used by the comic reader.

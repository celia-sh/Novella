# Readium Reader Integration Design

## Architecture

The reader is split into four ownership boundaries:

```text
Novella API and settings
  -> publication coordinator
  -> local publication resource store
  -> Novella Readium Expo module
     -> Readium Swift navigator
     -> Readium Kotlin navigator
```

The React screen and existing reader chrome remain the owner of the reader page UI. This task replaces only the body content renderer currently supplied by the WebView. Existing top/bottom navigation bars, chapter navigation sheet, footnote presentation, image preview surface, theme resolution, lifecycle saving, and progress orchestration are reused. The screen loads book/chapter data, normalizes preferences, stages server-compatible progress, and renders a single `NovellaReadiumView`. It does not branch on platform or depend on native toolkit types.

The Expo module owns only content-renderer responsibilities: publication opening, navigator lifecycle, native preference mapping, content resource serving, locator events, link/footnote events, and teardown. It does not own reader chrome or application navigation. Both platforms implement the same serialized props, events, and commands.

## TypeScript Contract

The public module contract contains JSON-safe types only:

- `ReadiumPublicationDescriptor`: publication directory URI, stable book/revision identity, and initial locator.
- `ReadiumLocator`: href, media type, locations, optional text context.
- `ReadiumReaderPreferences`: flow mode, font size, line height, page margins, paragraph indent, colors, and page-turn animation.
- `ReadiumReaderEvent`: ready, locator changed, resource loading, link activated, and structured error.

Native toolkit models are decoded and encoded only inside each platform adapter. React code imports no platform-specific model.

## Progressive Publication Model

A publication has a stable directory and complete metadata/spine, but chapter and image resources are populated incrementally.

```text
reader-publications/{bookId}/{revision}/
  mimetype
  META-INF/container.xml
  EPUB/package.opf
  EPUB/nav.xhtml
  EPUB/styles/reader.css
  EPUB/fonts/book.woff2
  EPUB/chapters/{chapterId}.xhtml
  EPUB/images/...
  state.json
```

Opening is gated only by:

1. book metadata and ordered chapter identities,
2. the target chapter XHTML,
3. the required per-book font when `fontUrl` is present,
4. the minimal container/OPF/navigation/style files.

The native navigator content view is mounted inside the existing content-region frame. The existing top and bottom chrome remains outside that frame and continues to control its visibility and actions. Readium's native content inset/safe-area mechanisms are the primary avoidance mechanism: iOS uses the EPUB navigator content-inset delegate/configuration, whose insets include system safe-area insets; Android uses the navigator's window-inset handling and content padding. `readerSidePadding` maps to Readium's page-margin preference. Toolbar clearance is passed as renderer content inset only when required by the existing overlay layout, without duplicating toolbar UI or hard-coding screen chrome into publication XHTML.

Other chapters and non-critical images are not opening gates. The target XHTML references image URLs that can resolve independently through the native publication resource path or remote cache. Image failure leaves a stable placeholder and does not fail the chapter.

The publication coordinator writes files atomically. It never exposes a partially written target XHTML or font. A revision key includes content conversion mode and publication schema version so incompatible cached output is not reused.

## Preload Semantics

`readerPreloadWindow` remains the sole user-facing chapter lookahead setting.

- `0`: no future chapter preload.
- `1...3`: fetch and materialize that many following chapters.
- An active target chapter load always has priority over background preload.
- Chapter payload preload completes before optional image prefetch for that chapter.
- Image failures do not cancel chapter preload or subsequent queued chapters.
- Chapter change, reader close, or app background aborts pending background work.

The existing chapter preload service remains the policy owner. The publication coordinator consumes completed preload payloads and materializes them into the current publication cache.

## Font Readiness

A book with `fontUrl` cannot transition to reader-ready until its WOFF2 resource has been downloaded, validated as non-empty, atomically stored, declared in OPF as `font/woff2`, and referenced from chapter CSS with a relative URL.

No WOFF2 conversion is part of the primary design. A missing or failed required font produces a retryable loading error while preserving the previous screen; it never reveals undecoded text.

## Locator Mapping

The server remains canonical:

```text
bookId + chapterId + block/XPath locator
```

Publication XHTML assigns a deterministic DOM ID to every normalized block. The ID is derived from the block index within the canonical normalized chapter, not from pagination geometry.

Restore:

1. Resolve `chapterId` to `chapters/{chapterId}.xhtml`.
2. Resolve the canonical block locator to a deterministic block ID.
3. Create a Readium locator with the href and fragment.
4. Add resource progression as fallback only.

Save:

1. Parse `chapterId` from the locator href.
2. Prefer a deterministic fragment and map it directly to the canonical block locator.
3. Otherwise match locator text context against normalized blocks.
4. Use resource progression only as the last fallback.
5. Stage and synchronize through the existing progress projection and server contract.

Toolkit locators are never persisted directly to the backend.

## Preferences

The TypeScript preference adapter is the single source of numeric normalization and defaults. Native platforms map the same object to their toolkit preferences. Existing reader UI controls and settings persistence remain unchanged; only their content-renderer adapter changes.

| Novella | Unified value |
|---|---|
| `fontSize` | relative font scale |
| `readerLineHeight` | line-height multiplier |
| `readerSidePadding` | page margin |
| `readerFirstLineIndent` | paragraph indent |
| `readerViewMode` | paged or scroll flow |
| `readerPagedNoAnimation` | inverse page-turn animation |
| resolved theme colors | background and foreground colors |

Settings not owned by navigator preferences, including preload and image preview behavior, remain application-level policies.

## Links, Footnotes, And Images

Both native adapters normalize link activation to one JS event. Internal note links are resolved in native publication context and emitted with target href, relation, and optional extracted content. React reuses the existing footnote session/sheet and image preview surface without platform branching. Readium is not responsible for presenting the reader chrome or replacing these existing UI surfaces.

Image activation is emitted through the same link/resource event boundary. Long-press preview remains controlled by the current setting and is handled by one TypeScript callback.

## Dependency Compatibility

Android uses Readium Kotlin `3.1.2` from Maven Central and only the shared, streamer, and navigator modules. It does not include the toolkit source build or require a host Kotlin/AGP upgrade.

iOS uses Readium Swift `3.11.x` CocoaPods modules compatible with the current iOS deployment target. Required pods are shared, streamer, and navigator; the local HTTP adapter is included only if navigator resource serving requires it after native build validation.

Dependency versions remain pinned in the local module build files and are verified by clean native dependency resolution and compilation.

## Rollout And Rollback

The existing WebView reader remains available behind an internal implementation switch until both native builds and position round trips pass. No backend migration is required. Rollback selects the previous reader implementation and leaves server positions unchanged.

After acceptance, the WebView implementation and obsolete tests can be removed in a separate commit so the native module addition and behavioral switch remain reviewable independently.

## Failure Handling

- Invalid publication cache: delete the affected revision and rebuild the minimum opening set.
- Required font failure: block content, expose retry.
- Target chapter failure: show current reader error state, do not fall back to placeholder chapter text.
- Future chapter failure: preserve current reading and retry on navigation.
- Optional image failure: preserve layout placeholder.
- Native open failure: structured error with phase and recoverability, no raw platform exception exposed to UI.

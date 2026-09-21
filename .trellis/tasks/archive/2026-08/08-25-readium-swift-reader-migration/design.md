# Design: Readium Swift novel reader

## Architecture

```text
useReaderChapter + useReaderFont
        │
        ├─ processNovelFootnotes
        ├─ normalizeNovelBlocks(sanitize:false)
        └─ inlineNovelFootnotesAfterBlocks
        │
        ▼
Readium publication cache (TS, local directory)
        │  OPF/nav/stylesheet/target XHTML/WOFF2
        ▼
NovellaReadiumView (iOS Expo native view)
        │  ReadiumShared + Streamer + Navigator 3.11
        ├─ Locator events → TS block/progression mapping → SaveReadPosition
        ├─ tap/image/link/boundary events → existing React UI/navigation
        └─ content inset/preferences/imperative commands
```

The React screen remains the owner of API requests, chapter selection, settings, progress persistence, preview modal, and navigation. Swift owns only publication opening, Readium navigator lifecycle, native view containment, event conversion, and native gesture observation.

## iOS-only Expo module

Restore `apps/mobile/modules/novella-readium` as a local module with:

- `expo-module.config.json` containing `platforms: ["ios"]` and only the iOS module registration.
- `NovellaReadium.podspec` depending on `ExpoModulesCore`, `ReadiumShared`, `ReadiumStreamer`, and `ReadiumNavigator` `~> 3.11.0`.
- `NovellaReadiumModule.swift` registering `NovellaReadiumView` and its props/events/ref commands.
- `NovellaReadiumView.swift` implementing `EPUBNavigatorDelegate` and `WKScriptMessageHandler`.
- TypeScript bindings exposing platform-neutral JSON locator/preferences/events.
- A non-iOS TypeScript fallback component which renders no publication content and never calls `requireNativeView('NovellaReadium')`; `ReaderScreen` shows the localized unsupported state on Android before it tries to present the view.

Native event payloads are plain JSON-compatible values. `Locator` is bridged through `locator.jsonObject.mapValues(\.any)` and reconstructed only inside Swift for commands.

## Publication cache

Reuse the prior Novella publication generator/cache, with these current-reader changes:

1. `buildReadiumPublicationResources()` creates a stable OPF spine and nav from chapter IDs. Hrefs are `EPUB/chapters/{chapterId}.xhtml`; sort numbers never define identity.
2. `materializeReadiumChapter()` applies the current footnote pipeline and passes the resulting block HTML into `buildReadiumChapterDocument()`.
3. Chapter XHTML adds deterministic `nv-block-{index}` IDs, relative `../styles/reader.css`, API-origin image rebasing, and an image interaction script. The script must prevent a preview tap from becoming an edge page-turn/tap event and must respect the current long-press setting.
4. The stylesheet keeps publisher styles disabled through Readium preferences and carries the existing body/paragraph/table/image/ruby/inline-footnote behavior. Do not use Skia layout or image objects.
5. The readiness gate waits for metadata, stylesheet, target chapter, and required font only. Future chapters are written by the existing preload subscription.

The publication directory is chapter/conversion scoped. The cache writes through temporary files and renames them, so the native reader never observes a partially written XHTML resource.

## Locator and progress contract

### Restore

`readerPositionToReadiumLocator(position, chapterId, blocks)` returns:

- `href: EPUB/chapters/{chapterId}.xhtml`
- `type: application/xhtml+xml`
- `locations.fragments: [nv-block-N]` when the canonical locator maps to a block
- `locations.progression` as a fallback within the current chapter

`openPosition=start/end` resolves to the first/last block before the locator is sent to native.

### Save

`onLocatorChange` first verifies the active chapter/publication key. It maps a matching fragment to that block; otherwise it uses text anchors and then `locations.progression`. It stages `{bookId, chapterId, position: block.locator}` through the existing debounced saver.

`getCurrentLocator()` is queried before lifecycle/chapter/settings commits. `locations.progression` is stored separately in React state for the chapter percentage slider; it is not sent to the backend.

### Percentage slider

Add a display variant to the existing progress slider rather than creating a second toolbar:

- comic/default variant retains `current / total` and page snapping.
- novel/percentage variant uses a 0.01 step, displays `Math.round(progress * 100)%`, and does not call page-count estimation.
- iOS native progress bar receives an optional `progressLabel` and disables page snapping when `totalPages=0`; Android's JS progress bar renders the same label for the fallback/comic-compatible path.
- seek invokes native `goToProgression` or a JS-built locator for the active chapter. If Readium cannot locate an exact progression, retain the latest valid locator and report a recoverable command failure without changing backend state.

## Readium preferences and chrome

`createReadiumReaderPreferences()` maps current settings to `EPUBPreferences` JSON:

- `fontSize`: current points / Readium base size (existing mapping)
- `lineHeight`: current multiplier
- `pageMargins`: current side padding / existing base
- `paragraphIndent`: two CJK cells when enabled, otherwise zero
- `paragraphSpacing`: current setting
- `scroll`: `mode === 'scroll'`
- `columnCount`: one or two only when the current large-screen double-page policy permits it
- opaque background/text colors
- `publisherStyles: false`

`createReadiumContentInsets()` continues to receive the existing `createReaderChromeInsets()` top/bottom values. Swift implements `navigatorContentInset(_:)` and does not add a second RN padding layer.

When preference props change, Swift calls `navigator.submitPreferences()` and rebinds native input/gesture observers. The current location stays in the native navigator; React saves a canonical checkpoint before changing settings.

## Native input and boundary behavior

- Paged edge taps use Readium's `DirectionalNavigationAdapter` with the current 30% edge policy and no animation when the setting requests it.
- Native `.tap` observer emits `onTap` for unconsumed taps so React can toggle the existing reader chrome. Image preview messages set a one-event suppression flag; the same image tap cannot toggle chrome or turn a page.
- A `UIPanGestureRecognizer` with `cancelsTouchesInView = false` observes release direction without owning the Readium scroll/paging recognizer. At release it finds the active descendant `UIScrollView`, checks whether it is at the outward top/bottom or left/right boundary, and emits `onBoundary({ direction: "previous" | "next" })`. It does not emit during an ordinary in-content drag.
- Swift rebinds the recognizer after navigator/presentation changes and invalidates all observer tokens on detach/deinit.
- JS ignores a boundary event when there is no adjacent chapter; otherwise it calls the existing `openChapter()` with `end` or `start`.

## Android fallback

The module's native registration is iOS-only. The platform-neutral TS export resolves to a no-op view on Android, and the reader screen uses a compile-time platform guard to render a localized unsupported state rather than opening an unregistered native view. No Android Gradle, Kotlin, or Readium dependency changes are made.

## Skia removal

Delete the Skia-only package and surface after the Readium path is in place:

- mobile Skia components/services/font loader and their tests
- `packages/reader-layout` workspace and tsconfig alias
- novel-only layout/reflow/window/page services and tests
- Skia fields/branches in `ReaderImagePreview`
- root `patch-package` hook, Skia patch, and `.gitattributes` entry if no other patch remains
- `@shopify/react-native-skia` and `@novella/reader-layout` package-lock entries

Keep `reader-page-progress` and `reader-display-layout` only where the comic reader uses them; do not remove shared comic behavior accidentally.

## Rollback

The branch remains easy to bisect: the Readium integration and Skia removal should be committed in coherent slices (native/publication path, screen/progress integration, then dependency cleanup). The prior Skia implementation is available in Git history, but it is not retained as a runtime fallback in the final migration.

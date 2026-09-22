# Reader Reference And Boundary Notes

## Authority

- `the Web-Master reference implementation` is authoritative for reader data and operations.
  The current checkout exposes `GetNovelContent` in
  `src/services/chapter/index.ts`, and `GetComicInfo` / `GetComicContent` in
  `src/services/manga/index.ts`.
- `[BRANCH]` is authoritative for mobile reader behavior and content
  preparation. Relevant files are `lib/features/reader/reader_paged_page.dart`,
  `reader_scroll_page.dart`, and the `shared/reader_*` helpers.
- Web-Master reader presentation is not a UI reference. Its novel page is a
  browser `HtmlReader` surface and its manga reader is a desktop-oriented
  Quasar layout. RN will use the protocols and content rules only.

## Gist Sync Decision

Gist sync is removed from the RN product. The Flutter-specific encrypted Gist
envelope and settings-preference sync are not part of the RN feature set.
Reader positions are different: Web-Master's existing `SaveReadPosition`
operation is the cross-device reader synchronization protocol. RN keeps a local
position cache for fast restore and offline continuity, then reads/writes the
server position when the authenticated protocol is available.

The `Sync` settings destination and `appSettingsSyncEnabled` control therefore
must disappear. Authentication remains available for server-backed features,
but it is not presented as a Gist/settings synchronization feature.

## Novel Content Contract

Web-Master requests `GetNovelContent` with `Bid`, `SortNum`, and optional
`Convert` (`t2s` or `s2t`). The response contains a chapter (`Id`, `BookId`,
`Title`, `Content`, optional `Font`, `SortNum`, chapter title list, edit flag)
and an optional server `ReadPosition` (`ChapterId`, `Position`).

The RN reader must:

1. Sanitize text nodes and malformed entities before rendering.
2. Remove metadata, hidden nodes, and non-renderable wrappers.
3. Preserve block identity using a stable XPath-compatible locator for server
   progress, while using an internal block key for React reconciliation.
4. Recognize headings, paragraphs, lists, tables, block quotes, horizontal
   rules, inline markup, ruby, footnotes, and reader illustration blocks.
5. Keep image aspect-ratio placeholders stable while images load.
6. When `Font` is present, download its dynamic WOFF2 file through a mobile
   cache adapter, convert it to TTF, register the native family, and remove the
   font's empty placeholder codepoints before rendering. Content rendering
   must not depend on a WebView.

### Rendering Boundary

The reader has two deliberately separate layers:

```text
native RN reader shell
  navigation, chapter toolbar, mode switch, settings, chapter controls,
  scroll/paged containers, progress persistence, loading and error states
        |
        v
RN content surface
  react-native-render-html + the existing custom ruby renderer
  (native Text/View output, never a WebView)
```

`react-native-render-html` owns HTML layout and inline markup conversion. The
custom renderer owns ruby annotation and reader-specific inline behavior. The
reader shell must not move those responsibilities into navigation code, and
the content surface must not become responsible for chapter navigation,
position synchronization, or reader settings.

### Dynamic Chapter Font Pipeline

Web-Master sends obfuscated chapter content together with an optional dynamic
WOFF2 `Font` URL. Flutter's current implementation establishes the complete
mobile behavior:

1. Resolve relative font URLs against `[API_ORIGIN]` and
   download WOFF2 bytes.
2. Convert WOFF2 to TTF with Rust `woofwoof` and cache the TTF.
3. Inspect the TTF with `ttf-parser` and collect codepoints whose glyph has
   zero advance and no bounding box. These are empty obfuscation placeholders.
4. Decode/repair HTML text entities, remove those placeholders from text
   nodes, then render the remaining encoded text with the registered family.

RN keeps the same behavior in the local `novella-rs` Expo module. Android
packages Rust shared libraries for the four Expo ABIs and iOS embeds
`NovellaRs.xcframework`; shared packages never import the native module.
`packages/reader-engine` owns platform-neutral placeholder normalization and
handles literal codepoints, decimal entities, hexadecimal entities, and
entities interrupted by zero-width characters. The mobile content component
passes the loaded family through `baseStyle` and the
`react-native-render-html` `systemFonts` allowlist so native Text nodes actually
use it. If a chapter declares `Font` but downloading, conversion, inspection,
or registration fails, show an unavailable/retry state instead of rendering
the encoded content with a platform font. Chapters without `Font` use the
platform font normally.

## Novel Modes

### Scroll mode

Use a virtualized RN list of reader blocks. Track the first visible block and
its stable locator, debounce local persistence, and send the same locator to
`SaveReadPosition`. Restore the saved chapter and locator after the list is
attached. Chapter changes open at the first or last block depending on the
direction of navigation.

### Paged mode

Use a horizontally paged RN list of measured page models. Page models are built
from the same normalized blocks as scroll mode. A layout key includes viewport
size, font metrics, line height, side padding, theme, and content revision.
Block heights are measured on the native tree; a long text block may be split
by measured line ranges rather than being allowed to overflow a page. Rebuild
pagination when the key changes, retain the current locator where possible,
and keep adjacent chapter data warm without making it part of initial display.

Page turns use a 48 dp swipe threshold, support animated or immediate turns,
and open the previous/next chapter at its end/start respectively. No browser
pagination or DOM measurement is used.

## Comic Content Contract

Web-Master's comic API exposes:

- `GetComicInfo(id)`: book metadata, chapter summaries, and optional server
  read position.
- `GetComicContent(cid, skip, take)`: chapter metadata (`Total`, `Skip`) and a
  batch of image descriptors (`Url`, `Placeholder`, `Width`, `Height`).

The RN reader preallocates the chapter from `Total`, fills image slots by
`Skip`, and requests batches on demand. Image descriptors retain their source
dimensions so placeholders do not change layout. The native image adapter
owns caching and decode memory policy.

## Comic Modes

- Scroll mode renders a virtualized vertical image list and stores the visible
  image index as the local position.
- Paged mode renders a native horizontally paged list. A page window keeps the
  current page plus nearby pages mounted/preloaded, preventing flashes during
  a turn. The initial implementation supports single-page phone layouts and a
  two-page layout only when the viewport and image aspect ratios allow it.
- The direction and chapter navigation state are reader-engine data, not Web
  layout state. The RN control surface can expose RTL and page-pairing later
  without changing the API or image loader contracts.

## Shared State And Persistence

The platform-neutral reader engine owns content normalization, mode state,
chapter cursor, progress calculation, and position identifiers. It does not
own React state, storage, image decoding, or navigation.

Mobile adapters provide:

- local key-value/SQLite persistence for per-device reader settings and last
  positions;
- HTTP/SignalR access through `api-client`;
- font and image cache access;
- lifecycle hooks for saving on background and route exit.

There is no Gist adapter, sync crypto dependency, settings sync toggle, or
settings merge path in the RN reader. Server reader-position synchronization
remains required.

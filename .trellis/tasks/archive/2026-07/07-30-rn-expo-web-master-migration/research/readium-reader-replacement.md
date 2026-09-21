# Readium Reader Replacement — Integration Design

Status: research/design (no code yet)
Scope: novel reader rendering engine swap (react-native-render-html → Readium),
kept behind the existing reader screen chrome. Comic reader unchanged for now.

## 0. Decision Summary

| Question | Verdict | Evidence |
| --- | --- | --- |
| Custom/encrypted font mounting | ✅ Feasible, simpler than today | WebView engines render WOFF2 natively; Readium CSS + EPUB Fonts docs support injected `@font-face` and `fontFamilyDeclarations`; existing WOFF2→TTF Rust path is reusable if a face file needs TTF |
| Embed inside existing reader UI | ✅ Native design contract | Official: navigators have no UI; app owns all chrome. Neptune `modules/readium` proves Expo-View embedding on both platforms |
| Position interop (server format unchanged) | ✅ Feasible with an RN mapping layer | Readium `Locator` (href + progression + text anchors) ↔ `chapterId + blockLocator`; server `SaveReadPosition` stays byte-identical |
| Content source (no server EPUB) | ⚠️ Client-built RWPM; two variants below | `ReadiumWebPubParser` (Swift) + kotlin EPUB profile RWPM (3.2+, PR #749) both support HTTP-backed manifests |

## 1. Today's Reader (baseline to replace)

- Rendering: `react-native-render-html` (native text layout, no WebView). Self-built
  machinery: paged measurement layer, block slicing, Ruby renderer, footnote popovers.
- Content: per-chapter API `GetChapterContent` → `NovelChapterContent { id, title,
  content (HTML fragment), fontUrl, sortNum, chapterTitles }`.
- Font: `fontUrl` is a WOFF2 URL; chapter text carries private/special codepoints
  that the font maps to glyphs (no font → mojibake). Today: Rust `convertWoff2ToTtf`
  → expo-font native family → renderer fontFamily; `invisibleCodepoints` sanitizer
  strips format codepoints.
- Position: `SaveReadPosition { bookId, chapterId, position }`, position = XPath-style
  block locator from `normalizeNovelBlocks`; restore via `findReaderBlockIndex`.

## 2. Content Pipeline: client-built RWPM

Readium needs a `Publication`. Novella has no EPUB; chapters come from an API.
Build the manifest client-side.

```
manifest (RWPM JSON, built in RN):
  metadata: { title, author, language }          <- BookDetail
  readingOrder: [ { href, type: "text/html", title } x N ]   <- chapters
  resources: [ font link(s) ]
```

### Variant A1 — stream RWPM over HTTP (server changes 2 lines)
`href` = chapter API URL. Server must (a) wrap the HTML fragment into a full XHTML
document, (b) send CORS headers (font + resources). Readium fetches per chapter;
existing API cache/CDN absorbs repeat reads. Cost: API service changes; readium
issues HEAD per resource on open (kotlin #735) — pressure on chapter endpoint.

### Variant A2 — client-side resource injection (server unchanged, recommended)
Manifest hrefs use a virtual scheme (`novella://chapter/{id}`). The native module
implements a Readium `ResourceTransformer`/interceptor: RN pre-fetches chapter HTML
(reusing `use-reader-chapter` + cache), wraps it into a full XHTML document
(`<!DOCTYPE html>…<body>…`), and serves it to the navigator by id. Position/toc
services work because the transformer reports bytes. Fonts are served from the
existing on-disk font cache (no CORS issue at all). Cost: transformer code in the
native module; chapter pre-fetch stays in RN where it already lives.

Recommendation: **A2**. It keeps the API service untouched and reuses both caches
(chapter + font). A1 remains a fallback if transformer complexity bites.

## 3. Font Mounting (must-have)

Mechanism: per-chapter font (when `fontUrl` present) is downloaded by the existing
`reader-font-loader` cache, then handed to the navigator as a local font:

- iOS: `EPUBNavigatorViewController(config: .init(fontFamilyDeclarations: [
  CSSFontFamilyDeclaration(fontFamily: "NovellaChapterFont",
    fontFaces: [CSSFontFace(file: <cached woff2/ttf>, style: .normal, weight: .standard(.normal))]) ]))`
- Android: equivalent in `EpubNavigatorFactory.Configuration`; if the 3.x API lacks
  a declarations hook, fall back to injecting `@font-face { src: url(file://…) }`
  into each resource head (Readium CSS custom-fonts doc) and set
  `EpubPreferences.fontFamily = "NovellaChapterFont"`.
- Apply: `EPUBPreferences.fontFamily = "NovellaChapterFont"` when a chapter font
  exists; `nil` (publisher/author default) otherwise.
- Unknown: whether `CSSFontFace` accepts WOFF2 (docs show ttf/otf). If not, reuse
  the existing Rust `convertWoff2ToTtf` — already in the build.
- Failure gate stays in RN: if the chapter font fails to download/register, do not
  render the chapter (same as today) — prevents mojibake. The invisible-codepoint
  sanitizer can be dropped for rendering (WebView maps codepoints via the font),
  but keep it for any text-anchor matching in the position mapper.

## 4. Position Interop (server format unchanged)

Server contract stays `{ bookId, chapterId, position }`; `position` remains the
existing block locator. All conversion lives in RN.

Save (native → server):
1. `onLocatorChange(Locator)` → Locator JSON `{ href, locations{progression, position, totalProgression}, text{before, after} }`
2. Map `href` → chapter id (readingOrder index ↔ chapter map)
3. Anchor on `text.before` (text just above the visible point): search in
   `normalizeNovelBlocks(chapterHtml)` text → block locator + intra-block ratio
4. Persist `{ chapterId, position: blockLocator }` through the existing
   debounced `useReaderPositionSaver` (450ms) — identical to today's writes

Restore (server → native):
1. Load `readPosition { chapterId, position }` (existing detail/chapter API)
2. Rebuild blocks; find block → block text
3. progression ≈ block text offset / chapter total text length
4. `initialLocator = { href: chapterHref, locations: { progression } }` →

`goToLocation(locator)` / `initialLocation`. Precision is block-level, matching
today's restore semantics. `Locator.text` anchors make saves more precise than
the current offset-only scheme.

## 5. Native Module Interface (mirror Neptune, adapt)

New local Expo module `modules/novella-readium`:

- iOS: Swift + `Readium.podspec` deps `ReadiumShared/Streamer/Navigator 3.x`
  (pod source `github.com/readium/podspecs`); `EPUBNavigatorViewController` hosted
  in an `ExpoView` subclass (Neptune `EPUBView.swift` pattern).
- Android: Kotlin + `org.readium.kotlin-toolkit:readium-{shared,streamer,navigator}`
  (mavenCentral); `EpubNavigatorFragment` in a child `Fragment` under the Expo view
  (Neptune `EPUBView.kt` pattern).

View props: `manifest` (RWPM JSON), `initialLocator`, `locator`, `preferences`
(fontSize, lineHeight, backgroundColor, textColor, publisherStyles, scroll/paged,
readingProgression), `fontFile` (cached chapter font path + family), plus
`onLocatorChange`, `onReady` (TOC + metadata), `onError` events.

Commands: `goToLocation`, `goForward`, `goBackward`, `goToChapter(index)`,
`setPreferences`, `destroy`.

Events needed by chrome: `onLocatorChange` (progress save + bottom counter),
link taps → footnote sheet (readium tap event exposes href → RN opens existing
footnote popover), `onReady` → chapter list.

## 6. RN Layer Rework (reader-screen)

Delete: measurement layer, paged slice math, custom paged/scroll handling,
`html-ruby-renderer`, expo-font registration (keep Rust only if TTF fallback
needed), block-based scroll sync.

Keep: `ReaderNavigation` (top bar), `ReaderChapterNavigation` (bottom bar —
already fixed this session), chapter sheet (now backed by Readium TOC/go),
settings sheet (maps to `EPUBPreferences`; existing reader settings keys map
1:1: fontSize, lineHeight, theme colors, scroll/paged, ruby toggle, etc.),
footnote popover (via link-tap events).

Behavior deltas to port: chapter preload (next-chapter fetch), position
save/restore (mapper), open-at-`start`/`end` (href + progression 0/1), Ruby
rendering now native (`<ruby>` in WebView — better than the RN renderer).

## 7. Phased Rollout

- **P0 spike (iOS first)**: clone Neptune module, open one real chapter as RWPM
  (A2 transformer), verify (a) encrypted-font rendering, (b) locator events +
  goToLocation round trip, (c) preferences (theme/font size/scroll-paged).
- **P1 mapping**: `locatorToReaderPosition` / `readerPositionToLocator` + server
  position write/restore against live API; font cache reuse; failure gate.
- **P2 reader-screen migration**: swap engines, port chrome/popovers/settings.
- **P3 Android parity** + decide comic (Divina) separately.
- **P4 full checks**: a11y (dynamic type, screen reader), offline cache, perf
  (open time, memory), regression pass on both platforms.

## 8. Risks

- kotlin custom-font declaration hook unverified (spike item).
- RWPM streaming issues HEAD per resource (A1 only; A2 unaffected).
- WebView a11y (readium has a11y support; verify VoiceOver/select).
- Binary size +~10MB per platform; dev-client rebuild required (CNG-safe:
  native module added to `modules/`, iOS prebuild only for local testing).
- Position precision is block-level on restore (equal to today).

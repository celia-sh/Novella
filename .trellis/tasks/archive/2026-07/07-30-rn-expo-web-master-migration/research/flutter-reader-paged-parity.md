# Flutter Paged Reader Parity Contract

## Authority

Primary source: `archive/flutter:lib/features/reader/reader_paged_page.dart`.
Supporting sources are `reader_scroll_page.dart`, `shared/reader_block_utils.dart`,
`shared/reader_image_view.dart`, `shared/reader_preload_policy.dart`, and the
reader settings provider. This document records behavior from the source. A
screenshot is verification evidence only; it is not the layout specification.

## Render Stages

The paged reader has three separate stages:

1. **Prepare chapter data.** The chapter is sanitized, footnotes are processed,
   blocks are selected, and image aspect ratios are resolved before display.
2. **Measure.** A separate measurement layer renders every block using the
   current content width, font family, font size, line height, paragraph gap,
   side padding, indent setting, and page mode. Each block reports one height.
   Measurements are buffered and flushed after the frame. A measurement key
   identifies the complete typography/layout configuration.
3. **Display.** Page slices are created only after every block in the active
   chapter has a measurement for the current key. The visible `PageView`
   does not own pagination measurements. Rebuilding a layout key restores the
   saved XPath after the page model exists.

This separation is required for stable page turns. The visible page model must
not be rebuilt from image load or visible-page `onLayout` callbacks.

## Page Geometry

The source defines these constants:

| Item | Value |
| --- | ---: |
| top button size | 44 dp |
| top horizontal inset | 12 dp |
| top vertical inset | 8 dp |
| top bar gap | 12 dp |
| content top gap | 20 dp |
| content bottom gap | 32 dp |
| page-turn trigger | 48 dp |
| double-page gap | 24 dp |

The top content padding is `safeAreaTop + 8 + 44 + 20`. The normal bottom
content padding is the stable reader bottom inset plus 32. The page content
height is the viewport height minus those paddings, clamped to a minimum of
220 dp. A standalone image page uses the reader bottom inset plus the page
indicator avoidance region instead of normal bottom padding.

For a single page, horizontal padding is the configured reader side padding,
clamped so at least 48 dp of content width remains. In a double-page layout,
the available page width is `(viewportWidth - 24) / 2`, then the same padding
rule is applied to each page.

## Block And Page Cost

Blocks are normalized before pagination. Paragraph spacing is not a universal
gap: it is added before a block only when the preceding block is a reader
paragraph (`p`, `div`, `blockquote`, or `center`) and the current block is not
the first one. The page cost is:

`@text
measuredBlockHeight + paragraphSpacingBeforeBlock + 4 dp
`

When adding a block would exceed the page budget, the current page closes before
that block. A page always contains at least one block. A standalone image block
is treated as an image-only page and is centered inside the page viewport.

Long text blocks must be split by measured line ranges in a complete RN port;
they must not overflow a page or be allowed to change the page model after the
visible `PageView` is mounted.

## Images

Flutter makes image dimensions deterministic before measurement. Explicit
`width`/`height` attributes are used first. Otherwise the image provider is
resolved and its natural aspect ratio is persisted by source URL. The rendered
image receives a stable aspect-ratio box (ordinary images are constrained to
the reader content width; floating images are capped at 160 dp; illustration
images are centered and preserve their ratio). Flutter awaits all missing
active-chapter aspect ratios with `Future.wait`; pixels are then displayed by
`CachedNetworkImage` inside those boxes. Flutter reader images use a 4 dp
radius.

The approved RN implementation keeps Flutter's geometry/pixel separation but
does not copy its global first-visit network barrier. It uses explicit or
persisted dimensions when available. Unknown standalone illustrations receive
a page-sized stable frame with a centered 2:3 visible placeholder; other
unknown chapter images receive stable 2:3 fallback frames. Hidden measurement renders geometry-only placeholders
and cannot mount `expo-image`. Visible page images use `contain` inside the
frozen measured frame, so `onLoad` never changes the active page model. Natural
dimensions discovered by visible pages are persisted for later chapter/layout
builds.

## Typography Rules

- Default reader font size is 18 dp; allowed range is 12–32.
- Default line-height multiplier is 1.6; allowed range is 1.2–2.4.
- Default side padding is 30 dp; allowed range is 0–48.
- First-line indent is an inline marker of `fontSize * 2`, not literal text.
- Ruby is a measured inline unit with annotation above the base glyph. Ruby,
  images, footnotes, and other custom inline widgets must not be flattened
  into ordinary text when determining page boundaries.
- `h1`–`h4` use independent size, line-height, alignment, and margins. Reader
  preset classes (`emXX`, `pius1/2`, `ph4`, `right`, `left`, `center`, `zin`,
  `bold`, `ita`, `stress`, `author`, `message`, `cut-line`, `meg`, `lh`, `m0`,
  `p0`, color, float, vertical-align, and dot classes) are applied before
  measurement.
- An explicit empty paragraph is preserved only when it contains a `br`, has no
  text, and has no non-footnote image.

## Position And Rebuild Rules

The saved position is an XPath-compatible block locator. A layout rebuild keeps
the locator, finds the containing page after pagination, and jumps once after
the page view has clients. Page data, current page, and restoration state are
not reset from image callbacks. Adjacent chapter data may be preloaded, but an
unmeasured adjacent chapter is not inserted into the visible page window.

## RN Deviation And Required Fix

The first RN implementation measured blocks in the visible `FlatList` while
using those same measurements to change `pages`. A later revision moved
measurement offscreen but introduced another global gate: it called
`expo-image.loadAsync` for every unknown chapter image (four at a time, up to
12 seconds each) before showing any page, and retained dimensions only in
process memory.

The accepted RN contract is now:

1. hydrate one bounded persistent geometry cache; never fetch image pixels as a
   prerequisite for chapter display;
2. render a separate geometry-only hidden measurement layer for all active
   blocks;
3. give every unknown image a deterministic 2:3 placeholder, while standalone
   image pages keep outer pagination geometry independent of natural ratio;
4. wait only for local metadata hydration and block layout, then build the
   visible page list once;
5. freeze visible image frames for that layout and persist dimensions learned
   from `onLoad` without repagination;
6. let the page `FlatList` window load the active chapter's current/nearby
   images without gating display; after display, an optional 0–3 chapter
   lookahead may preload future chapters and their images at background
   priority;
7. cancel not-yet-started lookahead work on chapter change, reader exit, or app
   background, while ignoring the result of the single non-cancellable in-flight
   operation;
8. use 4 dp continuous clipping for image, placeholder, and error states; and
9. never attach visible-page `onLayout` callbacks to the pagination source.

Scroll mode may adapt image size after load, but it must not share mutable
measurements with the paged display while a page turn is in progress.

# Design — Improve Comic Long-Page Presentation

## Architecture

Keep the behavior in the pure mobile layout service, `apps/mobile/src/services/reader-display-layout.ts`. The service already owns display-slot grouping, display-index resolution, spread sizing, and viewport restoration. `ComicReaderScreen` continues to own data loading, rendering, and progress publication.

No API, reader-engine, native-module, or persistence changes are required.

## Data Flow

```text
ComicPageSlot[] (original logical indexes)
  -> createComicPageDisplaySlots(slots, columns, viewport options)
  -> ComicPageDisplaySlot[] (contiguous display indexes, unchanged page indexes)
  -> paged FlatList / fitComicPageSpread / clipped segment windows
  -> continuous FlatList / segment-sized vertical items
  -> visible display item resolves back to the last logical page
  -> reader progress persists the original 1-based page number
```

`createComicPageDisplaySlots()` will use a local pairability predicate and optional phone segmentation:

- `columns < 2`: emit one page per display slot, preserving logical page order. In a phone-sized paged or continuous viewport, a known landscape page (`width > height`) is represented by two consecutive horizontal segment items; a known page with an aspect ratio of at least `2:1` is represented by consecutive clipped vertical segment items when its width-fitted height exceeds the viewport.
- `columns >= 2`: if the current page is wide (`valid width > valid height`), emit it alone; otherwise pair it with the next page only when that next page is also portrait or lacks valid dimensions. Phone segmentation is disabled for this path. Continuous mode always consumes the single-column segment items rather than the two-column spread slots.
- Invalid or absent dimensions use the existing `2:3` fallback semantics and remain pairable; they are never segmented.

The predicate is intentionally based on metadata already present in `ComicPageImage`; it does not inspect native image pixels or wait for `expo-image` events.

## Aidoku Compatibility Mapping

Aidoku's relevant invariant is `isPagePairable()`: a loaded wide image is not pairable, so the page is isolated and does not compress a neighboring page. The implementation mirrors that invariant at display-slot construction time. Aidoku's optional `splitWideImages` path would create cropped image resources and change display-page counts. The phone feature here uses virtual horizontal or vertical windows over the original image: it changes only the local FlatList display slots, while the source URI, logical page index, and persisted server progress remain unchanged. For RTL, horizontal segment source offsets are reversed without changing logical segment indexes.

## Restoration and Direction

Display slots are derived in logical order before RTL rendering. Existing RTL reversal happens inside `ComicPageSpread`, so grouping remains independent of physical direction. Existing `resolveComicDisplayIndex()` uses the fixed-column arithmetic and must be adapted to the same grouping model; otherwise a saved/live page after an isolated wide page would point at the wrong FlatList item.

To keep this cross-function contract explicit, add a pure resolver that finds the display-slot index containing a logical page from the actual generated slots, and use it for viewport restoration, initial scroll, progress jumps, and tap navigation. The resolver should retain the old arithmetic fast path only when all slots are uniform two-column groups; the straightforward bounded search is preferable because chapter page counts are modest and it cannot drift from the grouping rule.

## Compatibility and Risks

- Continuous mode consumes the single-column segment items and uses each segment's measured frame height; it does not alter the source image or logical progress contract.
- Unknown metadata can briefly pair using the stable fallback. This avoids layout churn and follows the existing geometry contract; server metadata is authoritative when available.
- Isolating wide pages increases the number of horizontal display items but does not alter logical progress values.
- A long phone page may occupy multiple display items with the same logical page index; paged/continuous navigation tracks the display item while progress tracks the logical page.
- Continuous offsets and restore indexes use segment heights, while paged offsets remain fixed viewport widths.
- The final portrait page remains a one-page slot.
- A grouping-aware display resolver must be used everywhere a logical page is translated to a display index; leaving one arithmetic call site would cause incorrect restore or slider behavior.

## Rollback

The change is isolated to the display-layout service, its tests, and call sites that translate logical pages to display slots. Reverting those files restores the prior fixed-pair behavior without touching data or native state.

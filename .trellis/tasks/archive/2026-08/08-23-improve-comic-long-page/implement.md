# Implementation Plan — Improve Comic Long-Page Presentation

## 1. Define metadata-aware display grouping

- Extend `apps/mobile/src/services/reader-display-layout.ts` with a pairability predicate and grouping helper.
- Keep continuous mode unchanged and keep ordinary one-column pages as one display slot.
- On phone-sized single-column paged and continuous viewports, expose known landscape pages as two horizontal virtual segment slots and known `2:1`-or-taller portrait pages as consecutive vertical segment slots; do not duplicate or renumber their logical page slots.
- Isolate known wide pages and pair only compatible adjacent pages in double-column mode.
- Add focused tests for portrait pairs, wide-page isolation, wide pages between portrait pages, unknown metadata, final odd pages, virtual long-page segments, and segment-aware restoration.

## 2. Replace fixed-column logical-to-display conversion

- Add a pure helper that resolves the display slot containing a logical page from the generated slots.
- Use it in comic screen initial restore, viewport resize restoration, progress slider jumps, page taps, and mode restoration.
- Preserve existing page-index clamping and RTL rendering order.

## 3. Verify presentation invariants

- Confirm `fitComicPageSpread()` still receives one or two source pages and preserves source aspect ratios.
- Confirm a horizontal or vertical virtual segment clips the source image without distorting it, reverses horizontal source offsets for RTL, and retains the same source URI and logical page index.
- Confirm continuous mode uses the single-column segment items, measures each segment height in `getItemLayout`, and keeps logical progress page-based.
- Confirm progress and chapter transitions continue to save logical 1-based page numbers while taps/swipes advance segment display indexes.

## 4. Validation

- `npm run test:reader`
- `npm run check`
- `git diff --check`
- Inspect `git diff` for unrelated changes.
- Manual acceptance remains user-owned: open the supplied two-page spread on a phone viewport, verify each half fills a readable page in LTR and RTL; verify a tall source image advances through readable vertical segments and progress stays on its logical page; then open the supplied wide-page chapter on an iPad landscape viewport, verify the wide page occupies one full viewport, swipe through portrait pairs, rotate, and restore the page.

## Risk Points

- `apps/mobile/src/screens/comic-reader-screen.tsx`: every logical-to-display conversion must use the same generated slot list.
- `reader-display-layout.ts`: grouping, virtual segmentation, and restoration must share one source of truth.
- `comic-reader-screen.tsx`: display-index state must be tracked separately from logical progress so repeated segment page indexes still turn correctly.
- RTL: physical page order is reversed at render time, not in logical slot generation.

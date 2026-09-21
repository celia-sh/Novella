# Improve tablet home book previews

## Goal

Show enough novel and comic cards on the home screen to use the tablet grid without downloading or decoding every cover image up front.

## Confirmed facts

- `HomeScreen` renders the “all novels” and “all comics” sections as static grids inside one `ScrollView`.
- `LatestBooksSection` currently displays at most 6 novels even though its grid has 6–8 columns on larger windows.
- `useHomeComicPreview` requests and stores only 6 comic records.
- `useScrollGridCoverActivation` already activates network cover images only for the visible grid window plus one nearby row.
- The full novel and comic catalog routes already use paged list APIs with a page size of 24.

## Requirements

- Home novel and comic sections must show up to two complete grid rows for the current window.
- Fetch enough lightweight list metadata to fill those rows on tablet layouts; do not fetch the entire catalog.
- Preserve lazy cover activation: records may be present in memory, but cover pixels must continue to load only near the visible home viewport.
- Use the same two-row `columns * 2` preview rule as rankings and preserve content filtering, stale-data errors, retry behavior, cache keys, accessibility, and navigation route hints.
- Rotation and split-view changes must use the current column count when selecting the visible preview records without requiring a new cover-loading mechanism.

## Acceptance Criteria

- [ ] Home sections render the same `columns * 2` card count as rankings (6 for 3 columns, 10 for a 5-column Stage Manager window, and more on wider tablets), subject to the API response count.
- [ ] Novel and comic home requests return a bounded page of list metadata large enough for the supported grid (24 records).
- [ ] Only visible and nearby rows activate network cover images; offscreen cards retain placeholders until scrolled near the viewport.
- [ ] Existing home loading, retry, filtering, navigation, localization, and accessibility behavior remains unchanged.
- [ ] Relevant hook/grid tests, Mobile typecheck, workspace typecheck, boundaries, and diff checks pass.

## Out of scope

- Infinite scrolling or loading the complete novel/comic catalog on the home screen.
- Changing the full `/books` or `/comics` catalog pagination.
- Changing cover sizing, cache keys, or native image decoding.

## Technical notes

Use the existing 24-item catalog page size as the bounded metadata fetch. The home grid selects `min(responseItems, columns * 2)` records, while the existing `useScrollGridCoverActivation` remains the sole cover-network activation path.

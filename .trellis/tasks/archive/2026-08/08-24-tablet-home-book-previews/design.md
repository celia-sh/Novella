# Design: Tablet home book previews

## Scope and ownership

- `apps/mobile/src/hooks/use-discovery.ts` owns the bounded novel metadata request and existing content filtering.
- `apps/mobile/src/hooks/use-comic-list.ts` owns the bounded comic metadata request and conversion to `BookListItem`.
- `apps/mobile/src/screens/home-screen.tsx` owns responsive preview selection (`columns * 2`) for the two home catalog sections.
- `apps/mobile/src/hooks/use-cover-activation.ts` remains the owner of viewport-aware network cover activation.

No shared package or API contract changes are required: both list use cases already accept an explicit page size and the catalog contract supports 24-item pages.

## Data flow

1. Home hooks request one bounded page of 24 lightweight list records.
2. Novel records pass through the existing AI/Japanese/Level 6 filter.
3. Home sections derive `books.slice(0, columns * 2)` from the loaded records. On phones this remains six; on current tablet thresholds this becomes 12–16.
4. `BookGrid` mounts only the selected preview records.
5. `useScrollGridCoverActivation` sees all selected keys but activates only the visible rows plus one nearby row. `BookCoverGridItem` receives `networkImageEnabled=false` for the rest and keeps its placeholder.

## Trade-offs

- A 24-record metadata response costs more than the old six-record comic request, but list records are substantially cheaper than cover pixels and the response is bounded by the existing catalog page size.
- Two rows keep the home page informative without turning it into an infinite catalog. Every home section now follows the ranking section's same `columns * 2` rule, including narrow Stage Manager windows.
- A fixed 24-record fetch avoids refetching during rotation while supporting the current maximum of eight grid columns; the rendered preview still responds immediately to width changes.

## Invariants

- `BookCoverImage` remains the only cover renderer.
- Cover activation scopes remain type/section/column-specific.
- No raw API payload reaches the grid; comics continue through `comicToBookListItem`.
- Error and retry state stays owned by each existing hook.

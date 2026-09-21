# Design — Improve comic reader reliability

## Architecture

Keep `ComicReaderScreen` as the screen coordinator and the existing client/progress services as the data and persistence boundaries. Extract deterministic comic paging calculations into a small mobile service so restoration, batching, directional prefetch, and image sizing can be tested without rendering React Native views.

No native module or publication-format changes are required.

## Data Flow

### Initial load

1. Load `ComicInfo` to obtain the selected chapter, page count, and server read position.
2. Read the local position checkpoint when `openPosition === 'saved'`.
3. Resolve the logical initial page index using the same local-vs-server precedence as the current reader.
4. Compute `batchStart = floor(pageIndex / PAGE_BATCH) * PAGE_BATCH` after clamping to the chapter summary page count.
5. Request that batch through `loadComicContent`.
6. Re-clamp against the authoritative `chapter.total` returned by the content response. If stale summary metadata produced an out-of-range empty batch, request the final valid batch once.
7. Create total-sized stable slots and merge the returned batch.
8. Mount the selected mode at the resolved index.

### Later batch loading

Maintain per-request-generation refs for:

- in-flight batch indexes;
- failed batch indexes;
- current request version.

`loadBatch(pageIndex, retry)` computes a batch index, rejects invalid/stale requests, and catches failures. A normal call does not spin on a known failed batch; an explicit retry clears its failure and re-requests it. A successful response merges only its returned range and clears that batch error.

### Page image loading

Each `ComicPage` owns image-render failure and retry state keyed by the current image URL. An image error replaces the image with an accessible retry surface. Retrying increments a local attempt key and remounts only that `Image`; loaded sibling slots and chapter state remain intact.

## Deterministic Helpers

Create `apps/mobile/src/services/comic-reader-layout.ts` with pure functions for:

- clamping a page index;
- finding the batch containing a page;
- deriving directional metadata targets;
- deriving immediate and farther prefetch index sets;
- fitting an image inside a paged viewport;
- bounding continuous content width.

The service must not import React or platform modules.

## Directional Prefetch

Track the last visible page and a direction (`-1 | 1`), defaulting to forward. When visibility changes, update direction only when the index changes.

Use two bounded tiers:

- Immediate tier: current page plus one page on each side, `memory-disk`.
- Directional tier: the next four pages in the current direction after the immediate neighbor, `disk`.

Deduplicate indexes and omit missing metadata. Trigger metadata loads for the visible page and the farther directional edge. Failed optional image prefetch resolves silently.

## Layout

### Paged

Given source dimensions, available content width, and toolbar-safe height:

```
scale = min(contentWidth / sourceWidth, availableHeight / sourceHeight)
renderWidth = sourceWidth * scale
renderHeight = sourceHeight * scale
```

The horizontal list item remains one full window wide for deterministic paging, while the rendered image is centered in the safe viewport. A placeholder without dimensions uses a stable fallback ratio until its target batch resolves; the initial target batch requirement prevents this on restored first paint.

### Continuous

Use full window width on normal phone portrait layouts. On wide viewports, cap image content width to `availableHeight * 0.7`, never exceeding window width. Calculate continuous offsets from this same width so `getItemLayout` and rendered dimensions agree. Center each image in a full-window-width row.

Continue `contentFit="contain"`, `allowDownscaling`, disk/memory cache policy, recycling keys, and clipping/window controls. Enable iOS early resizing for non-zoomed comic pages.

## Compatibility

- API contracts remain unchanged.
- Server position remains a 1-based page string.
- Novel publication and Readium code remain untouched.
- Existing mode and chapter navigation routes remain unchanged.
- No new setting or migration is required.

## Failure and Rollback

- If target-batch loading fails during initial preparation, show the existing full reader error state and retry the initial load.
- Once mounted, later batch failures are inline and isolated.
- Pure helper extraction keeps the loading and layout behavior independently revertible.
- If early resizing causes platform rendering regressions, remove that prop without changing the sizing model.

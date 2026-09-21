# Improve comic reader reliability

## Goal

Improve the existing native comic reader's loading reliability, page presentation, prefetch efficiency, and continuous-mode memory behavior without replacing it with Readium or removing either reading mode.

## Background

The comic reader currently uses `FlatList` and `expo-image` for horizontal paged and vertical continuous reading. It requests image metadata in batches of 12, creates stable page slots, prefetches nearby image URLs, and persists a 1-based page number through the existing reader position pipeline.

The current implementation always loads batch zero before resolving a saved or end position, has no batch-level or page-image retry state, uses a symmetric fixed prefetch window, and renders paged images at their natural screen-width height even when that height exceeds the visible toolbar-safe band.

## Requirements

### R1 — Preserve existing product behavior

- Keep horizontal paged and vertical continuous modes.
- Keep the existing reader chrome, chapter picker, previous/next chapter controls, settings route, and mode switch.
- Keep server persistence as `SaveReadPosition { bookId, chapterId, position }`, where comic `position` is a 1-based page number.
- Do not route comics through `NovellaReadiumView` in this task.
- Do not add zoom, RTL reading, multi-page spreads, or chapter-edge gestures in this task.

### R2 — Load the initial page batch first

- Resolve the requested initial page from `openPosition`, comic metadata, server position, and the local checkpoint before requesting comic page metadata.
- Request the batch containing that page instead of always requesting batch zero.
- Clamp stale or invalid positions to the chapter bounds.
- Preserve correct restoration for start, end, saved, and mode-switch entry paths.
- Do not wait for unrelated batches before first paint.

### R3 — Recover from metadata and image failures

- Catch every batch request failure; no fire-and-forget comic batch request may produce an unhandled rejection.
- Track failed batches independently from in-flight batches.
- Show an inline retry action for a page whose metadata batch failed.
- Show an inline retry action when an individual image fails to render.
- Retrying one failed page or batch must not reset the chapter or discard successfully loaded slots.
- Stale responses from a previous chapter/request generation must remain ignored.

### R4 — Use directional, tiered prefetch

- Keep the current page and immediate neighbors at high render priority and prefetch them with memory-and-disk policy.
- Prefetch a bounded farther window primarily in the current reading direction using disk policy.
- Load metadata for the current batch and the next directional batch before its images are needed.
- Keep prefetch constants private to the comic reader; do not reuse `readerPreloadWindow`, which remains the novel chapter policy.
- Prefetch failures must remain optional and non-blocking.

### R5 — Fit paged images without clipping

- In paged mode, contain each complete image inside the toolbar-safe viewport while preserving aspect ratio.
- Center the fitted image horizontally and vertically.
- Never intentionally clip the bottom of a tall comic page.
- Keep one logical comic page per horizontal viewport and preserve page-index calculations.

### R6 — Bound continuous-mode presentation cost

- Keep full-height continuous images and preserve their natural aspect ratio.
- Cap content width on wide or landscape viewports relative to the available reader height, while leaving phone portrait layout unchanged.
- Center capped content horizontally.
- Continue using `expo-image` downscaling and virtualization; enable platform-supported early resizing only where it does not change layout semantics.
- Do not introduce global image-cache mutation or global cancellation.

## Acceptance Criteria

- [ ] Opening a saved page outside batch zero paints from its containing metadata batch without first loading page 1.
- [ ] Opening at start and end restores page 1 and the final page respectively.
- [ ] A failed metadata batch displays a retry action and does not generate an unhandled promise rejection.
- [ ] A failed image displays a retry action that retries only that image.
- [ ] Moving forward and backward updates directional metadata loading and tiered image prefetch without unbounded work.
- [ ] Tall images are fully visible and centered in paged mode between reader toolbars.
- [ ] Continuous mode remains full-height, vertically contiguous, centered, and width-bounded on wide viewports.
- [ ] Switching reading modes retains the same logical page.
- [ ] Comic progress still saves and restores as a 1-based page string.
- [ ] Existing novel Readium behavior and `readerPreloadWindow` are unchanged.
- [ ] Mobile type-check and focused comic reader tests pass on both platform code paths.

## Out of Scope

- Comic rendering through Readium or a CBZ/Divina publication.
- Pinch, double-tap, or long-press zoom.
- RTL manga progression.
- Two-page or configurable multi-page spreads.
- Gesture-based chapter crossing.
- Download/offline archive support.

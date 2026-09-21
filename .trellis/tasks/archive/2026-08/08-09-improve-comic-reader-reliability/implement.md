# Implementation Plan — Improve comic reader reliability

## 1. Add deterministic comic reader helpers

- Create `apps/mobile/src/services/comic-reader-layout.ts`.
- Implement page clamping, batch targeting, directional prefetch windows, paged contain sizing, and continuous width bounding.
- Add focused Node tests in `apps/mobile/src/services/comic-reader-layout.test.mjs`.
- Add the test file to the mobile reader test script.

## 2. Load the restored batch first

- Refactor `ComicReaderScreen.loadChapter` to resolve the intended page from `ComicInfo` and the local checkpoint before loading content.
- Request the containing batch, then clamp against the response total.
- Handle one stale-summary fallback to the authoritative final batch.
- Keep stable total-sized slots and the existing request-generation guard.

## 3. Add isolated failure and retry state

- Track failed metadata batches beside in-flight batch refs.
- Catch all `loadBatch` failures and expose explicit retry.
- Add per-image error/remount state to `ComicPage`.
- Render accessible inline retry surfaces without changing reader chrome.

## 4. Add directional tiered prefetch

- Track forward/backward movement from visible index changes.
- Prefetch immediate URLs with memory-and-disk policy.
- Prefetch farther directional URLs with disk-only policy.
- Load the current and directional-edge metadata batches.
- Keep all prefetch failures optional.

## 5. Correct paged and continuous sizing

- Fit paged images fully into the toolbar-safe viewport.
- Center paged images while preserving one screen-width item per page.
- Bound continuous image width on wide viewports and use the same width in layout calculations.
- Keep phone portrait behavior unchanged.
- Enable supported downscaling/early resizing without adding global cache controls.

## 6. Verify

- Run `npm run test:reader --workspace @novella/mobile`.
- Run `npm run typecheck --workspace @novella/mobile`.
- Run `npm test --workspace @novella/reader-engine` because shared page slot/position helpers remain part of the reader flow.
- Run `git diff --check` and the reference-name boundary check over production code/tests.
- Runtime-check on iOS simulator:
  - saved page outside batch zero;
  - start/end open positions;
  - paged tall-image containment;
  - continuous phone and wide viewport sizing;
  - forward/backward page movement and mode restoration.
- Build Android and iOS native app targets only if implementation changes native configuration or exposes a platform-specific type/build failure; no native change is planned.

## Risk Points

- `apps/mobile/src/screens/comic-reader-screen.tsx`: async request generation, initial list index, and viewability callbacks.
- `FlatList.getItemLayout`: continuous offsets must exactly match rendered content widths.
- `expo-image` retry behavior: remount only the failed image; never clear global caches.
- Stale chapter summary page count: permit one authoritative fallback without loops.

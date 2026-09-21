# Fix remaining Skia reader crashes

## Goal

Eliminate the remaining reader crash paths exposed by paged-mode cell churn while preserving the existing persistent scroll Canvas architecture and platform behavior.

## Confirmed findings

- `ReaderSkiaTile` still disposes every mounted `SkParagraph` synchronously in its `useEffect` cleanup. A recycled paged cell can therefore release a paragraph before RN Skia's queued redraw has finished consuming the previous scene.
- `ReaderSkiaScroll` already uses the shared `SKIA_SCENE_RESOURCE_GRACE_MS` retirement window through `ReaderSkiaScrollParagraphCache`; paged tiles do not.
- iOS scroll images pass `resolveReaderImageMaxPixelSize()`, `estimateReaderImageBytes()`, and `rememberNaturalDimensions={false}` to `ReaderSkiaImage`. Paged tiles currently pass none of these, so iOS paged images can decode the original EPUB resource without the native ImageIO cap or decoded-image budget accounting.
- Android's rasterizer adapter intentionally reports unavailable. Paged image bounding must not turn Android's existing image path into a guaranteed load error; the native ImageIO path is required for iOS.
- `@shopify/react-native-skia` is pinned to `2.6.2`. Its `RNSkPictureRenderer::_picture` is written by `setPicture()` and read by `performDraw()`/`getPicture()` without synchronization. Upstream issue #3925 documents the resulting picture ref-counting use-after-free, and upstream PR #4012 provides the mutex fix.

## Requirements

1. Route paged tile paragraph cleanup through the same 200 ms Skia scene-resource retirement contract used by scroll paragraphs. Do not synchronously call `paragraph.dispose()` from `ReaderSkiaTile` cleanup. Prefer one reusable lifecycle helper for paragraph host-object retirement; reacquisition/cancellation must remain safe for scroll cache entries.
2. On iOS, make every paged `ReaderSkiaImage` use the existing bounded image pipeline: `resolveReaderImageMaxPixelSize()`, `estimateReaderImageBytes()`, the pool's native ImageIO rasterization, and `rememberNaturalDimensions={false}`. Include the block identity, URI, and pixel bucket in the mounted image identity. Do not allow the downsampled pixel dimensions to overwrite layout/natural geometry.
3. Preserve Android's current native-rasterizer availability behavior, the 24 MiB bounded-image budget, the 2048 pixel cap, the 200 ms grace period, the persistent scroll Canvas, and existing scroll windowing. Do not redesign Canvas/ScrollView architecture or increase the grace interval.
4. Persist the RN Skia 2.6.2 upstream picture mutex fix through the repository's package patch mechanism rather than relying on an edited `node_modules` file. The patch must lock `_picture` in `setPicture()` and `getPicture()`, take the local `sk_sp<SkPicture>` through `getPicture()` in `performDraw()`, and keep redraw requests outside the lock.

## Acceptance criteria

- [ ] Paged tile paragraph resources are retired after `SKIA_SCENE_RESOURCE_GRACE_MS`; no direct synchronous paragraph disposal remains in `ReaderSkiaTile` cleanup.
- [ ] iOS paged image requests carry bounded pixel size and estimated decoded bytes, use the existing pool/rasterizer, and do not persist downsampled dimensions.
- [ ] Android does not require the iOS rasterizer as a side effect of the paged-image change.
- [ ] The committed package patch reapplies to the installed `@shopify/react-native-skia@2.6.2` source and contains the mutex-protected picture access from upstream PR #4012.
- [ ] `npm run typecheck`, `npm run test:reader`, `npm run check:boundaries`, and `git diff --check` pass.
- [ ] Native iOS/device crash reproduction and Metal/OOM profiling remain explicit user acceptance steps; they are not claimed as agent-verified.

## Out of scope

- Upgrading RN Skia, React Native, Expo, or Metal.
- Replacing the fixed Canvas/ScrollView design, renderer, image retention window, downsampling policy, or memory budget.
- Broad changes to comic reader rendering or unrelated navigation/chrome behavior.

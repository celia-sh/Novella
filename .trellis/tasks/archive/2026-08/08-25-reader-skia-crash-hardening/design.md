# Design: remaining Skia crash hardening

## Boundaries and data flow

### Paged paragraph lifecycle

`layout tile data → ReaderSkiaTile useMemo → Canvas <Paragraph> scene → React cell cleanup`

The tile owns its paragraph host objects, but React cleanup is not proof that the native Skia scene has stopped using them. The shared lifecycle module will provide a delayed retirement helper. Paged cleanup schedules its paragraph bundle for disposal after the existing 200 ms grace period. Scroll cache eviction keeps its per-entry cancellation semantics so a block returning to the retention window cancels retirement before disposal.

### Paged image lifecycle

`ImageLayout geometry → ReaderSkiaTile → ReaderSkiaImage → ReaderSkiaImagePool → iOS ImageIO rasterizer → bounded SkImage`

Paged layout geometry remains pure `ImageLayout` data. On iOS, the mounted image derives a max-pixel bucket and estimated decoded bytes from the authored/layout dimensions, requests the pool's native rasterized URI, and never writes the bounded image's natural dimensions back into the geometry cache. On Android, the platform adapter still reports that native rasterization is unavailable, so the paged component keeps its existing path rather than passing a request the pool cannot fulfill.

### Picture renderer lifecycle

`React/Fabric picture replacement → RNSkPictureRenderer::setPicture()` and `performDraw()`

The persistent package patch protects the shared `sk_sp<SkPicture>` with `std::mutex`. `setPicture()` moves the incoming pointer while holding the mutex, then requests redraw after unlocking. `getPicture()` copies the pointer while holding the mutex; `performDraw()` uses that local strong reference for the complete draw, so the lock is not held during rendering.

## Reuse and compatibility

- Keep `SKIA_SCENE_RESOURCE_GRACE_MS` at 200 ms.
- Reuse `resolveReaderImageMaxPixelSize()` and `estimateReaderImageBytes()` rather than adding another cap or byte estimator.
- Reuse `ReaderSkiaImagePool`'s existing iOS rasterizer and decoded-byte accounting.
- Keep the scroll paragraph cache's behavior but move resource disposal mechanics into the shared lifecycle helper.
- Apply the patch to the package source path actually shipped by `@shopify/react-native-skia@2.6.2`: `cpp/rnskia/RNSkPictureView.h`.
- Use `patch-package` with a root `postinstall` hook and a committed `patches/@shopify+react-native-skia+2.6.2.patch`, so a fresh npm install reapplies the native source change.

## Trade-offs

- The iOS-only image bound is deliberate because the existing Android adapter has no ImageIO rasterizer. Expanding this to Android would require a separate native decoder/fallback and is outside this crash-hardening change.
- The shared retirement helper delays native disposal but does not attempt to solve the upstream picture race; the package patch addresses that independent lifecycle boundary.
- `patch-package` adds a small install-time dependency and hook, but avoids committing or trusting a mutable `node_modules` tree.

## Rollback

- Revert the paged lifecycle/image changes independently if a device test exposes a regression.
- Remove the patch file, `patch-package` dependency, and postinstall hook together to roll back the native patch.
- Do not revert the existing scroll memory/lifecycle architecture as part of a native patch rollback.

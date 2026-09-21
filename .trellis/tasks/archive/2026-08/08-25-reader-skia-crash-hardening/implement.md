# Implementation plan

1. Add a reusable Skia host-object retirement helper around `SKIA_SCENE_RESOURCE_GRACE_MS` with cancellation support suitable for the scroll paragraph cache.
2. Replace `ReaderSkiaTile`'s synchronous paragraph cleanup with delayed retirement.
3. Update paged `ReaderSkiaImage` usage to use the existing bounded iOS image pipeline, stable resource identity, and `rememberNaturalDimensions={false}` while preserving Android behavior.
4. Add `patch-package` as the repository's persistent native-package patch mechanism, add the root postinstall hook, and generate the exact 2.6.2 `RNSkPictureView.h` mutex patch from the installed package.
5. Add or update focused tests for paragraph retirement cancellation/cleanup and bounded paged image props where practical; use static inspection for native patch contents.
6. Run `npm run typecheck`, `npm run test:reader`, `npm run check:boundaries`, and `git diff --check`.
7. Validate that `patch-package --reverse`/reapply behavior is correct without leaving `node_modules` edits in the commit. Native iOS crash, Metal, and memory acceptance stays with the user.

## Risky files

- `apps/mobile/src/components/reader-skia-tile.tsx`
- `apps/mobile/src/components/reader-skia-scroll.tsx`
- `apps/mobile/src/services/reader-skia-resource-lifecycle.ts`
- `apps/mobile/src/services/reader-skia-scroll-paragraph-cache.ts`
- `package.json`, `package-lock.json`, and `patches/@shopify+react-native-skia+2.6.2.patch`

## Verification gates

- Confirm no paged image request accidentally passes `maxPixelSize` on Android, where the adapter is unavailable.
- Confirm all bounded paged iOS images use authored/layout dimensions for cap and byte estimate, and do not call `rememberReaderImageDimensions` with the downsampled dimensions.
- Confirm the mutex patch takes the `sk_sp` copy under lock and releases the lock before `_requestRedraw()` and drawing.

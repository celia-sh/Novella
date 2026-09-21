# Upstream RN Skia picture race

Date: 2026-08-25

## Evidence

- Installed dependency is `@shopify/react-native-skia@2.6.2` (`apps/mobile/package.json`).
- Installed source is `the installed React Native Skia picture-view header`.
- In that header, `setPicture()` assigns `_picture` and requests redraw, `getPicture()` returns `_picture`, and `performDraw()` copies `_picture` directly without synchronization.
- Shopify issue #3925 reports ref-counting use-after-free crashes in `RNSkPictureRenderer::performDraw()` when picture replacement and rendering race.
- Upstream PR #4012 proposes exactly the required fix: mutex-protect writes and reads, move the incoming `sk_sp` under the lock, acquire the local `sk_sp` through `getPicture()`, and call `_requestRedraw()` after releasing the lock.

Sources:

- https://github.com/Shopify/react-native-skia/issues/3925
- https://github.com/Shopify/react-native-skia/pull/4012
- https://patch-diff.githubusercontent.com/raw/Shopify/react-native-skia/pull/4012.patch

## Local package-patch decision

The repository uses npm and has no existing patch mechanism. The implementation will add `patch-package` as a root dev dependency, add a root `postinstall` script, and commit the generated patch under `patches/`. The patch targets the package's published 2.6.2 path (`cpp/rnskia/RNSkPictureView.h`), not the upstream monorepo path (`packages/skia/cpp/rnskia/RNSkPictureView.h`).

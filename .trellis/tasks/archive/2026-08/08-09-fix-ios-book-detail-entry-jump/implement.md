# iOS book detail entry and overscroll implementation

## Phase 1 — Stable loading geometry

- [x] Change the detail loading ScrollView to explicit `never` inset adjustment.
- [x] Confirm loading and ready hero heights continue to use the same safe-area-aware geometry.

## Phase 2 — Separate decoration from scroll content

- [x] Extract `BookHeroBackdrop` from the existing hero decoration without changing its colors or gradients.
- [x] Mount the backdrop as an anchored, non-interactive layer on iOS whose height follows the collapse edge.
- [x] Fade the cover-derived color paint to the base surface during the final collapse interval.
- [x] Keep Android's decorated collapsible app bar unchanged.
- [x] Make the iOS inline hero foreground transparent and the body explicitly opaque.

## Phase 3 — Restore native interaction

- [x] Enable native ScrollView bounce on iOS only.
- [x] Preserve the current parallax, collapse threshold, scroll-edge effects, and Android overscroll behavior.

## Phase 4 — Verification

- [x] Run mobile and workspace type checks.
- [x] Run relevant mobile tests without adding source-shape assertions.
- [x] Run an iOS production Expo export.
- [x] Run `git diff --check` and perform a focused code review.
- [x] Hand off device checks for loading-to-ready stability, top/bottom rubber-banding, both color-extraction settings, and Android regression acceptance.

## Validation Commands

```bash
npm run typecheck --workspace @novella/mobile
npm run check
npm run test:client
cd apps/mobile && npx expo export --platform ios --output-dir $TMPDIR/novella-detail-ios
cd ../.. && git diff --check
```

## Rollback Point

All production changes should remain in `apps/mobile/src/screens/book-detail-screen.tsx`; revert that file if the fixed-backdrop layering causes a visual regression.

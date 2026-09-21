# iOS book detail entry and overscroll design

## Root Causes

### Loading-to-ready jump

The detail route uses a transparent native header. Loading asks UIKit to add an automatic header inset even though its hero already includes the safe-area top. Ready content disables automatic adjustment and starts at the screen origin. The state replacement changes coordinate systems.

### Top overscroll seam

The iOS hero currently combines decoration and foreground in one inline ScrollView child. During negative content offset, that entire child follows the finger, leaving the ScrollView's plain surface above it. `bounces={false}` suppresses the symptom at the cost of native interaction.

## Target Layers

```text
BookDetailContent root (themed surface)
├── anchored iOS hero backdrop (surface + cover-derived gradients; height collapses with Hero)
└── ScrollView (transparent over the hero region, native iOS bounce)
    ├── inline hero foreground (cover/title/author + existing parallax)
    ├── opaque themed body
    └── bottom spacer over the root themed surface
```

Android keeps its existing structure:

```text
BookDetailContent root
├── ScrollView spacer + body
└── absolute CollapsibleBookAppBar (existing decorated hero)
```

## Component Changes

- Extract the surface/gradient/transition decoration from `BookHeroContent` into a reusable `BookHeroBackdrop`.
- Keep `BookHeroContent` able to include the backdrop for Android's existing absolute collapsible app bar.
- On iOS, mount one anchored backdrop behind the ScrollView and render `InlineBookHero` foreground without a duplicate backdrop.
- Drive the backdrop height from the existing scroll offset: from `heroHeight` to `topInset + toolbarHeight`. Because the collapse distance equals that height delta, its bottom edge stays exactly aligned with the opaque body edge throughout collapse and the transition gradient always ends in `palette.surface` at their contact point.
- Fade only the cover-derived color paint from opaque to transparent over the existing final collapse interval (`collapseDistance - toolbarHeight` → `collapseDistance`). The backdrop base remains `palette.surface`, so a fully collapsed header and all subsequent scroll positions are entirely the page background color.
- Give the body an opaque `palette.surface` background so the fixed hero decoration is visible only in the hero/overscroll region.
- Make the ready ScrollView background transparent on iOS and retain the themed surface on Android.
- Set the loading ScrollView inset adjustment to `never`, matching ready content.
- Enable `bounces` only on iOS; no custom gesture or animation layer is added.

## Compatibility

- Header transparency, safe-area height, scroll offset thresholds, Reanimated interpolation, ScrollViewMarker, and scroll-edge effects remain intact.
- Palette updates repaint the fixed backdrop but do not affect layout.
- When no gradient exists, the fixed backdrop is simply `palette.surface`, so the same hierarchy works with extraction disabled.
- Android continues using `CollapsibleBookAppBar` with its internal backdrop and disabled overscroll glow.

## Risks And Mitigations

- **Backdrop leaking behind the body:** make the body explicitly opaque.
- **Hard color edge while collapsing:** collapse the backdrop height at the same rate as the body rises so its transition gradient is recomputed across the current visible header height.
- **Color residue after collapse:** fade the gradient paint to zero using the same terminal interval as the foreground; never fade the base surface.
- **Duplicate gradients:** iOS inline hero disables its internal backdrop; Android retains it.
- **Touch interception:** fixed backdrop uses `pointerEvents="none"` and stays behind the ScrollView.
- **Navigation regression:** do not change Stack options or toolbar code.

## Rollback

The change is isolated to `apps/mobile/src/screens/book-detail-screen.tsx`. Reverting the fixed backdrop and restoring the previous `bounces`/loading inset props returns the old behavior without contract or data migration work.

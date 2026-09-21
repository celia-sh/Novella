# Design: Recover iOS progressive blur rendering

## Source Of Truth

1. User-confirmed visual baseline around 2026-08-15 15:20 +0800 (`HEAD` was `783d4fd`; renderer unchanged through `a6fd61d`).
2. Archived UIKitCore/runtime report: `../archive/2026-08/08-14-ios-26-soft-scroll-edge-research/research/ios-26-soft-scroll-edge-effect.md`.
3. Cold-installed production runtime evidence captured on iOS 26.5, never a mutated process for final acceptance.
4. User acceptance on the target manga/content frame.

## Architecture Boundary

```text
RN screen content
  -> app-owned top/bottom overlay
    -> MaskedView progressive geometry
      -> expo-blur BlurView (public native implementation owned by Expo)
    -> ordinary RN adaptation layers only when validated
    -> NativeScrollEdgeMarker (sampling/ownership only; never blur rendering)
```

`expo-blur` being backed by `UIVisualEffectView` is expected. "RN replica" means RN owns composition, mask, geometry, state, and navigation integration; it does not mean JavaScript calculates backdrop pixels. Recovery must not add a second app-owned `UIVisualEffectView` wrapper.

## Data Model

The sensor must distinguish two concepts:

```ts
interface IosSoftContentSample {
  meanLuma: number;          // quantized numeric path
  medianLuma: number;        // dominant background signal
  brightPixelFraction: number;
}

type ResolvedContentStyle = 'dark' | 'light';
```

The exact event schema can be adjusted during implementation, but the semantic split is mandatory:

- `meanLuma`: EMA, settle, low/middle replay hysteresis.
- `resolvedContentStyle`: selects the dark-app light-content branch (`0.30` with floating elements).
- `appearance`: selects the outer light/dark state machine and must not lock content style.

The existing `32 x 4` capture is sufficient for a bounded histogram. Do not add another render pass or JS scrolling callback. Quantization remains `min(Int(clamp01(luma) * 32), 31) / 31`.

## Why Mean Luma Is Insufficient

Recovered and current same-frame evidence:

```text
Flat nominal 0.89 row: Apple sampled 0.87097 -> replay 0.60
White manga frame:    Apple sampled 0.77419 -> content style Light -> replay 0.30
RN manga sample:      mean 0.80645 -> current initial band middle -> replay 0.60
```

The manga has a dominant white background plus sparse black ink. Average luma falls below a bright flat gray, while its dominant background style remains light. A histogram/coverage signal is required.

## Renderer Recovery Sequence

### Stage A: Restore The Known Visual Baseline

- Remove only the failed uncommitted native-wrapper files and their registrations/imports/tests.
- Restore `ios-progressive-blur.ios.tsx` and config behavior to the renderer shared by `783d4fd` through `a6fd61d` using targeted edits, not branch reset or destructive checkout.
- Keep current top/bottom ownership, marker APIs, state service, and later screen fixes.
- Build, install, terminate, cold-launch, and record baseline screenshots before adding adaptation.

### Stage B: Make Classification Observable Without Changing Rendering

- Extend the existing native sample with distribution data.
- Log/expose the bounded sample only on the development research surface.
- Build a matrix for black, middle gray, flat bright gray, pure white, manga, normal images, and reader/WebView content.
- Freeze classification thresholds only after comparing the same frame with hidden Apple `.soft` runtime state.

### Stage C: Evaluate Public RN Composition Candidates

A candidate is evaluated in isolation and is rejected before integration if it changes baseline blur geometry or cold-start visibility.

Required properties:

- `BlurView` and every ancestor remain alpha `1`.
- No local `UIViewPropertyAnimator` intensity wrapper.
- No solid theme color described as background replay.
- No private backdrop/filter API.
- Dynamic layers may animate only ordinary RN views whose semantics are explicitly documented.
- The blur itself remains continuously visible at the accepted baseline strength.

Because Apple replay is a live backdrop layer, exact parity is unavailable with the permitted public stack. The selected approximation must be described as an approximation and chosen by measured black/white preservation, not by naming resemblance.

### Stage D: Apply Bottom Adaptation Separately

Only after top passes. Reuse the classifier/state model, not an assumed renderer result. The bottom effect gets its own geometry and screenshots.

## Forbidden Approaches

- Enable system `.soft` in production.
- Ship `_UIScrollPocket*`, `CAFilter`, private selectors, KVC, `Mirror`, or portal manipulation.
- Add `NovellaProgressiveBlurView` or another app-owned native blur view during this recovery.
- Set opacity/alpha below `1` on `BlurView`, `UIVisualEffectView`, `MaskedView` ancestors containing the effect, or any native effect ancestor.
- Treat `UIViewPropertyAnimator.fractionComplete` as fixed without a cold-start runtime proof of active state and correct filters.
- Use `PlatformColor('systemGroupedBackground')` as a dynamic replay layer under dark trait.
- Use one average-luma threshold as the content-style resolver.
- Tune screenshots while changing multiple renderer layers at once.
- Commit a renderer candidate after only typecheck/tests/build.
- Auto-scroll after the user positions the target content.

## Git Containment

Keep all later commits and fix forward. The recovery diff must be auditable by responsibility:

1. remove rejected uncommitted experiment;
2. restore baseline renderer;
3. add classification evidence/tests;
4. add one validated top renderer change;
5. add independently validated bottom integration.

Do not combine unrelated refactors or push the branch.

## Static-Only Override

The subsequent requirement is to reverse the local iOS runtime without invoking
any simulator process. The data-model section above remains a public-sensor
research proposal, not evidence that a `render(in:)` mean sample equals
UIKit's private filtered backdrop luma.

Static UIKitCore analysis established that the Apple control state consumes a
private `CABackdropLayer` luma value and uses private `variableBlur` plus a
second backdrop replay. The public state-machine reproduction may retain the
same numeric transitions for research, but it must not reconnect the existing
mean-luma sensor to production rendering and call that result equivalent.

Until product constraints explicitly permit private APIs, static-only work can
produce:

- exact control-flow and parameter documentation;
- pure state-machine tests using those static constants;
- the existing fixed public RN composition.

It cannot produce a pixel-identical Apple `.soft` renderer. No simulator-based
visual claim or runtime validation is permitted under this override.

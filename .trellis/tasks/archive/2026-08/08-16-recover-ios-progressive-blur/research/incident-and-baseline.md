# Incident: iOS progressive blur regression and failed recovery attempt

## Status Snapshot

Captured 2026-08-16 after the user reinstalled the latest native client.

```text
branch:  [BRANCH]
HEAD:    [COMMIT] fix(mobile): align iOS luma adaptation
remote:  origin/feat/ios-progressive-blur at [COMMIT]
branch:  ahead 6
push:    none for local commits
```

Dirty tracked files from the rejected experiment:

```text
apps/mobile/modules/novella-ui/ios/NovellaUiModule.swift
apps/mobile/src/components/ios-progressive-blur-config.ts
apps/mobile/src/components/ios-progressive-blur.ios.tsx
apps/mobile/src/services/ios-soft-luma.test.mjs
```

Dirty untracked files from the rejected experiment:

```text
apps/mobile/modules/novella-ui/ios/NovellaProgressiveBlurView.swift
apps/mobile/modules/novella-ui/src/native-progressive-blur.ios.tsx
apps/mobile/modules/novella-ui/src/native-progressive-blur.tsx
apps/mobile/modules/novella-ui/src/native-progressive-blur.types.ts
```

These files were installed and cold-launched by the user. They are a real failed runtime state, not a Metro/native mismatch. They must not be committed.

## User-Confirmed Baseline

The user identified a good state around 2026-08-15 15:20 +0800: blur appearance correct, no automatic content adaptation.

The short identifier `[COMMIT]` does not resolve in the current repository/reflog/unreachable objects. Time-based reconstruction is unambiguous enough for the renderer:

```text
12:40  [COMMIT]  stabilize detail scroll edges
15:20  HEAD still [COMMIT]; possible uncommitted work
16:30  [COMMIT]  align top blur with scroll ownership
17:31  [COMMIT]  finish scroll owner edge cases
17:55  [COMMIT]  add system blur research surface
19:20  [COMMIT]  adapt iOS top blur to content luma
20:57  [COMMIT]  adapt reader bottom blur to content
22:53  [COMMIT]  align iOS luma adaptation
```

The progressive renderer/config/top-background files did not change from `[COMMIT]` through `[COMMIT]`. Therefore that shared file content is the recovery baseline even if the remembered short identifier came from an uncommitted or rewritten state.

Baseline renderer:

```text
MaskedView
  Expo BlurView intensity 9.2, systemMaterial
MaskedView
  fixed systemGroupedBackground replay, max alpha 0.85
Top only
  additional dimming alpha 0.01
```

This is a user-confirmed visual baseline, not proof that every internal Expo intensity or dark-trait replay behavior was correct.

## Commit Regression Map

### `[COMMIT]`: first top production regression

Added public top luma sampling and a JS state machine. It also made the semantic replay layer dynamic and added black darkening.

Defect: Apple `backgroundReplay` is a backdrop layer, not a semantic solid color. In dark trait, RN `systemGroupedBackground` resolved to black. Lower dynamic replay values exposed the cold-start full material and painted a masked black layer over manga.

### `[COMMIT]`: bottom regression propagation

Reused the same state/rendering model for reader bottom chrome. It added a second dynamic solid replay and made the reported bottom gray/black band possible.

### `[COMMIT]`: state math correction without renderer correction

Corrected quantization, EMA chaining, light threshold mapping, strict low/middle hysteresis, and conditional settle timer. Those corrections are independently valid, but validation stopped at tests/builds. The renderer and mean-luma-only content-style approximation remained defective.

## Cold Runtime Evidence Before The Rejected Experiment

User-provided screenshot:

The frame showed the reported runtime edge artifacts. Its local path and temporary identifier are intentionally omitted from the shared research record.

Read-only process evidence:

```text
top RN sample:             25/31 = 0.80645
bottom RN sample:          24/31 = 0.77419
top replay view:           dark-trait black, model alpha ~0.35294
bottom replay view:        dark-trait black, model alpha ~0.70588
Expo requested intensity:  0.092
Expo animator:             inactive
actual backdrop blur:      gaussianBlur radius 29.5, scale 0.25
system top effect alpha:   0
system bottom effect alpha:0
```

The system effect was not double-rendering. The gray/black bands were app-owned.

Relevant read-only runtime evidence was collected locally. The temporary artifact names are intentionally omitted from the shared research record.

## Same-Frame Content-Style Contradiction

Latest hidden Apple top effect:

```text
sampled luma:               24/31 = 0.77419
resolved floating style:    Light
resolved glass style:       Light
backgroundReplay alpha:     0.30
PocketBlur radius:          1.0
```

Latest RN top sensor/state:

```text
sampled mean luma:          25/31 = 0.80645
cold initial dark band:     middle (`DARK_HIGH_ENTER_LUMA = 0.9`)
selected replay:            0.60
```

The archived matrix already showed that a flat bright gray at sampled `0.87097` remained replay `0.60`, while pure white entered `0.30`. The manga result proves Apple's upstream content-style resolver uses information not represented by one mean value. Sparse black ink lowers the mean while the dominant background remains light.

## Rejected Native-Wrapper Attempt

Intent:

- replace Expo's inactive partial animator with an app-owned public `UIVisualEffectView`;
- remove the solid replay layer;
- emulate replay `A` by setting blur ancestor opacity to `1 - A`.

Installed cold runtime result:

```text
NovellaProgressiveBlurView present: yes
top frame:                        402 x 171
bottom frame:                     402 x 122
requested intensity:              0.092
native animator:                  inactive
actual gaussian blur radius:      29.5
top blur ancestor alpha:          0.40
bottom blur ancestor alpha:       0.40
solid replay layer:               removed
result:                           blur appeared nearly absent
```

Apple's public `UIVisualEffectView` documentation explicitly warns that setting alpha below `1` on the effect view or any superview can make effects look incorrect or disappear. The attempt violated that contract. Synchronous `startAnimation(); pauseAnimation(); fractionComplete = 0.092` also failed to produce an active animator on iOS 26.5.

Evidence:

```text
$TMPDIR/novella-navbar-latest-user-reinstall.png
$TMPDIR/novella-navbar-latest-hierarchy-readonly.txt
$TMPDIR/novella-navbar-latest-native-blur-readonly.txt
$TMPDIR/novella-navbar-latest-filter-readonly.txt
$TMPDIR/novella-navbar-latest-filter-radius-readonly.txt
```

## Engineering Mistakes To Prevent

1. Completion was claimed after tests and builds without a fresh installed cold-start visual pass.
2. A correct luma-state calculation was treated as if it implied a correct renderer.
3. Apple's backdrop replay was modeled as a semantic solid color despite runtime evidence that it is a separate `CABackdropLayer`.
4. App appearance was allowed to resolve replay color even though the requirement explicitly said content must drive the high-luma branch under dark trait.
5. Mean pixel luma was used as a substitute for the separately recovered content-style resolver.
6. The unverified `0.9` approximation survived even after the research report stated the `0.30` branch is style-driven, not selected directly by mean luma.
7. Expo's inactive cold-start animator was known but left under a renderer whose new dynamic alpha exposed the full material.
8. A replacement native wrapper was implemented before isolated proof that its animator reached active state.
9. `UIVisualEffectView` ancestor alpha was animated below `1`, contrary to Apple documentation.
10. A user-completed reinstall was incorrectly dismissed as a possible JS/native mismatch. Installed runtime evidence must outrank assumptions about which local build command finished.
11. Top and bottom were generalized through one renderer before top had passed cold-start acceptance.

## What Can Be Reused

- `171 pt` top overlay geometry and sibling ownership.
- Progressive PocketMask alpha samples and blur-mask attenuation curve.
- Additional dimming geometry/alpha evidence.
- System edge suppression and stable scroll-owner work.
- Public `32 x 4` native capture, exclusion logic, throttling, focus lifecycle, and event naming fixes.
- Exact `32`-bucket quantization.
- Prior-effective EMA, settle timer, and strict numeric hysteresis fixes.
- Development-only Apple reference page and archived runtime/disassembly evidence.
- Reader bottom sampling boundary above controls.

## What Must Be Reworked

- Content-style classification for black-on-white and other high-contrast content.
- Dynamic replay representation under the public RN stack.
- Cold-start treatment of Expo Blur intensity.
- Independent top and bottom acceptance.
- Runtime-first completion gate.

## Recovery Baseline Build And Install (2026-08-16 00:59 +0800)

Phase 1 removed the rejected experiment and restored the static renderer without resetting the branch:

```text
tracked recovery diff:
  apps/mobile/src/components/ios-progressive-blur.ios.tsx
  apps/mobile/src/components/ios-progressive-blur.tsx
  apps/mobile/src/components/ios-top-bar-background.ios.tsx
  apps/mobile/src/components/ios-bottom-bar-background.ios.tsx

removed untracked experiment:
  apps/mobile/modules/novella-ui/ios/NovellaProgressiveBlurView.swift
  apps/mobile/modules/novella-ui/src/native-progressive-blur.ios.tsx
  apps/mobile/modules/novella-ui/src/native-progressive-blur.tsx
  apps/mobile/modules/novella-ui/src/native-progressive-blur.types.ts
```

The shared iOS renderer and config have no diff from `[COMMIT]`. Top/bottom dynamic luma props are disconnected from rendering. The public sensor, state service, hook, ownership fixes, and reader code remain in the repository. Bottom retains `NativeScrollEdgeMarker hidesAllEdgeEffects` without luma sampling.

Self-verified evidence:

```text
Mobile TypeScript:                pass
Theme/luma tests:                 10/10 pass
Reader tests:                     32/32 pass
Package boundaries:               pass
git diff --check:                 pass
NovellaUi Debug simulator build:  pass
NovellaUi Release simulator build:pass
Novella Release simulator build:  pass
Novella Debug simulator build:    pass
```

Fresh Debug install:

- Tested in a local iOS simulator with a Debug build.
- The app installed and terminated cleanly; the first cold launch reached the first-run welcome surface without a crash.
- Static inspection of the installed executable found no `NovellaProgressiveBlurView` or `ProgressiveBlur` symbol.
- The local screenshot and simulator identifiers are intentionally omitted from shared task records.

This was not a blur acceptance frame: no scroll surface, navigation overlay, or reader bottom chrome was active. Visual baseline, top/bottom runtime hierarchy, and user acceptance must not be inferred from these build results.

## Runtime Edge-Suppression Correction (2026-08-16 10:55 +0800)

The first positioned cold-runtime inspection disproved the reader's previous suppression path:

```text
RCTEnhancedScrollView topEdge:     style=automatic, active system effect
RCTEnhancedScrollView bottomEdge:  style=automatic, active system effect
system top effect alpha:           omitted (default 1)
system bottom effect alpha:        omitted (default 1)
```

`ReaderNavigation` stack options and the sibling `NativeScrollEdgeMarker` did not configure the cold-mounted comic `FlatList`. This was an ownership failure, not a blur renderer or luma-classification failure.

The correction wraps each paged/vertical comic `FlatList` in exactly one direct `ScrollViewMarker` from `react-native-screens/experimental` with all four edges `hidden`. It preserves list refs, virtualization parameters, page geometry, callbacks, and reader progress behavior.

Second read-only runtime capture, after Metro reloaded the changed JS and restored the same `4 / 4` chapter:

```text
hierarchy:                       RNSScrollViewMarkerComponentView -> RCTScrollViewComponentView
actual native scroll view:       RCTEnhancedScrollView
system top effect alpha:         0
system bottom effect alpha:      0
app-owned top Expo Blur:         402 x 171, UIVisualEffectView / systemMaterial
app-owned bottom Expo Blur:      402 x 122, UIVisualEffectView / systemMaterial
custom native blur wrapper:      absent
```

UIKit's recursive description continues to print `topEdge=<style=automatic>` and `bottomEdge=<style=automatic>` even when `isHidden` is true. The actual effect view alpha is the acceptance signal. Current runtime artifacts were retained locally for review; their temporary filenames are intentionally omitted from the shared research record.

The `IosTopBarBackground` visibility transition still contains the historical parent-opacity animation. At the positioned, visible runtime state, neither Expo `BlurEffectView` nor an ancestor is reported with fractional alpha. Transition behavior is a separately scoped runtime check; do not replace it based solely on static inspection.

## Static UIKitCore Reverse Engineering (No Simulator, 2026-08-16)

The following evidence was obtained only from the installed local iOS 26.5 runtime image; no simulator process, app interaction, LLDB attachment, screenshot, or mutation is required:

```text
UIKitCore from the installed local iOS runtime image was inspected; its filesystem path is intentionally omitted.
```

`PocketBlur` is not a Gaussian blur with an alpha gradient. The static filter builder at `UIKitCore + 0x2807e4` selects private `kCAFilterVariableBlur` when flag bit `0` is set, otherwise `kCAFilterGaussianBlur`. It configures these private filter inputs:

```text
bit 0:  select variableBlur; also inputFade = true
bit 8:  inputNormalizeEdges
bit 16: inputDither
argument d0: inputRadius
```

`PocketBlur` owns a `CABackdropLayer`, applies this filter through a masked portal, and uses the separately generated `PocketMask`. Its observed model defaults are `blurRadius = 24`, `floatingBlurRadius = 18`, `blurAttenuation = 1.25`. `LuminanceAdjustment` owns a distinct `backgroundReplay` `CABackdropLayer`, a black `darkeningView`, and an additional-dimming bitmap. Therefore a semantic fill is only a public approximation, never a literal replay implementation.

The initializer creates `backgroundReplay` with `enabled = false`, `tracksLuma = false`, and `allowsFilteredLuma = true`; it sets both visual alpha values to `0`, initializes `useHeavyReplay = false`, `enableDimming = true`, and `showingBackgroundReplay = true`, then invokes the evaluator when the view moves to its window. The `0.7` and `0.4` LumaStyle branch targets were verified directly against the Mach-O bind table:

```text
0x22fa440  SwiftUI.ColorScheme.dark
0x22fa448  SwiftUI.ColorScheme.light
```

Thus dark-trait `luma > 0.7` selects `.light`, and light-trait `luma >= 0.4` selects `.light`; the boundary operators are exact, not inferred from a screenshot. The static control-flow relations are represented in `src/services/ios-soft-luma.ts` and covered by tests. The user approved a deliberately bounded mean-luma integration only to suppress a proven-invalid dark semantic replay over public-proxy Light content. It does not treat mean luma as UIKit's filtered-backdrop input or synthesize Apple replay:

```text
sampling:                  effective = 0.7 * latest + 0.3 * prior effective
settle:                    delayed resample after 350 ms
LumaStyle content turn:    dark trait: Light only when luma > 0.7
                            light trait: Light when luma >= 0.4
light replay hysteresis:   0.7...0.9 scaled by capture-color luma
dark replay hysteresis:    capture + (1 - capture) * 0.1...0.3
replay visible:            0.85
dark trait, non-replay:    Light content = 0.30 with floating elements,
                            0.10 without; Dark content = 0.60
light trait, non-replay:   black darkening = 0.25
```

Evidence locations in the local Mach-O:

```text
BackdropView luma callback:              +0x2378c4, +0x237c38
LuminanceAdjustment initialization:      +0x238f00
LuminanceAdjustment state evaluator:     +0x23999c
light/dark alpha branches:                +0x239c50, +0x239d00
ScrollEdgeEffect luma processing:        +0x282088
ScrollEdgeEffect LumaStyle resolution:   +0x282ca0
private filter builder:                   +0x2807e4
PocketBlur filter installation:           +0x23a600
```

The public RN integration leaves the Expo `UIVisualEffectView` and every ancestor at alpha `1`; top visibility translates the overlay instead of fading its blur ancestor. Focused top and bottom markers sample only their own active screen. When the public proxy resolves Light content under dark appearance, it removes the app's dark semantic replay layer entirely and leaves the live public BlurView unobstructed. It retains the fixed replay baseline for dark content. This is a subtractive fallback, not Apple `backgroundReplay` reproduction.

## Rejected Neutral Replay Candidate

The user-provided frame rejected the first public dynamic candidate. That candidate painted a neutral gray whose RGB value matched mean luma at the recovered replay alpha. It produced broad gray/foggy top and bottom bands and discarded the comic's local background detail. It has been fully removed. Do not reintroduce a luma-derived solid color, semantic light/dark fill, or other substitute and name it replay.

## Non-Negotiable Renderer Boundary

An exact pixel-identical Apple `.soft` renderer cannot be made from the permitted public RN stack. The Apple renderer requires private `CABackdropLayer`, `CAFilter variableBlur`, filtered-luma tracking, portal-backed PocketMask, and a second backdrop replay. `expo-blur` provides a public `UIVisualEffectView` material with Gaussian filters, while `MaskedView` masks its output after that public material. They are structurally different operations.

No product code may import or invoke the private APIs above. The implemented state machine is exact to the static iOS 26.5 control logic; its visual composition remains an explicitly bounded public approximation until the product constraints are changed.

## Immediate Direction

1. Keep all remaining reverse engineering static-only; do not use `simctl`, attach a process, or inspect the reader surface.
2. Do not claim pixel-identical `.soft` parity from the public renderer boundary.
3. Do not commit or push this candidate until the permitted verification policy is agreed.
4. Any request for exact Apple pixels requires an explicit product decision to permit private APIs, which is incompatible with the existing production constraints.

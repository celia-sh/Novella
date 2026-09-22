# iOS 26 Soft Scroll Edge Effect Runtime Research

Date: 2026-08-14

Updated: 2026-08-16

## Production Recovery Warning (2026-08-16)

The Apple runtime findings in this report remain research evidence. They do **not** mean the current RN production renderer is accepted. The content-adaptive renderer introduced by `[COMMIT]` and extended to the reader bottom by `[COMMIT]` failed fresh-install cold-start verification. The follow-up uncommitted native-wrapper experiment also failed and must not be committed.

Current production/recovery source of truth:

- [`08-16-recover-ios-progressive-blur/prd.md`](../../../../08-16-recover-ios-progressive-blur/prd.md)
- [`design.md`](../../../../08-16-recover-ios-progressive-blur/design.md)
- [`research/incident-and-baseline.md`](../../../../08-16-recover-ios-progressive-blur/research/incident-and-baseline.md)

Critical corrections:

- Apple's dark replay `0.30` branch is selected by an upstream content-resolved Light style, not by one average-luma threshold. Flat gray at sampled `0.87097` remained `0.60`, while black-on-white manga at `0.77419` resolved Light and used `0.30`.
- `backgroundReplay` is a backdrop layer. A theme-resolved solid `systemGroupedBackground` layer is not equivalent; under dark trait the RN layer resolved to black and produced the reported gray/black bands.
- Expo Blur requested intensity `0.092` but presented an inactive animator and Gaussian radius `29.5` after cold install. The earlier `1.84` radius capture describes a different activated/non-cold state and is not a cold-start guarantee.
- Never reduce alpha on `UIVisualEffectView` or an ancestor. The rejected local wrapper did so and made the blur nearly disappear, exactly as Apple documentation warns.
- Mean luma, the private content-style resolver, and final replay/darkening alpha are separate state layers. Do not collapse them again.

## Scope

This report records a simulator runtime investigation of Apple's iOS 26 `soft` scroll edge effect and the current React Native approximation in Novella.

The investigation used private runtime objects only from LLDB. Production source continues to use public APIs and app-owned React Native rendering. No `_UIScrollPocket*`, `CAFilter`, private selector, or private Core Animation API is called by shipped app code.

## Status Summary

### Directly verified

- The public `.soft` reference creates `UIKit.ScrollEdgeEffectView` with `PocketMask`, `PocketBlur`, and `LuminanceAdjustment` children.
- The Apple blur filter is `variableBlur` with `inputRadius = 1`, `inputFade = true`, `inputNormalizeEdges = true`, and `inputDither = false`.
- The mask is supplied through a `CAPortalLayer`, not `inputMaskImage`; the filter references it through `inputSourceSublayerName = "PocketBlurMask"`.
- The active `PocketBlur` is itself a `CABackdropLayer` with `tracksLuma = true`, `allowsFilteredLuma = true`, and `scale = 0.5`. Its filtered `variableBlur` backdrop luma, rather than an app background color, drives the numeric content adaptation.
- Standard collapsed navigation geometry on the tested device produces a `170.8 pt` effect.
- The PocketMask source is a black `ShadowLayer` with a Gaussian-style alpha falloff.
- The raw PocketMask is reused by replay, but PocketBlur transforms its alpha with an explicit color matrix before `variableBlur`: `alpha' = clamp(1.25 * alpha - 0.25)`.
- `backgroundReplay` is a disabled `CABackdropLayer` with no filters. In light appearance its resolved `systemGroupedBackground` RGB is `(0.94902, 0.94902, 0.968627)`; its opacity is dynamic rather than an unconditional `0.85`.
- Dark- and light-appearance luma thresholds and replay alpha values were recovered with Swift reflection, verified against the luma update disassembly, and exercised across nine controlled luminance rows in both appearances.
- The sampled filtered backdrop luma is transformed as `min(trunc(32 * clamp01(luma)), 31) / 31` on the tested simulator. Outputs are spaced by `1/31`, while input bin boundaries are spaced by `1/32`.
- Dark appearance selected replay alpha `0.85`, `0.60`, or `0.30` according to luma state; light appearance selected either `0.25` black darkening or `0.85` light replay.
- A high-to-low runtime trace directly verified the two-stage EMA and settle path: an immediate `0.30 -> 0.60` retarget followed approximately `0.35 s` later by `0.60 -> 0.85`.
- A dark-to-light trait transition on fixed low-luma content replaced replay `0.85` with darkening `0.25` before the next `50 ms` sample, with no independent opacity animation on those two internal layers.
- The mask alpha curve and the independently stretched AdditionalDimmingOverlay curve were sampled from compositor-visible diagnostic frames.
- Runtime breakpoints recovered the active luma smoothing weight (`0.7`), settling timer (`0.35 s`), and luma spring duration (`0.6 s`, zero bounce and initial velocity).
- Expo Blur's light and dark materials use different maximum Gaussian radii; one intensity value does not produce one cross-theme radius.
- The dark-material capture at intensity `9.2` presented radius `1.84` and scale `0.9195`.
- The light-material capture at experimental intensity `10` presented radius `3.0003`, scale `0.91249`, saturation `1.0800`, and tint-layer opacity `0.1000`; the current app default remains the recorded dark-material baseline `9.2`.
- In a controlled light-appearance comparison, replacing the RN pure-white scrim with calibrated replay RGB `(238,238,243)` reduced empty-background error from approximately `14` RGB levels to `0...3` across the effect.

### Derived, not directly guaranteed by Apple

- Comparing `inputRadius / backdropScale` initially suggested intensity `~9.2` for the captured dark material, but this is not a valid cross-theme or perceptual mapping.
- The experimental intensity `10` was a light-appearance visual calibration for slightly softer glyph edges, not an Apple parameter conversion; it is not the current default.
- A navbar accessory that extends the pocket by `H` points is expected to increase effect height by approximately `H`, but this has not been captured from an actual accessory configuration.
- The RN implementation now samples the measured navigation-bar region through public `CALayer.render(in:)`, downsamples it to `32 x 4`, computes weighted sRGB luma, and applies Apple's recovered `min(trunc(luma * 32), 31) / 31` binning. This is a production-safe sensor approximation, not Apple's private filtered-luma observer.
- The RN dark high-to-middle descent uses sampled luma `17/31` as the public-sensor boundary because rendered UIKit states changed between `17/31` and `19/31`; Apple's recovered private comparison constant remains `0.5` on a different effective-luma layer.

### Still unresolved

- Complete velocity-sensitive visibility branches and their exact animation predicates.
- Exact behavior for navbar-attached chips, search scopes, and other lower accessories.
- Pocket geometry when there are no floating/glass elements; runtime metadata exposes both `24 pt` and `18 pt` mask radii, but only the floating-element path was sampled.
- Pixel parity between the public RN luma sensor and Apple's filtered backdrop observer on mixed-color, animated, and non-layer-renderable content.
- Pixel-parity validation of Apple variable-radius blur versus Expo's full Gaussian blur composited through an alpha mask.

## Environment

- Xcode: `26.6` (`17F113`)
- Simulator runtime: iOS `26.5`
- Device: [SIMULATOR]
- Logical screenshot size: `402 x 874`
- App bundle: `sh.celia.novella`
- Expo Blur: version bundled with the current Expo SDK 57 workspace
- Reference screen content: native SwiftUI `List` hosted by `@expo/ui`

## Public Reference Surface

The native reference page uses only public configuration:

```swift
content.scrollEdgeEffectStyle(.soft, for: .top)
```

The native-stack screen also explicitly overrides the app's default hidden edge configuration:

```tsx
<Stack.Screen options={{ scrollEdgeEffects: { top: 'soft' } }} />
```

Relevant project files:

- `apps/mobile/modules/novella-ui/ios/NovellaSoftTopScrollEdgeEffectModifier.swift`
- `apps/mobile/modules/novella-ui/ios/NovellaUiModule.swift`
- `apps/mobile/src/app/settings/system-nav-blur.tsx`
- `apps/mobile/src/screens/settings/system-nav-blur-research-screen.ios.tsx`

The current reference page is a development-only iOS surface. It uses a native SwiftUI `List`, forces the real app/window appearance through React Native `Appearance.setColorScheme`, and restores the latest configured app theme whenever the page loses focus or unmounts. Nine fixed luminance rows render at `210 pt` including List row insets, which exceeds the measured `170.8 pt` effect height. Sixteen trailing placeholder rows provide deterministic initial scroll extent, so the final white sample can also be positioned completely beneath the navigation effect.

The page does not render `IosTopBarBackground` or any app-owned progressive blur. Private object access remains confined to LLDB.

## Runtime Inspection Method

### 1. Build and install the native modifier

A native build is required after adding or changing the Swift modifier. Metro reload is sufficient only for subsequent TypeScript/React changes.

### 2. Navigate and collapse the large title

The List must scroll under the collapsed native navbar so the top pocket is active. The reference page must not include the app-owned progressive blur.

### 3. Resolve the simulator process

```bash
xcrun simctl spawn booted launchctl list | rg 'sh\.celia\.novella|Novella'
```

### 4. Attach LLDB and locate the hierarchy

```lldb
expr -l objc++ -- id $app = (id)[(id)objc_getClass("UIApplication") performSelector:@selector(sharedApplication)]
expr -l objc++ -- id $scene = (id)[[(id)[$app connectedScenes] allObjects] firstObject]
expr -l objc++ -- id $window = (id)[$scene performSelector:@selector(keyWindow)]
expr -l objc++ -- id $root = (id)[$window performSelector:@selector(rootViewController)]
po [$root _printHierarchy]
po [$window recursiveDescription]
```

This debugger-only hierarchy exposed:

```text
UIKit.ScrollEdgeEffectView
  PocketMask
  PocketBlur
  LuminanceAdjustment
    BackdropView (backgroundReplay)
    darkeningView
  additionalDimming
```

### 5. Reflect Swift private storage without shipping private code

Given a runtime object address from the hierarchy:

```lldb
expr -l swift -O -- Array(
  Mirror(
    reflecting: unsafeBitCast(UInt(0xOBJECT_ADDRESS), to: AnyObject.self)
  ).children
).map { (($0.label ?? ""), String(reflecting: $0.value)) }
```

This exposed Swift-stored values that Objective-C `_ivarDescription` reported as `Value not representable`, including:

- `PocketMask.elementStyle`
- `PocketMask.previousBarFrame`
- `PocketBlur.blurAttenuation`
- `LuminanceAdjustment.parameters`
- `LuminanceAdjustment.alphaValues`
- `ScrollEdgeEffectView.elementModel`

### 6. Read Core Animation filter values

```lldb
po [(id)[$blurLayer valueForKey:@"filters"] firstObject]
po [[(id)[$blurLayer valueForKey:@"filters"] firstObject] valueForKey:@"inputRadius"]
po [[(id)[$blurLayer valueForKey:@"filters"] firstObject] valueForKey:@"inputNormalizeEdges"]
```

Apple returned:

```text
filter type: variableBlur
inputRadius: 1
inputNormalizeEdges: 1
inputMaskImage: nil
```

`inputMaskImage` is nil because the live mask arrives through a `CAPortalLayer` named `PocketBlurMask` whose `sourceLayer` is the PocketMask layer.

### 7. Read presentation-layer values for Expo Blur

Model-layer values describe the fully configured UIBlurEffect, not the partially completed Expo animator. The presentation layer is required:

```lldb
expr -l objc++ -- id $presentation = (id)[$expoBackdropLayer presentationLayer]
po [$presentation valueForKey:@"filters"]
po [[(id)[$presentation valueForKey:@"filters"] firstObject] valueForKey:@"inputRadius"]
po [$presentation valueForKey:@"scale"]
```

The tint view's presentation opacity was read separately from `_UIVisualEffectSubview.layer.presentationLayer`.

### 8. Capture and sample the Apple PocketMask curve

`renderInContext` returned a transparent image because the source layer was hidden by its portal. The successful method was debugger-only compositor isolation:

1. Hide `PocketBlur`, `LuminanceAdjustment`, and `additionalDimming`.
2. Set the root `ScrollEdgeEffectView` background to white.
3. Temporarily set both PocketMask portal layers' `hidesSourceLayer` to `false`.
4. Capture a simulator screenshot.
5. Sample an unobstructed vertical column with ImageMagick.
6. Restore every modified runtime property immediately.

Example sampling command:

```bash
magick apple-soft-mask-composited.png \
  -crop 1x171+100+0 \
  txt:apple-soft-mask-column.txt
```

For black over white, mask alpha is:

```text
alpha = 1 - gray / 255
```

This procedure changes only the paused simulator process. No diagnostic mutation is stored in source.

## UIKitCore Static Switching Reconstruction

The iOS 26.5 simulator implementation was disassembled from the installed local UIKitCore runtime image; its filesystem path is intentionally omitted.

The relevant unslid text addresses are:

```text
0x23783c  BackdropView luma quantizer
0x2378c4  BackdropView backdropLayer:didChangeLuma:
0x23999c  LuminanceAdjustment state and alpha update
0x239c50  light-appearance alpha selection
0x239d00  dark-appearance alpha selection
0x23a600  PocketBlur layer/filter configuration
0x2807e4  Gaussian/variable CAFilter builder
0x282088  ScrollEdgeEffectView filtered-luma update
0x283238  settle-timer callback
```

These addresses and private names are research evidence only. They are not referenced by production code.

### Filtered-luma source

The controlled reference page was opened directly and its native List was positioned over a fixed sample by setting the native collection-view offset. With the `.soft` pocket active, read-only runtime inspection returned:

```text
PocketBlur layer:       CABackdropLayer
tracksLuma:             true
allowsFilteredLuma:     true
scale:                  0.5
filter type:            variableBlur
inputRadius:            1
inputFade:              true
inputNormalizeEdges:    true
inputDither:            false
inputMaskImage:         nil
```

The filter builder at `0x2807e4` selects `kCAFilterVariableBlur` when its low flag bit is set and otherwise selects `kCAFilterGaussianBlur`. It then writes exactly these linked QuartzCore keys, all of which remain private implementation details despite being named symbols:

```text
kCAFilterInputFade
kCAFilterInputRadius
kCAFilterInputNormalizeEdges
kCAFilterInputDither
```

`PocketBlur` separately writes `PocketBlurMask` through `kCAFilterInputSourceSublayerName`. The named source is the live `CAPortalLayer`; no bitmap `inputMaskImage` is installed.

The active filter list contains no saturation, tint, or material filter. `PocketBlur` therefore does not construct a `UIBlurEffect` material. Its visual path is a backdrop plus one spatial `variableBlur` filter. This is narrower than claiming the whole private scroll-edge implementation has no other color handling: replay, black darkening, and additional dimming remain separate sibling layers.

`LuminanceAdjustment.backgroundReplay` is a second `CABackdropLayer` configured differently:

```text
groupName:              backgroundGroup-<LuminanceAdjustment address>
scale:                  0.5
tracksLuma:             false
allowsFilteredLuma:     true
enabled:                false
filters:                []
```

It replays a named background group as a solid semantic background. It does not produce the numeric luma sample.

### Quantization

`BackdropView` receives the `CABackdropLayer` delegate callback, transforms the floating-point value at `0x23783c`, stores it only when changed, and then invokes its Swift handler. For the finite, nonnegative luma values emitted in this test, the transform is:

```text
q = min(trunc(32 * min(rawLuma, 1)), 31) / 31
```

Equivalently for the observed `0...1` domain:

```ts
function quantizeFilteredLuma(rawLuma: number): number {
  const clamped = Math.min(Math.max(rawLuma, 0), 1);
  const bucket = Math.min(Math.trunc(clamped * 32), 31);
  return bucket / 31;
}
```

This explains why values are reported as `n / 31` while the source bins are cut at `n / 32`. Calling this ordinary rounding would be incorrect.

### EMA and settle

The main luma update at `0x282088` accepts the quantized sample and a boolean selecting the immediate smoothing path. In the active standard configuration, its behavior reduces to:

```ts
function updateFilteredLuma(sample: number, smooth: boolean) {
  const canSmooth = smooth
    && !isOwningViewEffectivelyHidden
    && previousEffectiveLuma != null;

  const effective = canSmooth
    ? sample * 0.70 + previousEffectiveLuma * 0.30
    : sample;

  if (effective !== sample) {
    replaceSettleTimer(0.35, () => {
      updateFilteredLuma(sample, false);
      previousEffectiveLuma = null;
    });
  } else {
    invalidateSettleTimer();
  }

  previousEffectiveLuma = effective;
  updateResolvedLumaStyle(effective);
}
```

The actual function has additional hard-style, reduced-transparency, fixed-trait, visibility, debug, and animation branches. The pseudocode intentionally describes only the active soft standard-navigation path verified on the test surface.

The timer callback at `0x283238` calls the same update with smoothing disabled, then clears `previousEffectiveLuma`. A newer intermediate sample replaces the previous nonrepeating timer. This is the static explanation for the measured dark high-to-low sequence:

```text
raw settled high:       0.93548
new quantized low:      0.03226
immediate effective:    0.70 * 0.03226 + 0.30 * 0.93548 = 0.30323
settled effective:      0.03226 after 0.35 s
```

When edge-effect animations are enabled, a changed luma style is applied with a `0.60 s` spring, zero bounce, zero initial velocity, and no delay. The settle callback retargets that same interruptible animation.

### Hysteresis and alpha selection

`LuminanceAdjustment` keeps a separate `LumaStyle(effectiveLuma, resolvedUserInterfaceStyle)` and a `showingBackgroundReplay` state. The reflected base parameters are:

```text
lightHystersis:          0.7 ... 0.9
darkHystersis:           0.1 ... 0.3
captureColorLuminance:   dynamic semantic background luma
replayAlphaThresholdD:   0.5
replayAlphaL:            0.85
replayAlphaD:            0.85
darkeningAlphaL:         0.25
darkeningAlphaLowD:      0.60
darkeningAlphaHighD:     0.60
```

The code first clamps the resolved capture-color luminance `c`. It maps the base hysteresis endpoints toward that semantic background:

```ts
const lightBounds = [0.7 * c, 0.9 * c];
const darkBounds = [c + (1 - c) * 0.1, c + (1 - c) * 0.3];
```

On the tested dark `systemGroupedBackground`, `c = 0`, so the active dark bounds remain `0.1...0.3`. On the tested light background, runtime reported `c = 0.9504352941`, so the effective light bounds are approximately `0.6653...0.8554`. The controlled `1/31` samples crossed those effective bounds between the recorded rows. The reflected `0.7...0.9` values are base parameters, not the final comparison operands.

For stable soft states, the replay-state transitions are:

```ts
if (appStyle === 'light') {
  if (showingBackgroundReplay && effectiveLuma < lightBounds[0]) {
    showingBackgroundReplay = false;
  } else if (!showingBackgroundReplay && effectiveLuma > lightBounds[1]) {
    showingBackgroundReplay = true;
  }
} else {
  if (showingBackgroundReplay && effectiveLuma > darkBounds[1]) {
    showingBackgroundReplay = false;
  } else if (!showingBackgroundReplay && effectiveLuma < darkBounds[0]) {
    showingBackgroundReplay = true;
  }
}
```

Equality does not cross a boundary. A `scrollVelocity >= 0.15` guard suppresses one state-entry path while replay is currently off; it does not replace the EMA or settle mechanism. The stored velocity appears to be a nonnegative magnitude in the active call chain, but this investigation has not named every upstream velocity transformation.

The stable rendered alpha selection then reduces to:

```ts
if (appStyle === 'light') {
  return showingBackgroundReplay
    ? { replay: 0.85, darkening: 0.00 }
    : { replay: 0.00, darkening: 0.25 };
}

if (showingBackgroundReplay) {
  return { replay: 0.85, darkening: 0.00 };
}

if (resolvedContentStyle === 'light') {
  return {
    replay: hasFloatingElements ? 0.30 : 0.10,
    darkening: 0.00,
  };
}

return {
  replay: effectiveLuma > 0.5 ? 0.60 : 0.60,
  darkening: 0.00,
};
```

The final two `0.60` values come from distinct `darkeningAlphaHighD` and `darkeningAlphaLowD` fields that happen to be equal in the tested `.soft` parameter set. Despite those private field names, runtime child inspection shows the selected value is assigned to `backgroundReplay.alpha`, not `darkeningView.alpha`.

The `0.30` dark high-luma branch is not selected directly by `effectiveLuma > 0.5`. It is selected when the upstream content-resolved user-interface style becomes Light and floating elements are present. The `0.5` comparison selects between the two currently equal `0.60` parameters in the remaining dark middle branch. The exact private trait-resolution algorithm that changes `resolvedContentStyle` contains additional trait-collection machinery and is not fully reconstructed here; the controlled matrix verifies its final rendered states.

This produces the observed normal outputs:

```text
Light, low content:      replay 0.00, black darkening 0.25
Light, high content:     replay 0.85, black darkening 0.00
Dark, very low content:  replay 0.85, black darkening 0.00
Dark, middle content:    replay 0.60, black darkening 0.00
Dark, high light-style:  replay 0.30, black darkening 0.00
```

The app/window trait chooses the light or dark state machine, but it does not lock the result to one navbar color. Filtered content luma and the content-resolved style still choose the state inside that branch. This is why a white page under a dark-trait navbar can reach the dark high-luma replay value `0.30`.

### Separate luma-style interaction

`_UIScrollPocketLumaObserverInteraction` is a separate object. Its `lumaForEdge:` method indexes a four-edge map, and its description converts the stored values with `_NSStringFromUIUserInterfaceStyle`. It tracks top/left/bottom/right interface-style classifications from collected pocket elements; it is not the floating-point pixel-luma sampler.

The numeric path remains:

```text
PocketBlur CABackdropLayer filtered luma
  -> BackdropView 32-bin quantizer
  -> ScrollEdgeEffectView EMA and settle
  -> content/trait style resolution
  -> LuminanceAdjustment hysteresis
  -> backgroundReplay and darkeningView alpha
```

## Apple Runtime Structure and Parameters

### Effect geometry

Observed standard collapsed configuration:

```text
ScrollEdgeEffectView frame: (0, 0, 402, 170.8)
TouchBlocker frame:          (0, 0, 402, 106)
barRegion:                   (0, 62, 402, 44)
barRegion maxY:              106
previousBarFrame:            (-65, -65, 532, 171)
```

Pocket element style:

```text
color: black
blurRadius: 24
floatingBlurRadius: 18
hasFloatingElements: true
```

The active mask layer used:

```text
ShadowLayer bounds:       (0, 0, 532, 171)
ShadowLayer position:     (201, 20.5)
ShadowLayer frame:        (-65, -65, 532, 171)
shadowRadius:             18
shadowOpacity:            1
shadowOffset:             (0, 0)
shadowPathIsBounds:       true
```

The earlier `3.6 * radius` relationship is a useful measurement, but reverse engineering shows it is not Apple's geometry formula. PocketMask builds the contour from element frames using:

```text
horizontal padding = ceil(2.7 * selectedRadius)
edge extension = 20 pt
vertical inset before union = min(10 pt, elementHeight / 2)
```

The active shadow is then rendered with the selected radius. This produces the observed tail through Core Animation's shadow kernel, rather than by directly adding a `3.6 * radius` constant. For the captured floating-element branch the selected radius is `18 pt`; the precise effect height still depends on element frames, bar region, and shadow falloff. An attached lower accessory needs a dedicated runtime capture.

### Blur layer

```text
filter:                 variableBlur
inputRadius:            1
inputNormalizeEdges:    true
inputMaskImage:         nil
CABackdropLayer scale:  0.5
blurAttenuation:        1.25
tracksLuma:             true
tracksLumaWhileHidden:  true
allowsFilteredLuma:     true
lumaSubrect:            (0, 62, 402, 44)
```

The PocketMask portal used:

```text
name:               PocketBlurMask
rasterizationScale: 0.25
hidesSourceLayer:   true
sourceLayer:        PocketMask root layer
filter:             colorMatrix
```

The portal color matrix is not default. Its `inputColorMatrix` is:

```text
[1,0,0,0,0;
 0,1,0,0,0;
 0,0,1,0,0;
 0,0,0,1.25,-0.25]
```

It leaves RGB unchanged and transforms mask alpha before compositor clamping:

```text
blurMaskAlpha = clamp(1.25 * rawPocketMaskAlpha - 0.25)
```

The LuminanceAdjustment portal uses the raw PocketMask with `compositingFilter = destIn` and no color matrix. Replay and blur therefore have related but intentionally different mask curves.

### Luminance adjustment parameters

Swift reflection returned:

```text
lightHystersis:            0.7 ... 0.9
darkHystersis:             0.1 ... 0.3
darkeningAlphaL:           0.25
darkeningAlphaLowD:        0.6
darkeningAlphaHighD:       0.6
replayAlphaThresholdD:     0.5
replayAlphaL:              0.85
replayAlphaD:              0.85
backgroundScale:           0.5
enableDimming:             true
useHardEdges:              false
useHeavyReplay:            false
prefersSolidColorHardPocket: false
```

Dark appearance capture:

```text
current luma:             0.06451613
captureColorLuminance:    0.0
floating UI style:        Dark
glass UI style:           Dark
backgroundReplay alpha:   0.85
darkeningView alpha:      0.0
```

The compact `ScrollEdgeEffectView` description called the selected value `darkeningAlpha = 0.85`, while reflected `AlphaValues` showed `backgroundReplay = 0.85, darkening = 0.0`. The reflected child-view alpha is the more precise description of the rendered structure.

Light appearance capture:

```text
current luma:             0.9032258
captureColorLuminance:    0.9504352941
floating UI style:        Light
glass UI style:           Light
backgroundReplay alpha:   0.85
darkeningView alpha:      0.0
```

The compact description called the selected value `lighteningAlpha = 0.85`.

These two captures are point states, not theme-wide constants. The controlled matrix below demonstrates the dynamic branches.

### Controlled light/dark luminance matrix

The development reference page was held at nine content positions. Each position allowed the `0.35 s` settle timer and `0.60 s` configured spring duration to elapse before reflection. The nominal row label describes the row background; `PocketBlur.currentLuma` is UIKit's actual sampled, quantized value and includes the complete navigation sampling region.

| Nominal row luma | Dark sampled luma | Dark replay | Darkening | Light sampled luma | Light replay | Darkening |
|---:|---:|---:|---:|---:|---:|---:|
| 0.00 | 0.03226 | 0.85 | 0.00 | 0.09677 | 0.00 | 0.25 |
| 0.01 | 0.12903 | 0.85 | 0.00 | 0.19355 | 0.00 | 0.25 |
| 0.04 | 0.22581 | 0.85 | 0.00 | 0.29032 | 0.00 | 0.25 |
| 0.13 | 0.38710 | 0.60 | 0.00 | 0.45161 | 0.00 | 0.25 |
| 0.27 | 0.51613 | 0.60 | 0.00 | 0.58065 | 0.00 | 0.25 |
| 0.43 | 0.61290 | 0.60 | 0.00 | 0.70968 | 0.00 | 0.25 |
| 0.65 | 0.74194 | 0.60 | 0.00 | 0.83871 | 0.00 | 0.25 |
| 0.89 | 0.87097 | 0.60 | 0.00 | 0.93548 | 0.85 | 0.00 |
| 1.00 | 0.93548 | 0.30 | 0.00 | 1.00000 | 0.85 | 0.00 |

All 18 normal navigation-chain states retained `additionalDimming.alpha = 0.01`.

Directional captures separated the hysteresis branches:

- Light appearance entered replay above the upper `0.9` neighborhood and retained it at sampled luma `0.70968`; it had returned to `0.25` darkening by sampled luma `0.58065`, consistent with the reflected `0.7 ... 0.9` hysteresis.
- Dark appearance entered the low-to-middle replay state between sampled luma `0.22581` and `0.38710`, and returned to the low state between `0.12903` and `0.03226`, consistent with the reflected `0.1 ... 0.3` hysteresis.
- Dark appearance entered the high-luma replay state only above the `0.9` neighborhood. On the descending path it retained replay `0.30` at sampled luma `0.61290` and had changed to `0.60` by `0.51613`. This is consistent with the internal `replayAlphaThresholdD = 0.5` after quantization/effective-luma processing; the displayed `PocketBlur.currentLuma` is not the exact comparison operand.

`ScrollPocketLumaStyle`, the raw `PocketBlur.currentLuma`, `LuminanceAdjustment.LumaStyle`, and the final `AlphaValues` are distinct state layers. In one descending dark capture, the raw PocketBlur luma was `0.61290`, the local luminance-adjustment luma was also `0.61290`, but the upstream `ScrollPocketLumaStyle` retained `luma = 0.75`, `darkeningAlpha = 0.30`, and `glassUserInterfaceStyle = Light`. Conclusions must therefore use the rendered replay/darkening child alphas rather than treating any one private field as the complete state.

### Dynamic transition traces

A debugger-only `50 ms` sampler recorded the rendered model alpha, presentation-layer opacity, and current luma during a high-to-low dark-content jump:

```text
t=0.201  offset changes high -> low; luma 0.93548; replay target 0.30
t=0.305  luma becomes 0.03226; replay target retargets 0.30 -> 0.60
t=0.651  settle path retargets replay 0.60 -> 0.85
t=1.551  replay presentation opacity reaches 0.85 exactly
```

The first effective luma is approximately:

```text
0.70 * 0.03226 + 0.30 * 0.93548 = 0.30323
```

That value remains just above the dark `0.30` boundary, explaining the immediate middle replay target. About `0.35 s` later, the settle path uses the stable low sample and retargets to `0.85`. The presentation layer remained continuous across the second retarget, directly confirming the spring is interruptible rather than a pair of opacity jumps.

A separate debugger-triggered dark-to-light window trait change on fixed low-luma content produced:

```text
t=0.201  dark trait; replay 0.85; darkening 0.00; luma 0.03226
t=0.251  light trait; replay 0.00; darkening 0.25; luma still 0.03226
t=0.300  light trait; replay 0.00; darkening 0.25; luma resampled to 0.09677
```

At `t=0.251`, model and presentation opacity were already equal to the new targets. The internal replay and darkening layers therefore do not run the scrolling-luma spring for this trait-change path. This does not rule out an outer UIKit snapshot or appearance transition elsewhere in the view hierarchy.

Additional dimming:

```text
view:  UIImageView
image: AdditionalDimmingOverlay (240 x 240 @1x)
alpha: 0.01
frame: (-120, -166, 642, 332)
```

The Apple image was inspected but is not copied into project assets. It is a black grayscale-alpha image. With the observed standard top geometry, UIKit lays it out using:

```text
image size: 240 x 240
horizontal padding: 240 / 4 + 60 = 120
vertical padding:   240 / 4 = 60
frame: (-120, -barRegion.maxY - 60, screenWidth + 240, 2 * barRegion.maxY + 120)
```

For `barRegion.maxY = 106`, this yields the captured `(-120, -166, 642, 332)` frame. The stretched center column has raw alpha `1.0` through `45 pt`, then falls to `0.898` at `80 pt`, `0.510` at `105 pt`, `0.106` at `130 pt`, `0.004` at `155 pt`, and zero at `165 pt`. The layer's opacity is then `0.01`.

This is geometry-conditional. Entering the same reference screen directly by deep link produced `TouchBlocker = 94.33 pt` and `additionalDimming.hidden = true`; entering through Settings with a back control produced `TouchBlocker = 106 pt` and the visible alpha-`0.01` dimming layer. The static RN reconstruction models the normal Settings navigation chain only.

## Sampled Apple PocketMask Alpha Curve

The active curve was sampled at the center of the effect on the standard collapsed navbar. Values below are direct 8-bit screenshot measurements.

| y (pt) | Position | Mask alpha |
|---:|---:|---:|
| 0 | 0.0% | 1.0000 |
| 55 | 32.2% | 1.0000 |
| 60 | 35.1% | 0.9961 |
| 65 | 38.0% | 0.9922 |
| 70 | 40.9% | 0.9882 |
| 75 | 43.9% | 0.9765 |
| 80 | 46.8% | 0.9569 |
| 85 | 49.7% | 0.9333 |
| 90 | 52.6% | 0.8902 |
| 95 | 55.6% | 0.8275 |
| 100 | 58.5% | 0.7451 |
| 105 | 61.4% | 0.6471 |
| 110 | 64.3% | 0.5333 |
| 111 | 64.9% | 0.5098 |
| 115 | 67.3% | 0.4118 |
| 120 | 70.2% | 0.2941 |
| 125 | 73.1% | 0.2000 |
| 130 | 76.0% | 0.1294 |
| 135 | 78.9% | 0.0784 |
| 140 | 81.9% | 0.0431 |
| 145 | 84.8% | 0.0196 |
| 150 | 87.7% | 0.0078 |
| 155 | 90.6% | 0.0000 |
| 169 | 98.8% | 0.0000 |

The RN implementation now uses this raw curve for replay and uses `clamp(1.25 * alpha - 0.25)` for the separate Expo Blur mask. Apple PocketBlur therefore still differs in its filter operation, but RN no longer incorrectly shares one opacity curve between blur and replay.

## Expo Blur Mapping

Expo implements intensity with a partially completed linear `UIViewPropertyAnimator` from no effect to a `UIBlurEffect`:

```swift
animator?.fractionComplete = CGFloat(intensity)
```

The JavaScript `0...100` intensity is converted to native `0...1`.

### Measured at intensity 5

```text
model gaussian radius:          20
presentation gaussian radius:   1.0000019
model backdrop scale:           0.125
presentation backdrop scale:    0.95625
presentation color saturation:  1.0400001
tint layer opacity:             0.0500001
tint background:                gray 0.11, alpha 0.73
```

The effective tint contribution before the app scrim is approximately:

```text
0.05 * 0.73 = 0.0365
```

### Measured at intensity 9.2, dark material

```text
presentation gaussian radius: 1.84
presentation backdrop scale:  0.9195
```

### Measured at intensity 10, light material

```text
presentation gaussian radius: 3.0002611
presentation backdrop scale:  0.9124924
presentation color saturation: 1.0800070
tint-layer presentation opacity: 0.1000087
tint background: white, alpha 0.3
```

The different radii are caused by different `UIBlurEffect` material definitions, not measurement noise. The dark capture interpolated toward a `20 pt` model radius; the light capture interpolated toward a `30 pt` model radius.

### Radius/scale inference and correction

Apple's layer reports radius `1` and scale `0.5`. The first Expo estimate treated `radius / scale` as an effective blur metric and solved the dark-material interpolation:

```text
20f / (1 - 0.875f) = 2
f ~= 0.09195
```

That produced the initial intensity `9.2`. It remains a useful record of the reasoning, but it is not a valid global mapping because:

- Expo's light and dark materials use different model radii.
- Apple uses spatial `variableBlur`; RN opacity-composites a full Gaussian blur.
- Expo additionally animates material tint and saturation.
- `radius / scale` is not proven to predict equal pixel output across these pipelines.

The temporary light-mode intensity `10` experiment was reverted. The current default is the recorded dark-material baseline `9.2`; it is retained as an app approximation and must be revalidated independently in light and dark appearance after the layer structure is aligned.

### Current scrim compensation

The temporary merged `0.84` / `(238,238,243)` overlay has been replaced in RN. The current static implementation uses the verified light replay RGB `#F2F2F7` with raw-mask strength `0.85`, an attenuated blur mask, and a separate black dimming curve at `0.01` opacity.

The verified Apple light-mode layers are:

```text
1. PocketBlur: variableBlur with attenuated blur mask
2. backgroundReplay: #F2F2F7 at alpha 0.85
3. darkeningView: black, alpha selected by luma state (0 in the captured light state)
4. raw PocketMask portal: destIn compositing mask for layers 2 and 3
5. additionalDimming: independent black alpha image at opacity 0.01
```

`backgroundReplay` has `enabled = NO`, an empty filter array, and no own mask. It is solid-color replay, despite its `CABackdropLayer` class. The dimming image explains why a direct `#F2F2F7 @ 0.85` overlay is about three RGB levels too bright at the top. The previous darker RGB merged these layers numerically but changed their behavior over text and through the fade.

The RN static rewrite now mirrors this separation. In a normal Settings navigation-chain capture at identical list geometry and content position, empty-background RGB delta was `0...1` from `y=0...60`, no more than `3` through `y=120`, and zero from `y=140` downward. Normalized glyph edge mean was `0.2827` for RN and `0.2858` for Apple. Live luma selection and the deep-link dimming-hidden branch remain unimplemented in RN.

## Structural Difference Between Apple and RN

Apple pipeline:

```text
backdrop
  -> variableBlur(radius=1, named PocketBlurMask portal)
  -> blur portal alpha matrix: clamp(1.25 * rawMask - 0.25)
  -> LuminanceAdjustment group: solid background replay + optional black darkening
  -> raw PocketMask portal with destIn compositing for that group
  -> independent AdditionalDimmingOverlay black alpha image
```

Current RN pipeline:

```text
public CALayer navigation-region sample, 32 x 4 -> weighted sRGB luma
  -> min(trunc(luma * 32), 31) / 31
  -> TS prior-effective EMA / mapped hysteresis / conditional 350 ms settle
  -> Reanimated 600 ms critical spring for luma-driven retargets
backdrop
  -> Expo UIBlurEffect Gaussian blur + color saturation + material tint
  -> MaskedView with attenuated blur alpha: clamp(1.25 * rawMask - 0.25)
  -> raw-mask semantic background replay at dynamic alpha 0 / 0.30 / 0.60 / 0.85
  -> raw-mask black darkening at dynamic alpha 0 / 0.25
  -> independent sampled 1% black dimming gradient, mirrored for the active edge
```

`IosTopBarBackground` and the reader's `IosBottomBarBackground` own edge-aware sensors and RN layers, so existing top-blur owners plus the shared novel/comic reader bottom toolbar receive the same behavior without per-screen `onScroll` work. Top sampling uses the active navigation bar's bottom `44 pt`; reader bottom sampling uses the `44 pt` content strip at the progressive blur's upper boundary, above the standard `44 pt` bottom toolbar. Sampling the toolbar band itself is invalid because its native controls and deeper dimming pin the measured luma low. Sampling is limited to `20 Hz` during native scroll changes and `2 Hz` while a focused, visible bar is stationary; hidden or unfocused bars stop sampling. The Expo Fabric bridge event is registered end-to-end as `onBarLumaChange`; omitting the `on` prefix causes React Native and the native emitter to normalize to different event keys, leaving both bars stuck at their initial replay values. The visibility event uses native `onBarBackgroundVisibilityChange`, mapped to the public `onTopBarBackgroundVisibilityChange` wrapper callback: naming the native event `onTop...` collides with React Native's reserved `top` normalization and registers `topTop...` while dispatching `top...`. Each tagged RN bar container, including the reader page counter, is temporarily excluded from its public layer capture and restored before the disabled-actions Core Animation transaction commits, preventing self-feedback.

These operations are not mathematically identical:

- Apple changes blur radius spatially inside the filter.
- RN applies a full blur, then changes the blurred layer's opacity spatially.
- Expo adds saturation and tint that Apple's PocketBlur filter does not list.
- Apple's private observer can sample filtered compositor content that `CALayer.render(in:)` may not reproduce.

A small residual visual difference is expected until the pipeline difference is resolved or calibrated by image comparison.

## RN Height and Clipping Findings

The first RN attempt placed a `171 pt` effect inside React Navigation's native `headerBackground` host. The host's collapsed frame was only `116 pt` and had clipping enabled, so the extra `55 pt` tail was discarded. The measured curve was compressed/cut at the header boundary.

The comparison page now renders the RN effect as a screen-content sibling overlay:

```text
screen content root
  SwiftUI Host -> List
  RN progressive blur overlay, height 171
  scroll-edge marker
native navigation bar remains above the screen content
```

This preserves the native List and navbar while allowing the Gaussian tail to extend below the native header host.

Production integration now uses this same overlay host. `NativeScreenScaffold`, `NativeGroupedListPlatform`, `BookDetailScreen`, and `ReaderNavigation` mount `IosTopBarBackground` as a `171 pt` screen-content sibling; their native `headerBackground` implementations are explicitly `null`. `ReaderChapterNavigation` mounts `IosBottomBarBackground` behind the native bottom toolbar with the existing safe-area, `44 pt` toolbar, and blur-bleed geometry. The standard stack preset is likewise transparent and does not leave an invisible React Native background in the header host.

A runtime capture of the collapsed Settings page confirms an empty clipped `402 x 116 pt` native header host and, separately, an app-owned non-interactive `402 x 171 pt` overlay containing the Expo blur, attenuated mask, replay, and dimming layers. The native `ScrollEdgeEffectView` has `alpha = 0`; the app overlay is not double-composited with UIKit's system effect.

The standard height remains fixed at `171 pt`. `IosTopBarBackground` exposes `effectHeight`, so a screen that adopts an accessory-specific measured geometry can override it without duplicating the rendering pipeline.

A lower navbar accessory must be measured as real element geometry. The only defensible starting point is that its visual frame participates in PocketMask's contour construction, which applies `ceil(2.7 * selectedRadius)` horizontal padding, `20 pt` edge extension, `min(10 pt, height / 2)` vertical inset, and Core Animation shadow falloff. It must not be modeled with the old `barRegion.maxY + 3.6 * radius` shortcut.

## Current Project Defaults

At the time of this report:

```text
intensity:        9.2 (recorded dark-material baseline, not an Apple mapping)
maskFadeStart:    32%
maskFadeEnd:      91%
replay strength:  dynamic 0 / 0.30 / 0.60 / 0.85
light replay RGB: 242,242,247 (#F2F2F7)
darkening:        dynamic 0 / 0.25 black through the raw mask
blur mask:        clamp(1.25 * rawMask - 0.25)
additional dimming: black sampled curve at 0.01 opacity
visibility time:  140 ms (app-owned; not Apple's luma animation)
luma settle/spring: 350 ms / 600 ms critical damping
light capture luma: 0.9504352941, mapping base 0.7 ... 0.9 to ~0.6653 ... 0.8554
reference height: 171 pt (explicit IosTopBarBackground effectHeight)
```

Verified Apple dynamic values for the standard reference surface:

```text
luma smoothing:           latest * 0.70 + previous * 0.30
settle timer:              0.35 s, nonrepeating, common run-loop modes
luma spring duration:      0.60 s
luma spring bounce:        0
luma initial velocity:     0
light replay/darken:       0.85 / 0.25 with 0.7 ... 0.9 hysteresis
dark replay levels:        0.85 / 0.60 / 0.30
dark low/middle range:     0.1 ... 0.3 hysteresis
dark high descent input:   replayAlphaThresholdD = 0.5
sample quantization:       min(trunc(clamp01(luma) * 32), 31) / 31
```

The interaction layer also has velocity-sensitive visibility-animation branches with observed `0.35 s`, `0.25 s`, and `0.20 s` durations. Their branch predicates have not been fully named or reproduced.

## Remaining Work

1. Create a public native reference configuration with a navbar-attached lower accessory or search scope row.
2. Dump its `elementModel`, `barRegion`, `PocketMask.elementStyle`, `previousBarFrame`, and effect frame.
3. Verify whether the active radius remains `18`, switches to `24`, or changes with accessory style.
4. Measure geometry conditions for AdditionalDimmingOverlay visibility, including the deep-link no-back-control branch.
5. Name and verify the velocity-sensitive visibility predicates associated with the observed `0.35 s`, `0.25 s`, and `0.20 s` branches.
6. Compare glyph-edge output after the structural rewrite. Exact variable blur remains impossible with Expo Blur alone.
7. Compare the public `CALayer.render(in:)` sensor output against Apple's filtered luma on mixed-color rows, images, and WebView content; keep private luma observers and filters out of production.
8. Validate normal pages, native grouped Lists, book detail, comic reader, Readium, and navbar accessory layouts independently.

## External Leads

These sources motivated the runtime investigation but did not provide the exact values recorded above:

- Apple `UIScrollEdgeEffect.Style` documentation: https://developer.apple.com/documentation/uikit/uiscrolledgeeffect/style-swift.class
- Zenn investigation of `_UIScrollPocketContainerInteraction`: https://zenn.dev/ushisantoasobu/scraps/[COMMIT]
- iOS 26.1 UIKitCore runtime headers: https://developer.limneos.net/?framework=UIKitCore.framework&ios=26.1
- blacktop UIKitCore symbol diffs: https://github.com/blacktop/ipsw-diffs/blob/main/26_0_23A5308g__vs_26_0_[COMMIT]/DYLIBS/UIKitCore.md
- Sebastian Vidal, UIKit 26 analysis: https://sebvidal.com/blog/whats-new-in-uikit-26/
- Community variable blur example discussion: https://www.reddit.com/r/SwiftUI/comments/1qjh5nr/how_does_revolut_do_this_progressive_blur/
- Jens van Steen discussion of `_UIScrollPocketInteraction`: https://www.linkedin.com/posts/jens-van-steen-[COMMIT]_since-ios-26-navigation-bars-are-transparent-activity-7452025075740090369-v7IZ

## Safety Boundary

Allowed production mechanisms remain:

- SwiftUI `.scrollEdgeEffectStyle` / `.scrollEdgeEffectHidden`
- UIKit `UIScrollEdgeEffect` public properties
- React Native Screens official `scrollEdgeEffects`
- app-owned React Native blur, mask, replay, and darkening rendering
- bounded public `CALayer.render(in:)` / Core Graphics luma sampling

Debugger-only mechanisms used in this report must not enter production source:

- `_printHierarchy` / `recursiveDescription`
- `_UIScrollPocket*` object access
- Swift reflection over private UIKit storage
- KVC into `CAFilter` or private `CABackdropLayer` properties
- portal `hidesSourceLayer` mutation
- runtime child hiding or background mutation for mask capture

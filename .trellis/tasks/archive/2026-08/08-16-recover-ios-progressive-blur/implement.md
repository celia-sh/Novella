# Implementation Plan: Recover iOS progressive blur rendering

## Phase 0: Freeze And Record

- [x] Stop renderer implementation after the failed native-wrapper reinstall.
- [x] Capture current Git status, commit timeline, installed hierarchy, luma state, animator state, filter radius, and screenshots.
- [x] Create this P0 recovery task and update the frontend component contract.
- [x] Do not commit or push the current dirty renderer experiment.

## Phase 1: Remove The Failed Experiment

- [x] Delete untracked `NovellaProgressiveBlurView.swift` and `native-progressive-blur*` files.
- [x] Remove `ProgressiveBlur` registration from `NovellaUiModule.swift`.
- [x] Remove the blur-opacity helper and its test.
- [x] Restore the tracked renderer/config files through targeted edits based on the `[COMMIT]`/`[COMMIT]` file content.
- [x] Confirm no unrelated dirty files are touched.

## Phase 2: Re-establish The Visual Baseline

- [x] Keep later scroll ownership, top/bottom overlay geometry, marker lifecycle, and screen fixes.
- [x] Build a fresh development client.
- [x] Install over the simulator, terminate, and cold-launch.
- [x] Have the user position the target content; do not auto-scroll.
- [x] Capture top and bottom screenshots and read-only hierarchy/filter evidence.
- [ ] Record user acceptance that the exact baseline renderer is visually stable after cold install. Do not infer from Metro reload.

## Phase 3: Separate Content Style From Mean Luma

- [ ] Extend the existing single `32 x 4` native capture with median/high-percentile luma and bright-pixel coverage.
- [ ] Keep the existing quantized mean luma path for EMA and numeric hysteresis.
- [ ] Add an explicit content-style approximation and event types.
- [ ] Add unit tests proving flat bright gray and black-on-white manga can resolve differently.
- [ ] Verify theme changes reset app-appearance state without discarding the latest content sample.

## Phase 4: Build The Classification Matrix

- [ ] Black.
- [ ] Low gray.
- [ ] Middle gray.
- [ ] Flat bright gray.
- [ ] Pure white.
- [ ] Black-on-white manga.
- [ ] Ordinary image/photo.
- [ ] WebView/Readium content.
- [ ] Record Apple hidden-reference style/replay and RN sample/classification for each case.

## Phase 5: Evaluate Renderer Candidates In Isolation

For each candidate:

- [ ] Change one composition variable only.
- [ ] Keep the visual-effect view and all ancestors alpha `1`.
- [ ] Use no custom native blur view, animator intensity hack, or private API.
- [ ] Rebuild/install/cold-launch.
- [ ] Capture black/white preservation, blur visibility, and mask geometry.
- [ ] Reject the candidate immediately if blur disappears, dark trait paints white manga gray/black, or cold and reload behavior differ.

Do not integrate dynamic adaptation until one candidate preserves the Phase 2 baseline.

## Phase 6: Integrate Top

- [ ] Connect mean luma and resolved content style to the validated composition.
- [ ] Preserve `171 pt` top geometry and system-edge suppression.
- [ ] Verify rest/overlap visibility, re-entry, theme switch, loading-to-ready, manga, and ordinary images.
- [ ] Obtain user acceptance on cold-start top rendering.

## Phase 7: Integrate Bottom

- [ ] Reuse the sample/classification state only.
- [ ] Keep bottom sampling above the toolbar and exclude controls/page counter.
- [ ] Verify novel reader, comic continuous/paged modes, safe area, and direction changes.
- [ ] Obtain separate user acceptance on cold-start bottom rendering.

## Phase 8: Quality Gate

- [x] Mobile TypeScript.
- [x] Luma/classification tests.
- [x] Reader tests.
- [x] Package boundaries.
- [x] `git diff --check`.
- [x] `NovellaUi` Debug and Release simulator builds.
- [x] Full `Novella` Release simulator build.
- [ ] Fresh install, terminate, cold-launch final pass.
- [ ] Read-only runtime proof: system effect hidden, app overlay visible only when owned, no effect ancestor alpha below `1`.
- [ ] Commit locally in scoped commits; do not push.

## Phase 9: Static-Only Apple Control-Flow Recovery

This supersedes the simulator-based discovery steps for all remaining work.

- [x] Locate the installed iOS 26.5 `UIKitCore` Mach-O and restrict analysis to offline tools.
- [x] Recover the private `PocketBlur` filter selection and input flags.
- [x] Recover `LuminanceAdjustment` initial visual/state values and backdrop configuration.
- [x] Recover the filtered-luma EMA, settle delay, content-style comparisons, replay hysteresis, alpha branches, and animation duration.
- [x] Verify the `0.7`/`0.4` branch direction through the Mach-O bind table rather than a runtime capture.
- [x] Obtain the user's explicit choice to implement a bounded public-API approximation rather than claim private-backdrop pixel parity.
- [x] Reject and remove the source-luma-derived neutral replay candidate after user evidence showed a gray, foggy overlay with no local-background fidelity.
- [x] Connect focused top/bottom public luma sampling only to suppress dark semantic replay for Light content under dark appearance; preserve the full-alpha BlurView and the accepted dark-content static replay.
- [ ] Obtain user visual acceptance of this subtractive public fallback. Exact private-backdrop pixel parity remains impossible under the production constraints.

## Stop Conditions

Stop and return to analysis instead of stacking another fix when any of these occurs:

- Cold install differs from reload.
- `UIVisualEffectView` animator is inactive when the design depends on partial completion.
- A candidate requires effect/ancestor alpha below `1`.
- Mean luma and Apple content style disagree on manga or flat bright gray.
- A renderer change simultaneously changes mask, blur source, replay, and dimming.
- The user-positioned frame is lost and cannot be compared without scrolling.

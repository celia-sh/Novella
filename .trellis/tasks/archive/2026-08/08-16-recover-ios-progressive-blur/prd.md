# Recover iOS progressive blur rendering

## Goal

Recover the user-confirmed RN progressive blur appearance, add content-driven top and bottom adaptation without corrupting the blur, and preserve the later navigation, scroll ownership, research, luma-sensor, reader, settings, and theme work already present on `[BRANCH]`.

## Confirmed Baseline

- User acceptance time: approximately 2026-08-15 15:20 +0800.
- The user-provided short identifier `[COMMIT]` is not resolvable in the current object database. Git reflog shows `HEAD = [COMMIT]` from 12:40 until `[COMMIT]` at 16:30.
- The progressive renderer files are byte-equivalent across `[COMMIT]`, `[COMMIT]`, `[COMMIT]`, and `[COMMIT]`.
- That renderer used RN composition with `MaskedView`, `expo-blur` `BlurView`, a fixed semantic replay layer, and top additional dimming. Its blur appearance was user-confirmed; it did not adapt correctly to underlying content.
- Recovery must use this renderer state as a visual baseline, not reset the branch or discard unrelated later work.

## Requirements

### R1. Preserve Branch Work

- Do not reset, rebase away, or wholesale revert commits after the baseline.
- Preserve scroll ownership, edge suppression, stable screen scaffolds, development research surface, public luma sensor, reader bottom ownership, theme handling, tests, and unrelated mobile work.
- Restore or replace only the rendering and classification behavior proven defective.

### R2. Keep the Production Effect App-Owned

- The production top and bottom effects remain app-owned RN compositions.
- Apple system `.soft` stays hidden and is used only as a development/runtime reference.
- `expo-blur` is allowed and expected to contain a public UIKit `UIVisualEffectView` internally. This does not make the system `.soft` effect active.
- Do not add an app-owned native blur view or private compositor implementation as part of recovery.

### R3. Separate Numeric Luma From Content Style

- Mean sampled luma remains a bounded public signal for EMA, settle behavior, and numeric hysteresis.
- Mean luma must not be treated as Apple's content-resolved `UIUserInterfaceStyle`.
- The existing `DARK_HIGH_ENTER_LUMA = 0.9` approximation is disproven for black-on-white manga: Apple selected content style Light and replay `0.30` at sampled luma `24/31`, while RN selected replay `0.60` at `25/31`.
- Extend the existing `32 x 4` sample with a bounded distribution feature such as median/high-percentile luma and bright-pixel coverage. Derive an explicit public `resolvedContentStyle` approximation from that distribution.
- The dark `0.30` branch is selected by resolved light content style, not by a single mean-luma threshold.

### R4. Preserve Blur Rendering

- Dynamic adaptation must not change blur mask geometry, effect height, or blur visibility unless an isolated cold-start experiment has proven the replacement.
- Never set alpha below `1` on `UIVisualEffectView` or any ancestor. Apple documents that this can render the effect incorrectly or make it disappear.
- Never rely on an unverified `UIViewPropertyAnimator.fractionComplete` sequence for blur intensity. Both Expo's implementation and the attempted local wrapper remained `inactive` after cold start on iOS 26.5.
- Never represent Apple's `CABackdropLayer` background replay as a theme-resolved solid black or white layer and claim parity. In dark trait, the current semantic layer resolves to black and produced the reported gray/black bands.

### R5. Top And Bottom Are Separate Acceptance Surfaces

- Top navigation and reader bottom chrome may reuse sensor/state primitives, but each needs independent sampling geometry, runtime evidence, screenshots, and cold-start acceptance.
- Bottom controls, page counters, safe-area geometry, and toolbar content must remain excluded from the bottom content sample.

### R6. Verification Must Be Runtime-First

- TypeScript, unit tests, lint/boundaries, and Xcode builds are necessary but not sufficient.
- Every renderer candidate must be rebuilt into a native client, installed, force-terminated, and cold-launched before visual judgment.
- Do not use Metro reload, a process modified by LLDB, or an animator inspected only before reinstall as acceptance evidence.
- The user positions target manga/content. Automation must not scroll the reader after that point.

## Non-Goals

- Shipping Apple private classes, KVC, `CAFilter`, portal mutation, or private selectors.
- Claiming pixel-perfect reproduction of Apple's private spatial `variableBlur`.
- Replacing `expo-blur` with a new native renderer before a separate design decision and isolated proof.
- Changing reader virtualization, adding JS `onScroll`, or changing navigation ownership.

## Acceptance Criteria

- [ ] Failed uncommitted native-wrapper experiment is removed without reverting unrelated user work.
- [ ] Confirmed baseline blur appearance is reproduced after native-client reinstall and cold launch.
- [ ] System top and bottom scroll-edge effects remain hidden while app overlays remain correctly owned.
- [ ] Black, middle gray, flat bright gray, pure white, black-on-white manga, ordinary image, WebView/Readium, and theme transitions have recorded expected classifications.
- [ ] Black-on-white manga in dark app trait resolves to the public light-content branch matching Apple's observed replay family; flat bright gray does not incorrectly use the manga/white branch.
- [ ] No solid theme color is presented as backdrop replay parity.
- [ ] No `UIVisualEffectView` or ancestor has alpha below `1`.
- [ ] No production private API or custom native blur wrapper is present.
- [ ] Top and bottom cold-start screenshots are accepted independently.
- [ ] Mobile TypeScript, luma tests, reader tests, package boundaries, `git diff --check`, `NovellaUi` Debug/Release, and full `Novella` Release build pass.
- [ ] Final changes are committed locally only and are not pushed without explicit user instruction.

## Evidence Policy

The archived Apple research remains the source for private runtime behavior. This task owns production recovery evidence and must record every cold-start candidate, runtime hierarchy, classification output, screenshot path, and rejection reason in `research/incident-and-baseline.md` before implementation is declared complete.

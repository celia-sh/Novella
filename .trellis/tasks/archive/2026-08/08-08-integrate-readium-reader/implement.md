# Readium Reader Implementation Plan

## 1. Establish Pure Contracts

- Add JSON-safe reader view, locator, preference, event, and error types under the local Expo module.
- Add pure preference normalization and locator mapping helpers in the appropriate mobile/shared reader boundary.
- Extend reader unit tests for locator fragment, text fallback, progression fallback, and preference normalization.

Validation:

```bash
npm run typecheck --workspace @novella/mobile
npm run test:reader --workspace @novella/mobile
```

## 2. Build Progressive Publication Resources

- Add publication identity and revision calculation.
- Generate container, OPF, navigation, stylesheet, and deterministic chapter XHTML.
- Materialize only the target chapter and required font before ready.
- Reuse completed chapter preloads for future XHTML resources.
- Keep optional image prefetch independent from chapter readiness.
- Add atomic write, stale revision cleanup, and corrupt cache recovery.
- Add tests for stable chapter hrefs, block IDs, WOFF2 declarations, partial availability, and no all-images gate.

Rollback point: publication services are unused by the screen and can be reverted without affecting the current reader.

## 3. Add Android Native Adapter

- Create the local Expo module Android library.
- Add pinned Readium shared, streamer, and navigator Maven dependencies.
- Open the local publication and host the navigator fragment inside the Expo view.
- Map unified preferences and locator events.
- Implement commands, readiness, structured errors, links/footnotes, and cleanup.
- Compile against the existing Expo/RN Android toolchain without changing host Kotlin/AGP major versions.

Validation:

```bash
cd apps/mobile/android && ./gradlew :app:compileDebugKotlin
```

Rollback point: module remains unreferenced by the reader screen.

## 4. Add iOS Native Adapter

- Create the local Expo module pod and Swift implementation.
- Add pinned Readium shared, streamer, and navigator dependencies.
- Open the same local publication and host the EPUB navigator controller inside the Expo view.
- Map the identical preferences, locator events, commands, link events, errors, and teardown semantics.
- Add the local HTTP adapter only if required by actual navigator resource serving.

Validation:

```bash
cd apps/mobile/ios && pod install
xcodebuild -workspace Novella.xcworkspace -scheme Novella -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

Rollback point: module remains unreferenced by the reader screen.

## 5. Replace Only The Content Renderer

- Preserve the existing reader screen composition and top/bottom chrome.
- Replace only the current WebView content-region component with `NovellaReadiumView`.
- Preserve the existing chapter navigation sheet, footnote session/sheet, image preview surface, theme resolution, lifecycle save, progress staging, and synchronization services.
- Add a hook/coordinator that prepares the minimum publication opening set.
- Gate readiness on target chapter and required font only.
- Connect `readerPreloadWindow` to background chapter materialization and optional image prefetch.
- Connect current settings to unified preferences.
- Connect native locators to existing progress staging and synchronization.
- Restore server positions through deterministic block fragments.
- Connect footnote/link and image preview events.
- Use Readium native safe-area/content-inset handling for toolbar avoidance; do not recreate toolbar UI or duplicate screen chrome inside publication XHTML.
- Keep the previous renderer behind an internal implementation switch during validation.

Validation:

```bash
npm run typecheck --workspace @novella/mobile
npm run test:reader --workspace @novella/mobile
npm run check:boundaries
```

## 6. Cross-Platform Verification

Automated:

- Mobile and workspace type checks.
- Reader unit/contract tests.
- Package-boundary checks.
- Android native compile/build.
- iOS CocoaPods resolution and simulator build.
- Search all changed production files for prohibited research-source names/content.

Manual user acceptance:

- Open a font-obfuscated book on iOS and Android and confirm no transient garbled text.
- Confirm current chapter appears before future chapters and images finish downloading.
- Verify preload values 0, 1, and 3.
- Navigate across chapter boundaries while future content is uncached.
- Change font size, line height, margin, indentation, theme, and paged/scroll mode while retaining the existing settings UI.
- Confirm the existing top/bottom chrome does not occlude content and that Readium safe-area/content insets are applied.
- Exit and reopen at several positions; verify server-compatible restoration.
- Exercise footnotes and image preview behavior.

## Commit Boundaries

Use separate commits for:

1. publication and locator contracts/tests,
2. progressive publication cache,
3. Android native module,
4. iOS native module,
5. reader screen integration,
6. old reader cleanup after acceptance.

Do not combine unrelated future work on `mobile-development` into these commits.

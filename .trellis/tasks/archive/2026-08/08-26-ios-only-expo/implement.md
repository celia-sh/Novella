# iOS-only Expo implementation plan

Implementation starts only after the user reviews and approves this plan. Work remains on `[BRANCH]`.

## Phase 0 — Freeze the iOS baseline

- [ ] Confirm the branch is based on `main` and the worktree is clean.
- [ ] Run the current workspace checks and capture the current public Expo config:
  - `npm run check`
  - `npm run test:client`
  - `npm run test:reader`
  - `cd apps/mobile && npx expo config --type public --json`
- [ ] Run an iOS-only baseline export/prebuild if the local toolchain is available, without committing generated output:
  - `cd apps/mobile && npx expo export --platform ios --output-dir $TMPDIR/novella-ios-only-baseline`
  - `cd apps/mobile && npx expo prebuild --no-install --platform ios`
- [ ] Record the existing iOS visual/manual acceptance checklist before changing source: tabs, large titles/toolbars, form sheets, settings, shelf, community, search, comic reader, novel Readium reader, progress, footnotes, image preview/save/share, theme/OLED appearance, localization, and loading/error states.

## Phase 1 — Remove Android from Expo configuration and native source

- [ ] Set `platforms` to `['ios']` and remove Android app-config/localization/splash/icon/signing/desugaring entries while preserving all current iOS values.
- [ ] Rename/rewrite the combined splash config plugin as an iOS-only plugin, retaining storyboard/image-set tint output; update the plugin list.
- [ ] Change `novella-ui/expo-module.config.json` to iOS-only and keep `NovellaUiModule` registration.
- [ ] Delete `apps/mobile/modules/novella-ui/android/` and all Android-only drawable/Kotlin sources.
- [ ] Delete Android config plugins and tests:
  - `plugins/with-android-signing.ts`
  - `plugins/with-android-signing.test.mjs`
  - `plugins/with-android-desugaring.ts`
- [ ] Remove root/mobile Android scripts and update `validate.yml` so it no longer invokes the deleted plugin test; retain meaningful iOS/config validation.
- [ ] Delete Android launcher assets and remove only the Android localization payload from `locales/zh-CN.json` / `locales/zh-TW.json`.
- [ ] Remove Android-only ignore rules and stale generated `the generated local Android project/` locally after confirming no tracked files depend on them. Keep iOS/provisioning/secret ignore rules that remain relevant.

## Phase 2 — Make iOS implementations canonical

- [ ] Promote current `.ios.tsx` implementations to canonical base files without changing their UI or props:
  - navigation: book comments, book detail, community, discover, history, shelf, settings root, reader navigation/chapter navigation;
  - controls: grouped list platform, icon, picker, search controls, segmented control, slider, screen scaffold, reader progress bar, reader background-color settings;
  - modules/hooks/services: `native-search-bar`, `native-segmented-control`, `novella-readium-view`, platform app colors, native reader image rasterizer.
- [ ] Remove the corresponding `.ios.tsx` files after import resolution is checked.
- [ ] Delete every Android platform source file under `apps/mobile/src` and `apps/mobile/modules` after verifying the promoted canonical file is the former iOS implementation.
- [ ] Remove unused Android-only module exports and types (`BlurHash`, Compose bottom sheet/top app bar/bottom app bar/selection menu) and any unreferenced `LightAppearanceScope` only if the final import audit proves it is dead.
- [ ] Keep `NativeRouteBottomSheet` as the iOS route-content wrapper used by existing form-sheet routes; remove only its Android implementation.
- [ ] Remove the no-op `NativeAlertHost` mount/implementation while preserving `showAlert` backed by React Native `Alert`.
- [ ] Keep `@expo/ui` and active iOS SwiftUI/native controls. Do not remove `react-native-webview`, which remains required by the iOS footnote sheet.

## Phase 3 — Delete dual-platform branches while preserving iOS output

- [ ] Simplify root/tab/settings layouts to the current iOS header, toolbar, and `formSheet` options.
- [ ] Simplify `BookDetailScreen` to its current iOS anchored backdrop, bouncing transparent scroll surface, and iOS navigation.
- [ ] Simplify `ReaderScreen` to the Readium/iOS path, preserving all locator mapping, visible progression, publication readiness, fonts, footnotes, images, chrome insets, and error/loading behavior.
- [ ] Simplify theme/settings flow: remove `useSystemColor`, remove Android appearance controls/translations/icons, preserve current iOS OLED book-detail behavior as an explicit internal decision, and remove the Android-only `isOledDark`/Material branches.
- [ ] Keep old persisted settings JSON tolerant by ignoring removed fields; add/adjust a unit test for this behavior.
- [ ] Remove Android-only list props, keyboard branches, sheet transparency/padding branches, image permission/storage branches, search menu fields, and Android comments from the remaining canonical files.
- [ ] Keep the iOS `createReaderChromeInsets` behavior and `44`-point toolbar/safe-area calculations while removing the platform argument/Android branch only if all call sites/tests are updated equivalently.
- [ ] Remove the unused legacy `ReaderWebView` wrapper after import verification. Keep the Readium-required XHTML href/base64 helpers, removing obsolete browser-column builder options/tests or moving surviving helpers to a focused file.
- [ ] Remove the unsupported-reader localization message and any now-unreachable fallback code.
- [ ] Run a scoped search over `apps/mobile` for `android`, `Android`, `gradle`, `kotlin`, `jetpack`, `EXPO_OS`, `Platform.OS`, and platform-suffixed files; classify legitimate iOS availability comments versus leftovers and clean all Expo leftovers.

## Phase 4 — Update website and current documentation

- [ ] Remove the Android download card, Android current-platform fallback, and Android-specific card CSS from `apps/site/src/app.tsx` / `styles.css`.
- [ ] Keep historical release-asset classification only if required by the site data shape; ensure no current site UI advertises Android.
- [ ] Update `README.md` and `CONTRIBUTING.md` to describe an Expo iOS-only app, iOS commands, iOS CNG/prebuild, and iOS-only QA. Remove Android Compose/icon/command instructions.
- [ ] Update `.github/ISSUE_TEMPLATE/bug_report.md` OS examples and any current release wording to avoid promising Android.
- [ ] Leave `[BRANCH]`, historical task records, and old release metadata untouched unless a current surface explicitly displays them.

## Phase 5 — Regenerate and verify the clean iOS project

- [ ] Remove the local ignored Android generation directory: `rm -rf apps/mobile/android`.
- [ ] Generate only iOS from a clean state:
  - `cd apps/mobile && npx expo prebuild --clean --no-install --platform ios`
  - `cd apps/mobile && npx pod-install ios`
- [ ] Inspect `npx expo config --type public --json` and generated iOS module/autolinking output for only iOS platform registration and expected Readium/Novella UI pods.
- [ ] Run the iOS bundle export:
  - `cd apps/mobile && npx expo export --platform ios --output-dir $TMPDIR/novella-ios-only-export`
- [ ] Run automated checks from the repository root:
  - `npm run check`
  - `npm run test:client`
  - `npm run test:reader`
  - `npm run test:localization --workspace @novella/mobile`
  - `git diff --check`
- [ ] If Xcode/CocoaPods are available, run the same unsigned iOS build used by CI and confirm `Novella.app` is produced.
- [ ] Build the site and confirm the download page contains the iOS/latest-release/sideload flows without an Android card:
  - `npm run build --workspace @novella/site`

## Phase 6 — Review and user acceptance

- [ ] Review the diff against the PRD/design and verify that all promoted iOS files match their pre-change iOS behavior.
- [ ] Re-run the repository search and dependency/import audit; no Android implementation or dual-platform Expo architecture should remain.
- [ ] Hand the user the iOS-only manual checklist and record any simulator/device results. The user owns visual/interaction acceptance; no Android smoke test is required.
- [ ] Only after all checks pass, update task artifacts with evidence, run the Trellis quality/finish flow, and commit the implementation on `[BRANCH]`.

## Implementation evidence (2026-08-26)

- Baseline passed before edits: `npm run check`, `npm run test:client`,
  `npm run test:reader`, mobile localization tests, iOS export, and iOS
  prebuild. See `research/baseline.md`.
- App config now resolves to `platforms: ['ios']` with no `android` config or
  Android permission injection. The stock `expo-media-library` config plugin
  was removed because it adds Android permissions even for an iOS-only config;
  `NSPhotoLibraryAddUsageDescription` remains in `ios.infoPlist` and localized
  metadata.
- Android native module/build/CI/plugin/assets/source surfaces were deleted.
  Existing iOS implementations were promoted to canonical files; no
  `*.android.*`, `*.ios.*`, or `*.web.*` files remain under `apps/mobile/src`
  or `apps/mobile/modules`.
- Removed settings compatibility is recorded in
  `.trellis/spec/frontend/state-management.md`. The pure decoder ignores old
  `useSystemColor`/`oledBlack` fields, preserves valid settings, and tests prove
  those keys do not re-enter the normalized snapshot.
- Automated checks passed after cleanup: workspace `npm run check`, client and
  reader test suites, localization tests, mobile settings/theme tests, final
  iOS export, site build, clean iOS prebuild, CocoaPods install, and an
  unsigned Release Xcode build. Built artifact:
  `$TMPDIR/novella-ios-only-derived/Build/Products/Release-iphoneos/Novella.app`.
- Remaining acceptance is user-owned iOS simulator/device interaction review;
  no Android smoke test or web export acceptance is required.

## Risky files and rollback points

- `apps/mobile/app.config.ts` and the splash plugin: can break clean iOS prebuild or splash appearance. Roll back this phase independently.
- `apps/mobile/modules/novella-ui/index.ts`, module config, and canonicalized iOS component files: can break Swift native registration or TypeScript resolution. Restore the original `.ios` file contents if needed.
- `apps/mobile/src/app/_layout.tsx`, `reader-screen.tsx`, `book-detail-screen.tsx`, `settings.ts`, and `app-theme.tsx`: behavior-sensitive. Compare iOS branches before/after and avoid unrelated formatting/UI changes.
- `package.json`/`package-lock.json`: use npm commands for dependency changes; never hand-edit lockfile entries.
- `apps/site/src/app.tsx`: keep website cleanup isolated so it can be reverted without reverting native iOS cleanup.

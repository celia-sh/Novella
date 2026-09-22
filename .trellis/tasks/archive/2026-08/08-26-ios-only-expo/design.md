# iOS-only Expo removal design

## Scope and boundaries

- `apps/mobile` becomes a native iOS-only Expo application. Its app config, local modules, source tree, commands, and native generation path must no longer model Android or Web as supported platforms.
- `apps/site` remains a separate web application, but its current download surface presents only the iOS app. The release-data fetcher may retain a generic Android platform value so historical GitHub release metadata is not corrupted or discarded unless a later product decision requires removal.
- `packages/*`, server/API contracts, `[BRANCH]`, and historical Trellis task records are outside the product migration and remain unchanged except for references that are part of current contributor/release documentation.
- Generated `the generated local iOS project/` and `the generated local Android project/` directories remain ignored. The tracked source of truth is app config, config plugins, Expo modules, and TypeScript/Swift source.

## Invariants for the current iOS product

The removal is a platform-topology change, not a UI redesign. The existing iOS implementation is the source of truth and should be moved/promoted mechanically before any cleanup:

- Keep iOS NativeTabs, Stack headers/toolbars, form sheets, Liquid Glass/title behavior, safe-area handling, and current loading/error surfaces.
- Keep the iOS Readium Swift Toolkit 3.11.0 navigator and its bridge contract, publication/cache generation, locator mapping, visible viewport progression, fonts, XHTML normalization, footnotes, images, gestures, and `SaveReadPosition { bookId, chapterId, position }` behavior.
- Keep the iOS comic reader behavior, reader progress controls, image preview filtering, native top soft edge effect (`scrollEdgeEffects.top: 'soft'`), and existing `createReaderChromeInsets` values.
- Keep iOS native module names and props/events stable. Removing the unused Android registration must not change Swift module names, pod dependencies, or JavaScript event payloads.
- When a platform-specific iOS file is promoted to its canonical filename, preserve its JSX, styles, props, and event behavior. Only remove the alternate implementation and platform selector; do not use the promotion as an opportunity to redesign the iOS UI.

## Target architecture

### 1. App configuration and generation

Update `apps/mobile/app.config.ts` to:

- declare `platforms: ['ios']`;
- retain the existing iOS bundle identifier, build number, tablet support, localization, icon, status-bar policy, Readium pods, ccache, and iOS splash behavior;
- remove Android localization, Android splash options, Android signing/desugaring plugins, and the entire `android` config block;
- keep `expo-media-library` as an iOS native dependency and declare only its add-only/save permission in `ios.infoPlist`; do not register its stock config plugin because that plugin also injects Android permissions even when `platforms` is iOS-only;
- keep `expo-dev-client`, `expo-build-properties`, `expo-router`, and the iOS splash/config plugins.

Split the combined `with-adaptive-splash-logo` plugin into an iOS-only canonical plugin (renaming the file to make its responsibility clear if that does not disturb Expo plugin resolution). Retain its storyboard/image-set tint behavior exactly; remove Android imports, resource generation, and Android-only constants.

Change `apps/mobile/modules/novella-ui/expo-module.config.json` to register only `ios` and `NovellaUiModule`. Keep `apps/mobile/modules/novella-readium/expo-module.config.json` as the existing iOS-only registration.

### 2. Native module pruning

Delete the tracked `apps/mobile/modules/novella-ui/android/` tree and all Android drawable resources. Delete the Android TypeScript module implementations and remove their exports from `modules/novella-ui/index.ts`.

Retain only the iOS Swift module and the native controls that have current iOS consumers:

- `SearchBar`
- `SegmentedControl`
- `ReaderProgressBar`
- `ReaderImageRasterizer` if its current consumer audit still requires it

Promote the current iOS TypeScript implementations of `native-search-bar` and `native-segmented-control` to the canonical files, removing their no-op/base or Jetpack-only alternatives. Remove module components that were only consumed by Android (`NativeBlurHash`, `NativeBottomSheet`, `NativeSelectionMenu`, `NativeTopAppBarScaffold`, `NativeBottomAppBar`) after confirming the import graph. Remove `NativeLightAppearanceScope` only if the final reference audit confirms it has no app consumer; otherwise promote its current iOS implementation unchanged.

Do not remove `@expo/ui`: iOS still uses `@expo/ui/swift-ui`, `Host`, and `RNHostView`. Do not remove `react-native-webview`: the footnote sheet still uses it on iOS. Any dependency deletion must follow a fresh import/config/native-autolinking audit and be performed through npm, never by hand-editing `package-lock.json`.

### 3. Canonical iOS application source

For each family with a current `.ios` implementation, promote the iOS file to the base filename and delete the Android variant and obsolete fallback where it is no longer needed. The affected families include:

- navigation: book comments, book detail, community, discover, history, shelf, settings root, reader navigation, reader chapter navigation;
- native controls: grouped list platform, icon, picker, search controls, segmented control, slider, screen scaffold, reader progress bar, reader background-color settings;
- hooks/services: platform app colors and native reader image rasterizer;
- Readium view: promote `novella-readium-view.ios.tsx` over the no-op `novella-readium-view.tsx`.

Where a base file contains only a no-op Web/Android fallback, replace it with the existing iOS implementation rather than leaving a fallback. Move shared type definitions to dedicated `.types.ts` files or keep them in the canonical file as needed to avoid self-imports and preserve TypeScript strictness.

Delete all `*.android.tsx`/`*.android.ts` files in `apps/mobile/src` and `apps/mobile/modules` after the promotion/import audit. Do not delete iOS-only files that have no base counterpart until their imports are updated deliberately.

### 4. Remove runtime dual-platform branches without changing iOS output

Simplify only branches whose iOS arm is already known:

- Root stack and all tab/settings stack layouts: keep the current iOS large-title/header and `formSheet` options; remove Compose/transparent-modal alternatives and `usesComposeBottomSheets`/`isAndroid` variables.
- Book detail: always use the iOS anchored hero backdrop, transparent/bouncing scroll view, and iOS navigation component; remove the Android collapsible-app-bar branch.
- Novel reader: always use Readium, the iOS reader background/text-color path, iOS chrome insets, and current iOS toolbar/progress behavior; remove the unsupported-reader state and Android color path. Preserve all Readium lifecycle/locator mapping code.
- Reader and content sheets: retain the existing iOS palette, padding, native form-sheet presentation, WebView footnote rendering, and chapter list behavior; remove Android transparency, nested-scroll, and padding branches.
- Lists: remove Android-only `nestedScrollEnabled`/`removeClippedSubviews` props and comments; do not otherwise alter list data, keys, pagination, or rendering.
- Auth and community forms: retain the current iOS keyboard-avoidance settings directly and remove platform conditionals.
- Image handling: keep iOS `Asset.create` and `Sharing` behavior; remove Android permission/MediaStore/URI-cleanup branches while preserving errors and cleanup timing relevant to iOS.
- Search: remove Android menu icon fields and use the current iOS toolbar menu/icon values as the canonical option shape.
- Alerts: retain `showAlert` backed by React Native `Alert`; remove the Android `NativeAlertHost` implementation and the no-op host mount if no iOS behavior depends on it.
- Remove stale comments mentioning Android/Web from the remaining Expo source. Legitimate iOS availability checks such as `#available(iOS ...)` remain.

The old unused `ReaderWebView` wrapper should be removed only after confirming it has no import. Preserve the surviving XHTML helpers needed by Readium (`chapterHrefFor`, base64 conversion), either in place with obsolete browser-builder options/tests removed or in a clearly named minimal helper. The iOS footnote WebView is a separate, active path and must remain.

### 5. iOS settings compatibility

- Remove `useSystemColor` and `oledBlack` from the public `AppSettings` type, defaults, UI, and active persisted theme flow.
- Remove the Android-only appearance rows and their unused translation/icon entries.
- Preserve current iOS OLED appearance using explicit behavior in the book-detail/theme path: dark iOS uses the internal `oledBlack` color profile, independent of persisted settings. The profile may remain as an internal theme concept but must not remain an Android-configurable or persisted setting.
- Keep settings decoding tolerant through a React-free allowlisted decoder: start from known defaults, validate known fields, ignore unknown legacy keys, and keep the `novella.settings.v1` key. Add a regression test proving old `useSystemColor`/`oledBlack` keys do not break decoding, do not overwrite valid current fields, and do not reappear in the public snapshot or the next serialized write.
- Remove `resolveReaderColors` and its Android-only tests only if no surviving iOS consumer remains; preserve `resolveAppColorScheme` and all active reader/theme helpers.

### 6. Website, docs, scripts, and release surface

- Delete `.github/workflows/build_android_apk.yml` and remove root/mobile Android commands and Android-only plugin tests.
- Keep `.github/workflows/build_ios_ipa.yml`, adjust stale Android-parity wording, and retain its clean iOS prebuild, CocoaPods, Xcode, IPA packaging, and version checks.
- Update `README.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.trellis/spec/frontend/directory-structure.md` if it is maintained in the working tree, and any current release guidance to state iOS-only support and iOS commands.
- Update the site download page to remove the Android card and current Android platform pill/fallback while preserving the iOS card and latest-release/sideload flows. Keep `fetch-site-data`'s generic platform classification only if it is still needed for historical asset data; do not show Android as an available current platform.
- Remove Android-specific icon assets and Android entries from Expo localization JSON. Keep iOS `CFBundleDisplayName` and permission strings unchanged; preserve `NSPhotoLibraryAddUsageDescription` through the iOS config/localized metadata without reintroducing the Android media-library plugin.
- Keep generated native directories ignored; do not add generated `ios/` or `android/` output to Git.

## Data and dependency flow

```text
app.config.ts (ios only)
  ├─ iOS Config Plugins ──> generated ios/
  ├─ novella-readium module config ──> NovellaReadiumModule / Readium pods
  └─ novella-ui module config ──> NovellaUiModule / UIKit + SwiftUI controls

canonical iOS TypeScript screens/components
  ├─ existing package contracts and persistence services
  ├─ NovellaReadiumView ──> Swift Readium navigator/events
  └─ existing iOS navigation/chrome/sheet controls
```

No API or persistence payload changes are planned. The only settings change is removal of obsolete Android controls with tolerant decoding of old local JSON. No raw Readium locator is persisted.

## Risk controls and rollback

- Before editing, capture a clean iOS export/prebuild baseline and run the current automated checks. Record the current iOS config, pod/module names, and key iOS source files as the behavior baseline.
- Perform source-file promotion before deleting old files; compare the promoted files against their `.ios` originals and avoid simultaneous UI refactors.
- Delete Android native/config files only after import and plugin resolution searches are clean.
- Use `npx expo prebuild --clean --platform ios` only after config/plugin changes are complete. Remove the stale local ignored `the generated local Android project/` directory separately; the generated directory is not a source change.
- If the iOS build or manual smoke test regresses, restore the affected canonical file from its original `.ios` implementation or revert the specific cleanup commit. Do not restore Android support to solve an iOS regression.
- Keep site cleanup separable from native cleanup so a release-page regression can be reverted without touching the iOS app.

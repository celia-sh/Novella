# Expo iOS-only and Android-removal audit

Date: 2026-08-26
Baseline: `main` at `[COMMIT]`
Branch: `[BRANCH]`

## Official Expo / React Native guidance consulted

### Expo app config

Source: <https://docs.expo.dev/versions/latest/config/app/>

- The app-config `platforms` array declares the platforms the project explicitly supports.
- When omitted, Expo defaults to `['ios', 'android']` (and may include web when `react-dom` is installed).
- Therefore the product-level setting for this app should be explicit `platforms: ['ios']`; this is separate from native-module registration and from platform-specific source resolution.

### Expo module registration

Source: <https://docs.expo.dev/modules/module-config/>

- `expo-module.config.json` has its own `platforms` array and supports granular `ios`/`android` entries (or `apple` for Apple platforms).
- Autolinking/module registration is controlled here, so the remaining `novella-ui` module should register only its iOS Swift module. The existing Readium module already demonstrates the intended iOS-only shape.
- App-config platform support and module-config platform support are related but not interchangeable; both must be audited.

### Config plugins and mods

Source: <https://docs.expo.dev/config-plugins/mods/>

- Config plugins modify native projects during prebuild and use platform-specific mods such as `withInfoPlist` (iOS) and `withAndroidManifest` (Android).
- The adaptive splash plugin currently combines iOS and Android mods. Its iOS behavior should be retained while Android resource generation/imports are removed.
- The Android signing and desugaring plugins have no iOS role and should be deleted with their tests and app-config registrations.

### Continuous Native Generation / prebuild

Source: <https://docs.expo.dev/workflow/continuous-native-generation/>

- Prebuild supports individual platforms with `npx expo prebuild --platform ios`.
- Expo describes native directories as generated output in the CNG workflow; the repository already ignores `the generated local iOS project/` and `the generated local Android project/`.
- A platform-specific prebuild should be used after the config change. Because ignored generated directories can remain locally, the implementation plan must include removing/regenerating the stale local Android directory and checking that a clean iOS generation is self-contained.

### Store builds

Source: <https://docs.expo.dev/deploy/build-project/>

- Expo documents `eas build --platform ios` for an iOS-only store build.
- Novella currently uses a direct Xcode CI workflow rather than EAS Build; the workflow can remain iOS-only, but comments and any future release instructions must not imply Android parity.

### SDK plugin options used by this project

Sources:

- <https://docs.expo.dev/versions/latest/sdk/localization/>
- <https://docs.expo.dev/versions/latest/sdk/splash-screen/>
- <https://docs.expo.dev/versions/latest/sdk/media-library/>

- `expo-localization` configuration is applied through its config plugin in CNG; the project should retain only the iOS supported-locale configuration.
- `expo-splash-screen` supports common image/background/dark-mode options plus platform-specific `android` and `ios` option objects. Removing the Android object while keeping the common/iOS values is the correct narrow change.
- `expo-media-library` documents `writeOnly`/add-only access for saving. Its `granularPermissions` argument and corresponding config are Android 13-specific; the iOS save path should call the existing write-only request without Android granular arguments and keep `NSPhotoLibraryAddUsageDescription`.
- The installed `expo-media-library` config plugin always registers an Android permission mod; with `platforms: ['ios']`, `npx expo config --type public --json` still reported Android media permissions when the plugin was present. Therefore the iOS-only app declares `NSPhotoLibraryAddUsageDescription` directly in `ios.infoPlist` and does not register the stock media-library plugin. This preserves the iOS permission contract without exposing Android configuration.

### React Native platform-specific code

Source: <https://reactnative.dev/docs/platform-specific-code>

- Metro resolves platform-specific filenames such as `.ios.tsx` and `.android.tsx`.
- `Platform.OS`/`Platform.select` are appropriate for small differences, while separate files are appropriate for larger platform differences.
- After Android removal, Android-specific files can be deleted. Because this task explicitly requires a clean iOS-only Expo codebase, iOS implementations should be promoted to canonical base files where practical, with no-op Android/Web shims removed rather than preserving a dual-platform abstraction. TypeScript inclusion and default/fallback consumers must be checked before deleting or renaming base files.

## Repository inventory

### Product/config/build surface

- `apps/mobile/app.config.ts`
  - `platforms: ['android', 'ios']`.
  - Android localization, splash image, signing/desugaring plugins, adaptive icon config, package/version code.
  - Shared `with-adaptive-splash-logo` currently invokes both Android and iOS mods.
- `package.json` and `apps/mobile/package.json`
  - Root/mobile `android` scripts.
  - Mobile Android signing plugin test script.
- `.github/workflows/build_android_apk.yml`
  - Unsigned and signed APK generation, Java/Gradle setup, keystore handling, APK verification/upload.
- `.github/workflows/build_ios_ipa.yml`
  - Keep iOS workflow; remove stale comments that describe Android parity if they remain.
- Generated `the generated local Android project/`
  - Ignored and not tracked; local cleanup is still needed after the migration.

### Native module surface

Tracked Android implementation:

- `apps/mobile/modules/novella-ui/android/build.gradle`
- `apps/mobile/modules/novella-ui/android/proguard-rules.pro`
- `apps/mobile/modules/novella-ui/android/src/main/AndroidManifest.xml`
- Kotlin implementations: `BlurHash.kt`, `BottomAppBarContent.kt`, `BottomSheet.kt`, `NovellaUiModule.kt`, `SearchBar.kt`, `SegmentedControl.kt`, `SelectionMenu.kt`, `TopAppBarScaffold.kt`.
- Android drawable resources under `apps/mobile/modules/novella-ui/android/src/main/res/drawable/`.
- `apps/mobile/modules/novella-ui/expo-module.config.json` registers both Android and iOS. Change it to iOS-only and keep `NovellaUiModule`.

Android-specific TypeScript implementations include:

- `apps/mobile/modules/novella-ui/src/native-*.android.tsx` files for BlurHash, bottom sheet, search bar, segmented control, and selection menu.
- `apps/mobile/src/components/*.android.tsx` files for navigation, grouped lists, icons, picker/search/segmented/slider controls, reader navigation, route sheets, and alert host.
- `apps/mobile/src/hooks/use-platform-app-colors.android.ts` and `use-system-theme-seed.android.ts`.
- `apps/mobile/src/screens/reader-settings-sheet-screen.android.tsx`.

Some generic module files are Android-only in practice despite lacking an `.android` suffix (`native-top-app-bar-scaffold.tsx`, `native-bottom-app-bar.tsx`) and are imported only by Android-facing components; verify and remove them rather than leaving unused Jetpack Compose imports.

### Runtime conditional surface

`process.env.EXPO_OS === 'android'` or equivalent behavior occurs in:

- Root stack and tab/stack layouts: Android Compose-hosted headers and transparent modal sheets.
- Book detail: Android collapsible app bar.
- Reader: Android cover-palette/OLED color path and unsupported Readium guard.
- Settings: Android-only system-color/OLED controls.
- Lists/sheets/readers: Android nested-scroll and clipping props, transparent sheet backgrounds, and padding.
- Search: Android menu icon fields and Compose search controls.
- Theme/settings helpers: Android Material/system-color/OLED branches.
- Image and text components: Android-specific permissions/hyphenation or list performance props.

The implementation should not mechanically delete every word `android`: each branch must be classified as (a) delete, (b) replace with the iOS behavior, or (c) retain only as historical metadata.

### Assets/localization/docs

- Delete Android launcher assets: `apps/mobile/assets/android-icon-background.png`, `android-icon-foreground.png`, and `android-icon-monochrome.png`.
- `apps/mobile/locales/zh-CN.json` and `zh-TW.json` contain Android app-name entries; retain iOS localization entries and remove only the unused Android platform payload if the localization plugin accepts the iOS-only shape.
- Update `README.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, and relevant iOS workflow comments.
- Historical Flutter branch and historical Trellis task documents are not current product documentation and should not be rewritten as part of this task.
- `apps/site` currently classifies Android release assets and renders an Android download card. This remains an open product-scope decision in the PRD.

### Dependency observations

- `@expo/ui` is required by the iOS SwiftUI implementation (`@expo/ui/swift-ui`, universal `Host`/`RNHostView`), so it must not be removed just because its Jetpack Compose subpath is Android-only.
- `@gorhom/bottom-sheet`, `@react-native-masked-view/masked-view`, and some Expo packages appear not to have direct source imports in the current mobile app. They should only be removed if a dependency audit confirms they are dead and not required by config plugins, native autolinking, or transitive runtime behavior; this is a cleanup opportunity, not an automatic Android-removal step.
- Android-specific transitive packages in `package-lock.json` should normally disappear only as a consequence of removing direct dependencies/source paths. Do not hand-edit the lockfile.

## Baseline command evidence

- `npx expo config --type public --json` currently reports both platforms, Android app config, Android permissions, and both Android config plugins.
- `npx expo config --type introspect --platform ios` is not a supported CLI invocation in the installed Expo CLI; use `npx expo prebuild --platform ios` for platform-specific generation rather than relying on a nonexistent config flag.
- Current branch was clean before planning, and no tracked `the generated local Android project/` application project exists because it is generated/ignored.

# Make Expo mobile project iOS-only

## Goal

Convert `apps/mobile` from a dual-platform Expo application into an iOS-only Expo application. Remove Android product/build/runtime surface deliberately while preserving the existing iOS application, native Readium reader, comic reader, navigation, persistence contracts, and shared platform-neutral packages.

## Background and confirmed repository facts

- Planning is being done on the new branch `chore/ios-only-expo` from `main` at `7c99781` (`feat(reader): replace Skia novel renderer with Readium iOS (#193)`).
- `apps/mobile/app.config.ts` currently declares `platforms: ['android', 'ios']`, has Android localization/splash/icon/signing configuration, and has an `android` app-config block.
- The Expo project uses Continuous Native Generation. `the generated local iOS project/` and `the generated local Android project/` are generated and ignored; the Android directory is present locally but is not a tracked source artifact. The tracked custom Android implementation lives in `apps/mobile/modules/novella-ui/android/`.
- The iOS Readium module is already registered as iOS-only in `apps/mobile/modules/novella-readium/expo-module.config.json`; its non-iOS TypeScript fallback exists only to keep the former Android bundle safe and can be reconsidered once Android is no longer a target.
- `apps/mobile/modules/novella-ui` still contains a complete Jetpack Compose Android module, Android module registration, Android-only TypeScript implementations, and Android-only drawable assets. Its iOS Swift module and iOS-facing TypeScript implementations must remain functional.
- Android-specific React Native files and conditionals are distributed across navigation, sheets, search, settings, theme, reader, list performance, and image handling. They include Android-only platform files and `process.env.EXPO_OS === 'android'` / `Platform.OS` branches.
- Android build and signing support exists in `.github/workflows/build_android_apk.yml`, `apps/mobile/plugins/with-android-signing.ts`, its test, `apps/mobile/plugins/with-android-desugaring.ts`, and the root/mobile `android` scripts.
- Public documentation currently describes `apps/mobile` as Android+iOS and `CONTRIBUTING.md` contains Android commands, dual-platform CNG guidance, Android Compose/icon conventions, and dual-platform QA requirements.
- The public site currently detects Android release assets and renders an Android download card; the current product surface will become iOS-only while historical release metadata may remain available internally.
- `apps/mobile/package.json` contains direct dependencies that are clearly used by Android-only code (`@expo/ui` remains needed for iOS SwiftUI usage); direct dependency reachability must be rechecked before removing packages rather than deleting transitive Android artifacts blindly.
- Existing persisted settings include fields whose UI/semantics were Android-specific (`useSystemColor`, `oledBlack`), although iOS currently forces/uses some OLED behavior. Any removal must preserve or intentionally migrate existing iOS settings data.

## Initial requirements

- Make the supported Expo app platform explicitly iOS-only and ensure iOS prebuild/build does not require Android configuration or native sources.
- Treat `apps/mobile` as a native iOS product only; Web export is not an acceptance target, and default files are retained only when TypeScript/shared tooling requires them.
- Remove Android native module sources, Android-only local-module registration, Android-only assets, Android config plugins, Android scripts, Android CI, and obsolete Android tests after confirming they have no iOS dependency.
- Clean the Expo source as an iOS-only codebase rather than leaving a dual-platform architecture: remove Android branches and Android fallback files, promote/retain the iOS implementation as the canonical path, and avoid no-op platform shims that exist only to preserve Android or Web resolution.
- Preserve the iOS Readium Swift Toolkit reader and its existing reader behavior and UI exactly, including publication preparation, visible progress mapping, fonts, images, footnotes, navigation, safe-area/chrome insets, image-preview rules, toolbar/header appearance, sheets, and loading states.
- Do not alter any currently working iOS feature, interaction, layout, visual styling, persistence behavior, or native module contract except where removing a dead alternate-platform path requires a mechanically equivalent iOS canonicalization.
- Preserve the comic reader and all shared API/client/reader-engine behavior unless a change is required solely to eliminate an Android presentation path.
- Update project and contributor documentation, release/build documentation, and the current public download surface so they describe the actual supported platform set; stop advertising an Android download while preserving historical release metadata when useful.
- Keep historical Flutter/archive material and historical Trellis task records as historical records; do not rewrite them merely to remove current Android support.
- Remove Android-only settings API/UI (`useSystemColor` in particular), preserve the current iOS OLED appearance through explicit internal behavior, and keep decoding tolerant of old persisted JSON by ignoring removed keys.
- Validate the resulting repository with repository searches, workspace checks, iOS Expo export/prebuild, CocoaPods/native compilation when available, and the existing iOS manual smoke checklist. Android build validation is intentionally not an acceptance requirement after removal.

## Acceptance criteria

- [x] The mobile app config reports only iOS as a supported native platform, and iOS prebuild/introspection contains no Android-only app configuration or plugin execution. `[self-verified]`
- [x] No tracked Android native module, Android-only local-module registration, Android app asset, Android build/signing plugin, Android package script, Android APK workflow, Android-specific source file, Android conditional, or Android-only fallback remains in the Expo app. iOS implementations are canonical rather than one side of a maintained dual-platform pair. `[self-verified]`
- [x] The iOS bundle/export and native build succeed from a clean generated iOS project, with Readium and `novella-ui` iOS native modules registered and linked. `[self-verified]`
- [x] iOS navigation, sheets, settings, theming, search, shelf, community, comic reader, novel reader, image previews, persistence, and localization typecheck and existing automated tests pass without Android fallbacks being required, with current iOS behavior and UI unchanged. `[self-verified]` (visual/device behavior remains user-owned)
- [x] Shared packages remain platform-neutral and no Android-specific dependency or import leaks into the iOS bundle. `[self-verified]`
- [x] README, CONTRIBUTING, CI/release documentation, and any in-scope public download surface no longer claim that the mobile app supports Android. `[self-verified]`
- [x] Generated native directories remain ignored; a clean iOS regeneration does not depend on a stale local Android project. `[self-verified]`
- [x] Existing iOS users' persisted settings are either backward-compatible or covered by an explicit migration/default decision recorded in the design. `[self-verified]`
- [ ] The user accepts the remaining iOS simulator/device smoke checklist; no Android device acceptance is requested. `[user-verified]`

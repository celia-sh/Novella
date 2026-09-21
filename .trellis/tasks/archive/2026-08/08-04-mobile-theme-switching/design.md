# Mobile Theme Switching Design

## Problem Boundary

The persisted `AppSettings.theme` value is not the authoritative appearance source today. Root navigation, native Compose hosts, authentication surfaces, and the novel reader independently call React Native's system `useColorScheme()`. Android ordinary-screen colors are additionally exported as module-level constants from `Color.android.dynamic.*`; Expo Router resolves those Material colors to scheme-specific literal strings at access time, so the values captured during module initialization do not change when the scheme changes.

The repair must unify appearance selection while preserving two palette domains:

1. **Ordinary app routes**
   - iOS: semantic system colors plus the existing system-pink/red accent.
   - Android: Material 3 colors, using wallpaper colors when `useSystemColor` is enabled and the configured seed otherwise.
2. **Book-detail routes and related sheets**
   - Keep the existing `BookDetailThemeProvider` and its optional cover-derived Material override.

## Architecture

### Effective appearance source

Add one app-theme provider at the mobile root. It owns:

- persisted `ThemeMode` from `useAppSettings()`;
- current system appearance from React Native;
- `effectiveColorScheme`, resolved as:
  - `system` -> current system light/dark value;
  - `light` -> light;
  - `dark` -> dark;
- synchronization with Uniwind through `Uniwind.setTheme(settings.theme)` so HeroUI/Uniwind, React Native's native appearance override, and platform UI use the same preference.

All app code that currently needs `useColorScheme()` will consume the provider's effective scheme instead. Direct system-scheme access remains private to the provider.

### Reactive ordinary-route palette

Replace the module-level `colors` singleton with a provider-owned `AppColors` palette.

- iOS palette values remain semantic `Color.ios.*` values and keep the current accent.
- Android palette values are produced reactively from `@expo/ui` Material colors using the effective scheme and the existing system-color/seed preference.
- Components obtain colors through `useAppTheme()`.
- Styles containing theme colors are created through a themed stylesheet hook so a palette change sends new color props to mounted React Native views. Layout-only styles may remain static.

This avoids remounting the navigation tree or resetting route state when appearance changes.

### Navigation and native surfaces

- Convert the static stack preset to a hook derived from the app palette.
- Root React Navigation theme and status-bar style use `effectiveColorScheme`.
- Native `@expo/ui`/Compose `Host` instances use `effectiveColorScheme` rather than the raw system hook.
- Native tabs continue to use the ordinary-route palette.

### Reader

The novel reader consumes `effectiveColorScheme` and a platform-appropriate literal reader palette:

- OLED black applies only when the effective appearance is dark.
- Android reader colors come from the active Material ordinary-route palette.
- iOS reader colors preserve the current system-grouped-background/label visual contract.
- WebView CSS variables continue to update live, so changing appearance does not reload the chapter or lose reading position.
- Reader top/bottom native surfaces receive the same literal colors and effective scheme.

### Book-detail exception

`useBookDetailTheme` will consume the centralized effective scheme instead of resolving `settings.theme` independently. Cover extraction, Material scheme variants, system colors, seed colors, and OLED handling remain owned by the existing book-detail theme implementation.

## Startup and Persistence

Start loading app settings alongside the existing stored-session probe. The protected navigation tree is not shown until both local probes complete, preventing a persisted fixed appearance from first painting in the default system appearance.

No storage schema change is required. `novella.settings.v1` and `ThemeMode` remain unchanged.

## Compatibility and Risks

- `Uniwind.setTheme('system')` maps to React Native 0.86's `unspecified` appearance override; fixed themes map to `light` or `dark`.
- Android Material colors are literal values, so every mounted RN consumer must receive a refreshed style/color prop. The implementation must migrate every ordinary-route import of the old singleton, not only the reported shelf screen.
- Navigation must not be keyed by the scheme because remounting would reset navigation and transient screen state.
- The provider must not replace the book-detail palette context.

## Rollback

The change is isolated to the mobile theme layer and color consumers. Rollback consists of restoring the static colors export, static stack preset, and direct system hooks; no persisted data migration needs reversal.

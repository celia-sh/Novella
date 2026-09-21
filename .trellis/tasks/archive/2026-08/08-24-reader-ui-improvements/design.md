# Design: reader navigation and status-bar colors

## Shared navigation contract

`ReaderNavigation` is shared by novel and comic screens. Extend its props with an explicit `statusBarStyle` (`default | light-content | dark-content`) so each reader supplies the style matching the actual foreground it renders.

The iOS implementation will:

- keep `headerTintColor` for back controls and toolbar items;
- add `headerTitleStyle: { color: foregroundColor }` for the centered navbar title;
- keep `scrollEdgeEffects.top = 'soft'` and the other edges `hidden`;
- pass `barStyle={statusBarStyle}` to the existing React Native `StatusBar`.

Android keeps its existing header appearance and receives the same explicit title/status-bar props without importing any iOS-only API. Web/fallback accepts the prop but does not need a native status-bar implementation.

## Color data flow

- Novel `ReaderScreen` derives its existing `readerTextColor`; on iOS its explicit custom background may produce black or white contrast text, so status-bar style derives from that actual color. On Android it follows the effective app color scheme.
- Comic `ComicReaderScreen` uses the app color scheme because its reader surface uses semantic app colors; light scheme maps to `dark-content`, dark scheme maps to `light-content`.
- Toolbar buttons already receive `foregroundColor`; no second color source is introduced.

## Platform constraints

- Do not use `Stack.Screen.statusBarStyle` for this app because React Native Screens documents its iOS controller-based requirement and `UIViewControllerBasedStatusBarAppearance=false` is intentional for Expo/RN and Toast compatibility.
- `StatusBar barStyle` controls status-bar foreground glyph/text appearance. iOS has no separate opaque status-bar background color in this translucent native-header arrangement; `headerStyle`/reader surface determine the color behind it.
- `scrollEdgeEffects` is iOS 26+; older iOS versions should ignore the unsupported native effect while retaining existing header behavior.

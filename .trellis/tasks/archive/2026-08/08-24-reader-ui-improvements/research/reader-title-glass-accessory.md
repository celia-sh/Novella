# Reader chapter-title glass accessory research

## Status

Option A is implemented in the iOS native `headerTitle` and committed as a
bounded visual experiment. The title is constrained by an explicit outer view
width derived from the window width, and the text uses one-line tail
truncation. The color-picker, required-font, and mode-switch fixes remain in
separate commits. Option B (the under-navbar accessory) remains research only.

## Current Novella path

`ReaderScreen` derives `readerTitle` from the chapter title in
`apps/mobile/src/screens/reader-screen.tsx` and passes it to
`ReaderNavigation`. The iOS navigation component supplies it as the native
stack `Stack.Screen` `title`, with `headerTitleStyle.color` controlling only
text color. The current title is therefore plain native navigation-title text;
there is no title accessory view or glass capsule.

## Swiftgram comparison

Swiftgram's standard chat page does not simply style the native title. It
creates a top panel (`ChatPinnedMessageTitlePanelNode`) and passes it through a
`HeaderPanelContainerComponent`.

`HeaderPanelContainerComponent` wraps its panels in a custom
`GlassBackgroundContainerView` / `GlassBackgroundView`, applies side insets,
and uses a rounded/pill shape for a single short panel or a larger rounded
container for multiple panels. The panel is laid out below the navigation bar
because the chat content top inset includes `navigationBarHeight`.

This is the correct reference for a Swiftgram-like chapter-title card: keep the
native navigation bar, add a content/header accessory beneath it, and include
the accessory's measured height in the content layout. It is not an Expo
Router `Stack.Toolbar.View` placement.

## Available Expo APIs

### `expo-glass-effect`

Novella already depends on `expo-glass-effect` `57.0.1`, and the iOS native
module is present in the Podfile. Its public APIs include:

- `GlassView`: a native iOS 26 `UIGlassEffect` host that can contain React
  children; supports `glassEffectStyle`, `tintColor`, `isInteractive`,
  `colorScheme`, and regular RN view styles such as corner radius.
- `GlassContainer`: groups multiple glass views when merging behavior is
  required; a single title card does not need it.
- `isLiquidGlassAvailable`: capability check already used by the shared stack
  preset.

On unsupported platforms/iOS versions, `GlassView` falls back to a regular
view. A future cross-version implementation would need an explicit fallback
such as `BlurView` or a translucent surface if the card must remain visibly
material before iOS 26.

### Native stack title customization

Expo Router's native-stack `headerTitle` function can return a custom React
element. A `GlassView` could therefore wrap the title *inside* the native
navigation header. This is technically possible and preserves native header
ownership, but it is not the Swiftgram layout: the custom title remains inside
the fixed native header center area, with limited control over height and
spacing.

`headerBackground` is also not an equivalent: it is the header background
layer, not a public slot below the header. `Stack.Toolbar.View` supports custom
content in left/right header toolbar areas or the bottom toolbar, but has no
public top-header-bottom placement.

## Future implementation options

### Option A — wrap the native title itself

Use a platform-specific `headerTitle` renderer. Constrain the outer native
header-title view, not only the glass child; otherwise iOS 26 can measure the
custom title by its full intrinsic string width and let it overlap toolbar
items:

```tsx
<View style={{ width: titleWidth, overflow: 'hidden' }}>
  <GlassView glassEffectStyle="regular" style={{ width: '100%' }}>
    <Text numberOfLines={1} ellipsizeMode="tail">
      {title}
    </Text>
  </GlassView>
</View>
```

Pros: no reader content inset change; title remains in native header.

Cons: not the Swiftgram under-navbar card; native header center sizing and
Liquid Glass composition may clip or constrain the custom view; custom
accessibility/truncation behavior must be rebuilt.

### Option B — Swiftgram-like chapter-title accessory (preferred if that is the
visual target)

Create an iOS-only `ReaderChapterTitleAccessory` below the native header. Wrap
its text in `GlassView`, use the reader foreground/background colors, and drive
its visibility from the existing `chromeHidden` state.

The accessory must be part of the reader chrome layout contract, not an
unaccounted absolute overlay. Its height and spacing need to be included in
`readerChromeInsets.top` / Skia page geometry so text and images cannot render
under the card. Changing the accessory visibility must preserve the current
locator/progress and handle paged/scroll modes without losing the chapter
position.

Pros: matches Swiftgram's standard-chat architecture and permits a real glass
card below the native Navbar.

Cons: requires reader inset/reflow work, title updates, iPad/large-screen
spacing, and explicit handling when chrome is hidden.

## Recommendation

The requested visual experiment is Option A: the current native Navbar title is
now rendered through a custom iOS `headerTitle` whose text is wrapped in
`GlassView`. It keeps native header ownership, uses a 44-point height to match
the iOS navigation toolbar item area, and adds a subtle solid fallback on
pre-Liquid-Glass iOS versions. It does not change reader content insets or
Skia layout.

Option B remains separate future work: a Swiftgram-style card below the Navbar
would still need its own accessory height and reader layout integration. Do not
replace the native header or use private UIKit APIs for either option.

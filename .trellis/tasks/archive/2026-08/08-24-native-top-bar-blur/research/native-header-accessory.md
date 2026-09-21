# Native header accessory research

## Status

Research only. No implementation is planned in the current reader UI change. This note records a possible future direction for placing a component below the native iOS navigation bar and keeping it aligned with navigation-bar visibility.

## Reference inspected

Repository: `Swiftgram/Telegram-iOS` (`Swiftgram/Telegram-iOS`), inspected at commit `cf8b23be`.

The relevant Swiftgram code was inspected from a local research checkout; its filesystem path is intentionally omitted.

## Swiftgram findings

Swiftgram has two related top-panel paths.

### Standard chat: content-level header panel

The visible pinned-message panel is selected by `titlePanelForChatPresentationInterfaceState` and added to the chat's `headerPanels`:

- `submodules/TelegramUI/Sources/ChatInterfaceTitlePanelNodes.swift` selects `ChatPinnedMessageTitlePanelNode`.
- `submodules/TelegramUI/Sources/ChatControllerNode.swift:1598` wraps it in `LegacyChatHeaderPanelComponent` and appends it to `headerPanels`.
- `ChatControllerNode.swift:1804` adds `navigationBarHeight` to the top inset for standard chats.
- `ChatControllerNode.swift:2724` lays out the header panel at the resulting top inset.
- `ChatPinnedMessageTitlePanelNode.swift:539` reports a 50-point panel height.

This keeps the native navigation bar and renders the pinned panel immediately below it in the page/content layer. It is therefore closest to Novella's previously discussed first approach: a screen-owned top accessory that shares the same visibility/layout state as the navigation bar.

### Embedded/custom chat: navigation-bar-owned accessory

For embedded/custom navigation contexts, Telegram has a lower-level accessory mechanism:

- `ChatControllerNode.swift:923` attaches `titleAccessoryPanelContainer` to `navigationBar?.additionalContentNode`.
- `submodules/Display/Source/NavigationBar.swift` defines `additionalContentNode` on the custom `NavigationBar` protocol.
- `submodules/TelegramUI/Components/NavigationBarImpl/Sources/NavigationBarImpl.swift` owns and lays out that node with the custom navigation bar.
- `ChatTitleAccessoryPanelNode` is the panel abstraction in `LegacyChatHeaderPanelComponent`.

This is not a standard UIKit `UINavigationBar` slot. It is an extension in Telegram/Swiftgram's own navigation-bar implementation. Because the accessory is in the same custom bar hierarchy, it can participate in that bar's layout and hide/show transition.

## Expo Router / React Native comparison

| API | What it supports | Why it is not an exact Swiftgram equivalent |
| --- | --- | --- |
| `Stack.Toolbar.View` | Arbitrary React content in `left`/`right` header toolbar areas or the `bottom` toolbar | No public top-header-bottom placement; `bottom` means screen-bottom toolbar |
| `headerBackground` | React content behind/inside the native header background | Does not create a slot below the header |
| `header` | Fully custom header React component | Replaces the native header and its native material/back-button behavior |
| `headerShown` | Boolean native-header visibility | No public accessory slot or visibility-progress callback |
| Shared screen state (`chromeHidden`) | Can synchronize a screen-owned accessory's visibility with the reader header | Synchronizes intent/state, not necessarily the native header's internal animation progress |

## Future implementation direction (deferred)

If Novella later needs the Swiftgram-like pinned/accessory appearance, prefer this order:

1. Keep the native Expo Router header and render a reader-owned accessory at the top of the screen content.
2. Drive its visibility from the existing reader `chromeHidden` state, with safe-area/header layout handled explicitly on each platform.
3. Animate the accessory using the same state transition if visual parity is sufficient.
4. Only consider a native header-owned accessory or a custom `header` if exact native-header ownership and synchronized animation are required.

A native header-owned solution would require a supported Expo Router/react-native-screens extension or a new native iOS integration. It should not use private UIKit APIs or a responder-stealing overlay.

## Reader chapter-title follow-up

The reader-specific question of wrapping the chapter title in a Swiftgram-like glass card is recorded in [`../../08-24-reader-ui-improvements/research/reader-title-glass-accessory.md`](../../08-24-reader-ui-improvements/research/reader-title-glass-accessory.md). It covers the existing `expo-glass-effect` APIs, native `headerTitle` wrapping, and the separate under-navbar accessory path that must participate in reader inset/layout calculations.

## Current decision

Do not implement this accessory in the current branch/task. Preserve the research for a future reader or navigation UI task. The current implementation only controls reader header edge effects, title/button tint, and status-bar foreground style.

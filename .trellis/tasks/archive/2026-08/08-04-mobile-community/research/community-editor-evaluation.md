# Community rich-text editor evaluation

## Candidate

`react-native-enriched-html` 1.1.0 by Software Mansion.

Sources:

- Package: <https://www.npmjs.com/package/react-native-enriched-html>
- Repository: <https://github.com/software-mansion/react-native-enriched-html>
- Expo rich-text overview: <https://docs.expo.dev/guides/editing-richtext/>

## Compatibility fit

- The package explicitly supports React Native 0.81–0.86 and requires the New Architecture/Fabric.
- `apps/mobile/package.json` currently uses Expo 57.0.9, React Native 0.86.2, React 19.2.3, and development-client/prebuild workflows, so the declared platform prerequisites match this project.
- It is a native module and therefore requires `expo prebuild` plus a rebuilt development client; it will not run in Expo Go. This is compatible with the repository's existing generated-native-project policy.
- The stable package is MIT licensed and actively maintained. Version 1.1.0 was published on 2026-07-30; the repository is active and has native Maestro coverage for iOS and Android.

## Functional fit

The library is a strong match for the server contract because it can:

- accept and emit HTML directly;
- render a fully native editor rather than a WebView;
- expose `onChangeText` for cheap validation and `ref.getHTML()` for on-demand submission, avoiding continuous HTML parsing;
- support bold, italic, underline, strikethrough, headings, blockquotes, ordered/unordered lists, inline code, links, mentions, and images;
- provide style-state events suitable for a HeroUI toolbar.

The mobile composer should use HeroUI for the page surface, title input, board/subcategory selection, toolbar controls, validation, error state, and publish state. `EnrichedTextInput` is the one intentional non-HeroUI control because HeroUI Native does not provide rich-text editing.

## Risks and constraints

1. **Young package** — the renamed 1.x line is recent. Treat adoption as a gated dependency rather than assuming parity.
2. **Native build impact** — validate iOS Pods, Android Gradle/codegen, Expo prebuild, and release builds before implementing the full composer.
3. **IME/editor issues** — current open issues include Android predictive-text interactions with inline styles and a missing built-in `maxLength`. The app must enforce title/body validation itself and smoke-test Chinese/Japanese IMEs, composition text, selection, undo/redo, paste, and long content.
4. **HTML compatibility** — the editor supports custom tags such as `<codeblock>`, `<mention>`, and checkbox-list markup that are not guaranteed to render correctly in Web-Master or the existing Flutter client. The first toolbar must be restricted to the shared-safe subset until cross-client round-trip tests prove more:
   - allow: paragraphs, bold, italic, underline, strikethrough, blockquote, ordered list, unordered list, and links;
   - initially omit: custom code blocks, mentions, checkbox lists, and inline images.
5. **Display path** — keep server-authored thread display behind an app-owned sanitizer/renderer contract. Do not assume `EnrichedText` supports every legacy HTML shape already produced by Web-Master/Flutter.
6. **Uncontrolled input** — keep the editor ref as the owner of HTML. Track only cheap derived state (`plainTextLength`, active toolbar state) in React; call `getHTML()` only during publish/draft persistence.
7. **Draft recovery** — because the input is uncontrolled, draft persistence must use explicit snapshots (route blur/background/debounce at a low frequency), then restore with `setValue()`.

## Recommendation

Adopt `react-native-enriched-html` as the preferred rich-text candidate, but make a small compatibility spike the first implementation gate. The spike is accepted only if both iOS and Android pass:

- clean `expo prebuild` and development-client builds;
- typing with Chinese/Japanese and Latin IMEs;
- cursor/selection, formatting toggles, list insertion, paste, keyboard avoidance, scrolling, dark/light styling, and accessibility labels;
- `getHTML()` output round-trips through the backend and renders acceptably in current mobile, Flutter, and Web viewers;
- no crash or state loss across background/foreground and native push/pop navigation.

If the spike fails, fall back to a HeroUI `TextArea` for the first release and convert paragraphs to safe HTML. This preserves the backend contract without blocking the rest of Community.

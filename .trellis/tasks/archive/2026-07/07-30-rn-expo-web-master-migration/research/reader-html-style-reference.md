# Reader HTML Style Reference

## Authority

- Web behavior and class names: `the Web-Master reference implementation`
- Web footnote/image interaction: `the Web-Master reference implementation` and `the Web-Master reference implementation`
- Mobile adaptation: `the archived Flutter implementation` and `reader_paged_page.dart`
- Flutter footnote extraction: `the archived Flutter implementation`

The RN reader must consume the server HTML contract. It must not reduce chapter
presentation to plain paragraphs plus ruby.

## Style Contract

| Source construct | Web / Flutter behavior | RN contract |
| --- | --- | --- |
| `h1`–`h4`, `.pius1`, `.pius2`, `.ph4` | Web reader heading scales, weights, alignment, margins, and title indentation | Preserve the same relative font scales, weight, alignment, margins, and title offset |
| `.em05`–`.em30` except `.em10` | Relative font-size presets from `0.5em` through `3em` | Scale from the active reader font size |
| `.right`, `.left`, `.center`, `.zin` | Alignment and indentation overrides | Preserve alignment and suppress optional first-line indentation where required |
| `.bold`, `.ita`, `.stress`, `.author` | Emphasis, author signature, and stress styles | Preserve font weight/style, relative size, margins, and alignment |
| `.message`, `.cut-line`, `.meg`, `.lh`, `.m0`, `.p0` | Compact message/cut-line layouts and spacing overrides | Preserve line-height, margins, and padding |
| `.red`, `.green`, `.blue`, `.black`, `.white` | Explicit authored colors | Preserve authored colors even when the reader theme differs |
| `.fl`, `.fr` and image `align`/inline `float` | Float-aligned media; Flutter constrains floating images instead of allowing unbounded width | Align and constrain media to the corresponding side; native RN does not provide browser-style text wrapping around floats |
| `.illus`, `.illu`, `.duokan-image-single`, `.image-preview` | Centered, wrapping illustration groups with natural image sizes | Keep the container as one reader block, wrap multiple images, center them, and cap images to the content width |
| `.dot`, `.em-dot` | CSS emphasis dots; Flutter uses dotted underline as a native approximation | Use dotted underline because RN Text has no text-emphasis primitive |
| `ruby` / `rt` / `rp` | Ruby annotation flow | Preserve native RN ruby layout and wrapping |
| `font[color][size]` and `center` | Legacy authored HTML still rendered by browsers/Flutter | Register explicit RN HTML models and preserve supported color/size/alignment |
| `.duokan-footnote` + referenced `id` | Hide the note body and show it from a native marker/popover | Extract note bodies before block normalization, remove them from reading flow, and open an accessible native route sheet; preprocess and render the note with the same dynamic chapter font as body HTML |
| Inline supported CSS | Browser/Flutter style processing | Let `react-native-render-html` translate supported native text/view declarations; do not pass unsupported `textIndent` into native styles |

## Deliberate Native Approximations

- RN has no browser float layout, `clear`, `border-collapse`, or
  `text-emphasis`. Float media is side-aligned without text wrapping; emphasis
  dots use Flutter's dotted-underline approximation.
- First-line indentation is represented in chapter presentation rather than by
  RN's unsupported `textIndent` style.
- Dynamic chapter fonts continue to apply through both the base style and
  `systemFonts`; style presets scale from the selected reader font size.

## Verification Targets

- A fixture containing headings, all font-size presets, alignment classes,
  stress/author/message classes, authored colors, legacy `font`/`center`, ruby,
  multi-image illustration groups, floated images, and footnotes.
- Both scroll and paged modes must use the same `BookHtmlContent` contract.
- Paged measurement must use the same styles and footnote/image preprocessing as
  visible pages so page boundaries do not drift after presentation.

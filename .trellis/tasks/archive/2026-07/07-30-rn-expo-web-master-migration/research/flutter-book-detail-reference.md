# Flutter Book Detail Reference Contract

## Purpose

This document is the implementation contract for recreating the mobile book
detail page in React Native. It records the archived Flutter behavior before
further RN changes are made. Screenshots are verification evidence, not a
substitute for this source analysis.

## Provenance And Authority

- Primary source: `[BRANCH]:lib/features/book/book_detail_page.dart`
  at archive commit `[COMMIT]`.
- The last commit touching that file on the archive branch is `[COMMIT]`
  (`Improve detail and reader load scheduling (#125)`).
- The archive pins Flutter `3.44.0` in `.fvmrc`.
- Flutter framework behavior below was checked against the locally available
  Flutter `3.44.6`. The relevant `SliverAppBar` and `FlexibleSpaceBar`
  formulas are unchanged for the behavior used by this page.
- Supporting source files:
  - `lib/core/layout/app_window_class.dart`
  - `lib/core/theme/app_color_profiles.dart`
  - `lib/core/utils/cover_url_utils.dart`
  - `lib/src/widgets/book_cover_image.dart`
  - `lib/src/widgets/book_cover_previewer.dart`
  - `lib/main.dart`

The Flutter file is authoritative for mobile layout, visual hierarchy,
spacing, typography, interaction, loading states, and scroll behavior. Current
Web-Master contracts remain authoritative for backend operations and payloads.

## Page State And Data Flow

The page is a `ConsumerStatefulWidget` with these presentation inputs:

| Input | Purpose |
| --- | --- |
| `bookId` | Required identity and service/cache key |
| `initialCoverUrl` | Immediate cover, color seed, and reader handoff |
| `initialTitle` | Immediate loading-preview title and share fallback |
| `heroTag` | Cover Hero transition identity |
| `telemetrySource` | Detail-open telemetry source |

The page owns the following visible state:

- book data, error, and loading state;
- resolved read position;
- shelf membership and shelf mutation loading;
- local mark state (`none`, `toRead`, `reading`, `finished`);
- extracted gradient colors and dynamic `ColorScheme`;
- cover-load/color-extraction completion state;
- a short post-reader interval during which local progress is shown before a
  delayed server response can replace it.

Loading is cache-first when enabled. Cached data is displayed after progress
refresh, then server data refreshes in the background. A network load defers
applying detail content until the route transition settles to avoid transition
jank. Server chapter position is authoritative; same-chapter local position is
retained only when the server position is the coarse `//*` value. Returning
from the reader temporarily prefers the newly written local position for UI
responsiveness.

## Theme And Dynamic Color

The entire page is wrapped in one animated Material theme and one `Scaffold`.
The cover-derived scheme is not applied only to the hero: it changes the page
surface, AppBar, buttons, chips, chapter state, and all bottom sheets.

1. A valid BlurHash is read from the cover URL's `placeholder` query value.
2. Its DC component is decoded into an average RGB color.
3. Saturation is adjusted with `min(1, saturation * 1.5 + 0.1)`.
4. Lightness is adjusted with `clamp(lightness * 0.9, 0.15, 0.75)`.
5. The seed is transformed for `light`, `dark`, or `oledBlack`.
6. `ColorScheme.fromSeed` creates the page scheme.
7. The three gradient colors and full scheme are cached by
   `<bookId>_<colorProfile>`.

If cover color extraction is disabled, the page still uses the active app
scheme. If extraction is enabled and a valid seed exists, the real content is
held behind the loading preview until color extraction completes. This avoids
rendering a base-colored page followed by a visibly different themed page.
Cached schemes skip the 600 ms theme transition; newly resolved schemes use
`Curves.easeInOutCubic` over 600 ms.

The themed page contract is:

| Role | Value |
| --- | --- |
| Scaffold and canvas | `colorScheme.surface` |
| AppBar background | `colorScheme.surface` |
| AppBar foreground/icons | `colorScheme.onSurface` |
| Bottom-sheet background | `colorScheme.surface` |
| Surface tint | transparent |
| OLED surface | `#000000` |
| OLED highest container | `#1A1A1A` |
| OLED on-surface | `#EFEFEF` |
| OLED on-surface-variant | `#C7C7C7` |

## Scroll And AppBar Geometry

### Explicit Sliver configuration

```dart
SliverAppBar(
  expandedHeight: 280,
  pinned: true,
  stretch: true,
  elevation: 0,
  scrolledUnderElevation: 0,
  backgroundColor: scaffoldBackgroundColor,
  flexibleSpace: FlexibleSpaceBar(
    collapseMode: CollapseMode.parallax,
    background: ...,
  ),
)
```

The toolbar uses `kToolbarHeight = 56`. There is no collapsed title; the title
slot contains an invisible full-width triple-tap share target.

For status-bar top inset `P` and scroll offset `s` clamped to `0...224`:

| Quantity | Formula |
| --- | --- |
| Max AppBar extent | `P + 280` |
| Min AppBar extent | `P + 56` |
| Collapse distance | `224` |
| Collapse progress | `t = s / 224` |
| Current AppBar extent | `P + 280 - s` |
| Flexible background top | `-56 * t = -s / 4` |
| Equivalent inner RN compensation when the scroll child already moves by `-s` | `+0.75 * s` |

### Flexible background fade

Flutter computes:

```text
fadeStart = 1 - 56 / 224 = 0.75
fadeEnd = 1.0
opacity = 1 - Interval(0.75, 1.0).transform(t)
```

The flexible background stays fully opaque for the first 168 px of collapse,
then fades to zero during the final 56 px.

### Required paint hierarchy

The visual result depends on paint order, not only on matching the preceding
numbers:

```text
Scaffold surface
  CustomScrollView
    pinned SliverAppBar Material surface
      flexible background, clipped to the current sliver extent
        cover-derived diagonal gradient or surface fallback
        vertical transition-to-surface mask
        cover/title/author row
      toolbar layer
        native back affordance
        invisible title/share target
        tag/comment/uploader actions
    body slivers
```

`AppBar.backgroundColor` is always the page surface. The flexible background
is stacked above it and clipped by the shrinking SliverAppBar. Toolbar controls
are stacked above the flexible background. When the flexible background fades
during the final 56 px, the AppBar surface is revealed. Later body slivers can
scroll underneath the pinned AppBar, but the AppBar surface occludes them.

This means neither of these RN structures is equivalent:

- a transparent native header with body content allowed to remain visible
  below the controls after collapse;
- an independently colored native header that is opaque from the initial
  frame and visually splits from the expanded hero.

The RN structure must reproduce all three layers: a page-scheme surface behind
the collapsible background, the collapsible/fading background itself, and
native navigation controls above both. At full expansion the flexible layer
covers the AppBar surface. At full collapse the surface covers/occludes body
content behind the toolbar.

The Flutter source enables stretch. Novella RN currently has a later explicit
product requirement to disable pull-down overscroll because the top edge could
expose invalid background. That is an intentional platform implementation
deviation; it must not change the collapse geometry.

## Hero Background And Header Content

The expanded background has two visual layers.

### Cover gradient

- Direction: top-left to bottom-right.
- Three cached profile colors are expanded to five stops by inserting 50%
  interpolation between colors 1/2 and 2/3.
- Stops: `0`, `0.25`, `0.5`, `0.75`, `1`.
- When extraction is disabled, unavailable, or failed, use the Scaffold
  surface with no substitute tint.

### Transition-to-surface mask

- Direction: top to bottom.
- Stops: `0`, `0.3`, `0.5`, `0.7`, `0.9`, `1`.
- Light/OLED alpha values: `0`, `0`, `40`, `120`, `200`, `255`.
- Regular dark alpha values: `0`, `0`, `56`, `144`, `216`, `255`.
- Every mask color is the current Scaffold surface.

### Cover/title row

| Element | Flutter contract |
| --- | --- |
| Horizontal position | same centered content padding as the body |
| Bottom inset | 16 |
| Alignment | row children aligned to bottom |
| Cover-to-text gap | 16 |
| Cover | 100 x 150 |
| Cover radius | 8 |
| Cover shadow | black alpha 45/255, blur 8, offset `(0, 3)` |
| Missing-cover icon | `menu_book_rounded`, size 40 |
| Title | Material 3 `titleLarge`, 22/28, bold (700), max 4 lines, ellipsis |
| Title-to-author gap | 4 |
| Author | Material 3 `bodyMedium`, 14/20, regular, on-surface-variant |

The author row is emitted only when the parsed `Book.Author` string is
non-empty. Flutter does not replace an empty explicit author with classification
metadata or an `Unknown author` label on this screen.

The title and a present author are tap targets for quick search. Title search uses the
configured series-name resolution and falls back to fuzzy title search;
author search uses author mode. The cover participates in a Hero transition
and supports a long-press preview:

- a blurred (`sigma 10`) black 70% full-screen overlay;
- cover preview height 65% of screen with 0.68 aspect ratio;
- fade and scale over 200 ms;
- preview shadow black 50%, blur 20, offset `(0, 10)`.

The cover image itself keeps a BlurHash placeholder mounted beneath the network
image. List routes pass `initialCoverUrl`, title, and the matching Hero identity
to detail; loading and loaded detail prioritize that exact initial URL instead
of waiting to rediscover the cover through `GetBookInfo`. The resolved image
waits for at least 120 ms on its first presentation and fades in over 200 ms.
It retries once automatically and exposes tap-to-retry after failure.

## Responsive Content Width

The page calls `appCenteredContentHorizontalPaddingForWidth` with a maximum
content width of 640 and minimum side padding of 20:

```text
if width <= 680: horizontalPadding = 20
else:            horizontalPadding = (width - 640) / 2
```

The same padding is used by the hero row and body. The chapter sliver begins at
`horizontalPadding - 12`; each tile adds 12 px internal horizontal padding, so
the tile content returns to the same body alignment.

## Main Body Layout

The body starts 16 px below the expanded AppBar.

### Metadata chips

The chip group is a wrapping row with 8 px horizontal and vertical gaps. It
shows favorite count, view count, chapter count, and a fourth mark-status chip
when the local mark is not `none`.

| Property | Value |
| --- | --- |
| Chip height | 26 |
| Horizontal padding | 10 |
| Radius | 8 |
| Background | `surfaceContainerHighest` at 180/255 alpha |
| Icon | size 14, on-surface-variant |
| Icon/text gap | 4 |
| Label | size 12, weight 500, on-surface-variant |
| Gap after chip row | 20 |

### Primary actions

The action row is 56 px high:

- shelf button: 56 x 56, radius 16;
- row gap: 12;
- reading button: fills remaining width, height 56, radius 16;
- play icon: size 22;
- play-icon/label gap: 8;
- reading label: size 15, weight 600, one line with ellipsis;
- label text: `开始阅读`, `续读`, or `续读 · <title>` with the title cleaned
  according to settings and truncated to 15 characters.

The shelf button uses `primaryContainer/onPrimaryContainer` when selected and
`surfaceContainerHighest/onSurfaceVariant` otherwise. Its icon is the default
Material icon size 24. During mutation, a 20 px loading indicator occupies the
same fixed button. Tap toggles shelf membership. Long press opens the mark
sheet, but only after the book is in the shelf.

There are 24 px after the action row.

### Introduction preview

- Section label uses the shared section-label style below.
- Gap from label to preview: 8.
- Tappable preview has radius 8 and 4 px vertical padding.
- Preview HTML is sanitized, images/scripts/styles are removed, block elements
  are flattened with single line breaks, and trailing breaks are removed.
- Text: size 14, line-height multiplier 1.6 (22.4 px), on-surface-variant.
- Maximum: 4 lines with ellipsis.
- Paragraph bottom margin: 0.6 em; div bottom margin: 0.4 em.
- Ruby annotation size: 55% of base text.
- Gap after preview section: 24.

### Latest-update panel

| Property | Value |
| --- | --- |
| Padding | 12 all sides |
| Radius | 12 |
| Background | `surfaceContainerHighest` at 128/255 alpha |
| Update icon | size 18, on-surface-variant |
| Icon/text gap | 8 |
| Label | size 13, one line, ellipsis, on-surface-variant |
| Gap after panel | 24 |

If there is no introduction, the update panel follows the action row's 24 px
gap directly. Relative time uses the explicit dayjs-like thresholds in the
Flutter file, not a generic locale formatter.

### Section labels

`简介` and `章节` use size 13, weight 600, letter spacing 0.5, and
on-surface-variant. Their effective Material line metrics must be preserved;
do not replace this with a larger page heading.

## Chapter List

The chapter list is a lazy `SliverList` of dense one-line Material 3
`ListTile`s.

| Property | Value |
| --- | --- |
| Minimum row height | 48 (`dense: true`) |
| Tile horizontal padding | 12 |
| Leading slot | fixed width 32, centered |
| Material leading/title gap | 16 |
| Chapter number | size 13, weight 500, tabular figures |
| Current number | primary, bold (700) |
| Chapter title | size 14, max 1 line, ellipsis |
| Current title | primary, weight 600 |
| Current badge | horizontal 8, vertical 2, radius 4 |
| Current badge label | size 11, weight 500, on-primary-container |
| Bottom content padding | `40 + bottom safe-area inset` |

The 16 px Material `horizontalTitleGap` is part of the Flutter layout even
though it is not written beside the local `ListTile`; an RN row must include
it. A row that places the title immediately after the 32 px number slot is not
equivalent.

## Navigation Toolbar

- Toolbar height: 56 plus the status-bar top inset.
- Background: the SliverAppBar's page surface, revealed through the flexible
  background fade; no elevation and no scrolled-under elevation.
- Back affordance: automatically implied Material navigation control.
- Action icons: Material default size 24 in default 40 px IconButton targets.
- Action order: tags (only when non-empty), comments, uploader.
- Right action-group padding: 12.
- Icon/foreground color: page scheme `onSurface`.
- No visible title.
- The invisible title region supports sharing after three taps within 500 ms.

RN may use platform-native navigation controls and Tabler artwork as explicit
product requirements, but their geometry, visibility, ordering, color role,
and AppBar paint hierarchy must remain equivalent.

## Bottom Sheets

All sheets use safe area, a drag handle, the effective detail-page dynamic
theme, surface background, and no surface tint.

### Sync warning

- Header padding: horizontal 16, vertical 12.
- Header icon: sync, tertiary, default size 24.
- Icon/title gap: 12.
- Title: `titleLarge` 22/28 bold.
- Body padding: `16, 0, 16, 16`; body `bodyMedium` 14/20,
  on-surface-variant.
- Two native list rows: continue now and wait; bottom gap 16.

### Mark selector

- Title padding: horizontal 16, vertical 12; `titleLarge` bold.
- Subtitle padding: `16, 0, 16, 8`; `bodySmall` 12/16,
  on-surface-variant.
- Native rows for to-read, reading, finished, and optionally clear.
- Selected row uses primary icon/text, bold text, and a primary check icon.
- Bottom gap: 16.

### Uploader

- Container padding: `20, 0, 20, 20`.
- Header icon size 22, primary; gap 10; title `titleMedium` 16/24,
  weight 700.
- Gap after header: 16.
- Description: `labelLarge` 14/20, on-surface-variant; gap after it 10.
- Profile card: full width, padding 16, radius 20,
  `surfaceContainerHighest` at 55%.
- Avatar: 56 x 56; gap to text 14.
- Name: `titleMedium`, weight 700, max 2 lines; secondary label uses
  `bodySmall`; internal gap 4.
- User-ID card top gap 12, padding 14, radius 16, same 55% container color.
- ID icon size 20; gap 12; label `labelMedium` 12/16; internal gap 4;
  value `bodyLarge` 16/24, weight 600.

### Tags

- Container padding: `20, 0, 20, 24`.
- Header icon size 22, primary; gap 10; title `titleMedium`, weight 700.
- Header-to-chip gap: 16.
- Chip wrap horizontal/run gap: 8.
- Material ActionChip uses 55% highest-container background, outline-variant
  border, and shrink-wrapped tap target.
- Selecting a tag closes the sheet and opens tag-mode search.

### Full introduction

- Scroll-controlled sheet with top radius 24.
- Draggable sizes: initial 60%, minimum 40%, maximum 90%.
- Title: `titleLarge` 22/28 bold, with 16 px bottom padding.
- Scroll content horizontal padding: 24.
- HTML text: size 16, line-height multiplier 1.8 (28.8 px), on-surface.
- Bottom content space: 48.
- The later RN product requirement adds an icon beside the introduction title;
  this is an intentional divergence from the archived Flutter file.

## Loading And Error States

### Loading preview

The loading state is a non-scrollable version of the same `CustomScrollView`
and `SliverAppBar`, not an unrelated centered spinner. It preserves the same
280 px hero, surface/gradient layers, cover size, title placement, body width,
and toolbar hierarchy.

- If initial cover/title are available, render them immediately.
- Author placeholder: 80 x 16, radius 4.
- Body top/horizontal padding: 16 / responsive page padding.
- Three chip placeholders: 55 x 26, radius 8, gaps 8.
- Gap 20.
- Shelf placeholder: 56 x 56, radius 16; gap 12; reading placeholder fills
  the row at height 56/radius 16.
- Gap 24.
- Introduction placeholder: full width x 80, radius 16.
- Gap 24.
- List placeholder: full width x 300, radius 16.

All placeholders share one synchronized 1500 ms horizontal shimmer. Dark base
and highlight are `#2A2A2A/#3A3A3A`; light values are
`#E0E0E0/#F5F5F5`.

### Error

The Flutter error state is centered: red error-outline icon size 64, 16 px
gap, generic failure text, 16 px gap, and an elevated retry button with refresh
icon. It does not expose a raw exception string in the visible UI.

## Current RN Parity Gaps

This matrix was recorded before the next implementation pass.

| Area | Current RN state | Required correction |
| --- | --- | --- |
| Collapsed AppBar | Native header remains transparent and body controls/rows show beneath toolbar controls | Reproduce pinned AppBar surface behind the fading flexible layer so body content is occluded after collapse |
| Header implementation | Native controls are separate from the ScrollView | Keep native controls, but model the Flutter background/flexible/body paint order explicitly; do not apply a permanently opaque independent header color |
| Chapter alignment | Title begins immediately after the 32 px number slot | Add the implicit Material 16 px leading/title gap |
| Section label | RN letter spacing is 0 | Use Flutter's explicit 0.5 |
| Bottom space | Fixed 40 only | Add bottom safe-area inset |
| Metadata | Favorite/view/chapter only | Add local mark chip once mark behavior is available |
| Shelf action | Tap only | Add long-press mark flow and matching states |
| Hero interactions | Static title/author/cover | Add title/author quick search, cover Hero/preview behavior as migration scope reaches those contracts |
| Theme timing | Detail theme changes after book arrives | Avoid a base-theme-to-cover-theme flash when a valid cover seed is known |
| Cover rendering | Network image transition only | Preserve BlurHash base layer, minimum placeholder interval, retry, and preview behavior |
| Loading | Approximate static blocks | Use the same AppBar hierarchy and synchronized Flutter dimensions |
| Error | Smaller icon, raw error, different layout | Match the generic centered Flutter state and keep diagnostics out of visible text |
| Chapter list | Eager `.map` inside ScrollView | Use a virtualized/lazy list without breaking the collapsible header contract |
| Intro title | RN adds icon | Keep as approved newer product requirement |
| Overscroll | RN disables bounce/overscroll | Keep as approved newer product requirement |

## Bug Analysis: Repeated Book Detail AppBar Mismatch

### 1. Root Cause Category

- **Category**: A/E - Missing specification and implicit assumption.
- **Specific cause**: Previous changes copied isolated constants and screenshot
  appearances without documenting Flutter's paint hierarchy. A transparent
  native Stack header was assumed to be equivalent to a Flutter
  `SliverAppBar`; it is not, because the Flutter AppBar retains an opaque
  surface below its fading flexible background and paints above later slivers.

### 2. Why Earlier Fixes Failed

1. Adjusting hero height and content offsets addressed initial framing but did
   not reproduce pinned-sliver paint order.
2. Changing parallax ratios addressed motion while allowing body content to
   remain visible underneath toolbar controls.
3. Applying an always-visible page/header overlay hid body content but split
   the expanded hero because it did not follow the flexible-background fade.
4. Removing that overlay restored the expanded hero but also restored the
   fully transparent collapsed header shown in the Android screenshot.
5. Looking at screenshots alone obscured implicit Flutter defaults such as the
   16 px `ListTile.horizontalTitleGap` and the background fade interval.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific action | Status |
| --- | --- | --- | --- |
| P0 | Documentation | Keep this source-derived contract under the active Trellis task | Done |
| P0 | Process | Require a reference parity matrix before changing migrated screens | Added to frontend spec |
| P0 | Architecture | Implement collapsible AppBar as explicit surface/flexible/content layers | Pending implementation |
| P1 | Runtime QA | Capture expanded, partially collapsed, and fully collapsed screenshots on Android and iOS | Pending |
| P1 | Review | Check implicit framework defaults, not only values written in the feature file | Added to frontend spec |

### 4. Systematic Expansion

- Other Flutter migrations using `SliverAppBar`, `ListTile`, theme defaults,
  or sheets can fail in the same way.
- Native navigation controls and a Flutter-derived content hierarchy are
  compatible only when ownership of each painted layer is explicit.
- A screen is not visually migrated when its resting screenshot matches; its
  scroll transition and intermediate frames are part of the contract.

### 5. Implementation Gate

No further RN book-detail visual changes should be accepted unless they can be
traced to this document, a cited newer product override, or a verified native
platform constraint. Validation must include at least these states:

1. loading preview;
2. fully expanded detail;
3. 50% collapse;
4. start of flexible-background fade at 168 px;
5. fully collapsed at 224 px;
6. body scrolled beneath the pinned toolbar;
7. current chapter visible;
8. introduction, tags, and uploader sheets;
9. light, regular dark, and OLED profiles;
10. cover extraction enabled and disabled.

# Component Guidelines

## Scope

These rules apply to React Native components in `apps/mobile`, React
components in `apps/site`, and future Electron presentation components.

## Component Boundaries

- Components render state and forward user intent. Authentication, API,
  synchronization and reader state transitions belong to shared application
  services or hooks that call those services.
- Mobile and desktop components do not import each other. Reuse domain models,
  commands and selectors through `packages/*`; share presentation code only
  when the target runtimes genuinely use the same React primitives.
- Keep screen components focused on composition. Move repeated controls into a
  local `components/` directory before considering a cross-application UI
  package.
- Do not pass raw API responses, unvalidated JSON or storage records into
  components.

## Props And State

- Declare named props types for exported components.
- Prefer discriminated unions for loading, content, empty and error states.
- Keep transient interaction state local. Server state and durable user state
  must have one owner outside the component tree.
- Effects must synchronize with an external system. Do not use an effect to
  derive values that can be calculated while rendering.

## Reader Progress And Resume State

- Treat reader progress as an optimistic local projection, not as ordinary
  server query state. Visible progress must be published synchronously in
  memory before debounce, storage, SignalR, or navigation work begins.
- Detail-screen “Continue reading”, chapter selection, and reader restoration
  must consume the same projection. A screen that stayed mounted underneath a
  reader must subscribe to progress changes and refresh on focus; mount-only
  queries are insufficient.
- Keep one canonical progress representation: `bookId`, `chapterId`, and the
  server-compatible locator/page. The durable pending/synced cache is a mirror
  and retry journal for that same value, not a second progress coordinate
  system. Do not add absolute offsets, layout fingerprints, or mode-specific
  positions unless the backend contract itself adopts them.
- Server responses without a revision timestamp cannot immediately override a
  causally newer local checkpoint. Do not invent a time lease. Pending data or
  a value staged in the current process remains visible until the server echoes
  that exact chapter and locator/page; that equality immediately clears the
  local barrier.
- Reader exit/blur, chapter transition, app background, and mode changes must
  stage the current checkpoint synchronously. Disk and network writes remain
  serialized and retryable, but UI correctness cannot depend on their timing.
- A restore must suppress initial viewability callbacks until its scroll/index
  operation has been issued. Otherwise the list's temporary first cell can
  overwrite the intended checkpoint before restoration completes.
- Scroll-reader progress tracks the top block with any visible area, matching
  Flutter's `itemTrailingEdge > 0 && itemLeadingEdge < 1`. Do not use an
  item-percentage threshold: a block taller than the viewport may never reach
  it, leaving the saved locator permanently stale. Restore must also walk an
  inline Web XPath upward until it finds the nearest rendered block.
- A virtualized jump to an unmeasured block is an implementation detail, not a
  reader animation. Keep the list mounted but visually hidden and noninteractive
  while it converges; reveal it only after the target block is reported visible.
  Do not flash the chapter start or expose iterative `scrollToIndex` retries.

## Book Covers

- Web-Master defines book and comic covers as width:height `2:3`. Reusable
  mobile cover components own that aspect ratio; callers provide available
  width but must not calculate a competing height.
- Folder cover frames, unavailable states, and loading skeletons use the same
  shared `BOOK_COVER_ASPECT_RATIO` so loading and content cannot shift.
- Cover pixels must use the shared `BookCoverImage`, not a direct `expo-image`
  with a raw placeholder string. It preserves a validated 32 x 48 native
  BlurHash underlay for at least 120 ms, fades resolved pixels over 200 ms,
  remembers revealed URLs, and owns loading/error/retry behavior.
- BlurHash validation belongs to `packages/api-client`: Base83 membership and
  component-declared length are both required. Invalid cover/comic hashes
  become null/empty before presentation.
- `expo-image` is the intentional RN decoder because it performs BlurHash work
  in the native iOS/Android image pipeline. Do not send raw RGBA through JS or
  add a second Rust-to-image bridge unless Expo's native path is proven
  insufficient. On Android SDK 57, render through the private
  `BookCoverBlurHash` adapter, which calls Expo Image's bundled decoder with
  its unsafe dimension/component cosine cache disabled; callers still use
  `BookCoverImage` and never select this platform workaround directly.
- List-to-detail navigation carries the already presented cover URL, validated
  BlurHash, and title as route hints, matching Flutter's `initialCoverUrl`
  contract. Detail loading and loaded heroes prioritize that exact URL so a
  separately fetched detail DTO cannot restart an already revealed cover.
  `BookCoverImage` publishes its bounded revealed state when native pixels load,
  before its local fade completes; destination routes must not wait for the
  source component's animation to finish.
- Cover color extraction must prefer the API-provided BlurHash, never re-parse
  the cover URL query. The server percent-encodes placeholders, but legacy
  cover URLs can carry base83 characters unencoded — `+` most notably, which
  URL query parsing turns into a space (and `#`/`%XX` sequences corrupt the
  value similarly). `extractBlurHashPlaceholder` in `packages/api-client`
  reads the raw query string (`+` kept literal, valid `%XX` decoded, fragment
  stripped) so both encoded and legacy raw URLs validate. The theme chain
  (`useBookDetailRouteTheme` → `activate` → `createBookDetailTheme`) threads
  `coverPlaceholder` from the decoded book DTO as the primary source; URL
  re-extraction is only the fallback.

## Shelf Optimistic Management

### 1. Scope / Trigger

- Applies to shelf folder creation/rename, sibling reorder, book moves, item deletion, and book-detail shelf toggles.
- Shelf editing is an interaction mode, not a transaction boundary. The app has no draft that is committed only when the user exits.

### 2. Signatures

```ts
interface ShelfBookRef {
  id: number;
  type: 'NOVEL' | 'COMIC';
}

type ShelfItemKey = `NOVEL:${number}` | `COMIC:${number}` | `FOLDER:${string}`;

interface ShelfUseCase {
  contains(ref: ShelfBookRef): Promise<boolean>;
  getSnapshot(): ShelfSnapshot | null;
  load(): Promise<ShelfSnapshot>;
  save(draft: ShelfDraft): Promise<ShelfSnapshot>;
  subscribe(listener: (snapshot: ShelfSnapshot) => void): () => void;
  toggleBook(ref: ShelfBookRef): Promise<boolean>;
}

type ShelfMode = 'browse' | 'edit';
type ShelfEditInteraction = 'select' | 'reorder';
```

`save()` has an important split-timing contract: it normalizes and publishes the optimistic complete shelf synchronously before returning its queued Promise; the Promise represents server confirmation.

### 3. Contracts

- `ShelfUseCase` owns one process-wide shelf projection. Every mutation starts from `getSnapshot()`, applies a pure `ShelfDraft` transform, and calls `save()` immediately. Components and per-screen hooks must not own a second discardable shelf draft.
- Shelf identity is type-qualified: use `NOVEL:<id>`, `COMIC:<id>`, and `FOLDER:<id>` keys throughout card maps, selection, move, delete, reorder, and membership. `ShelfSnapshot.books` is a list of `{ ref, book }` records; a `null` card never removes its typed shelf item.
- Browse media state is a local `Novel | Comic` projection over the one complete snapshot. It may recursively hide folders without matching descendants and derive counts/previews from that projection. Route it as `media=novel|comic`; changing it must not load, hydrate, save, or mutate indexes.
- Edit mode is always the complete unfiltered sibling tree. Hide or disable the media control while editing; never reorder or save a filtered sibling list.
- Complete-shelf saves stay serialized. A response from an older generation may not publish over a newer optimistic projection. The latest successful complete-state save confirms all earlier operations.
- If the latest save fails, keep that complete optimistic draft as a pending authority barrier. `load()` must return it rather than replacing it with a stale server echo. Retry saves the current complete projection again.
- Exiting edit mode only clears selection/reorder interaction state. It does not save, discard, cancel a queued write, or clear a failed pending projection.
- The API supports root folders only: folders use `parents=[]`; books use `parents=[]` or `[folderId]`. New Folder is root-only. Move destinations are root folders; a folder screen also offers root and excludes its current folder. Folders cannot move.
- Root browse chrome is New Folder + Edit. Folder browse chrome is Edit + Rename. Edit chrome is one stable Select/Reorder toggle + Move + Delete + Exit. Move requires selected books, no selected folders, and at least one destination. Delete requires any selection.
- Expo Router header toolbars inspect supported direct child types. On iOS, declare every `Stack.Toolbar.Button` directly under `Stack.Toolbar` and toggle it with `hidden`; do not return mode-specific fragments or wrapper components inside the toolbar, because the native header can resolve no buttons even though React rendered valid JSX.
- The former catch-all `/shelf/manage` menu, Save Changes, and Discard Changes are forbidden. Focused name and destination sheets may collect one action's input.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Empty/duplicate folder name | Domain transform rejects; show localized inline error; do not save |
| No selection / selected folder / no destination | Disable Move natively |
| Any non-empty selection | Enable Delete and keep destructive confirmation |
| Latest save fails | Keep optimistic shelf, expose Retry, block stale reload overwrite |
| Earlier save fails but newer complete save succeeds | Newer snapshot remains visible and clears pending authority |
| Exit while save is queued | Leave edit mode; write continues |
| Browse media changes | Recompute only the local projection; do not load, hydrate, save, or change indexes |
| Same numeric id in Novel and Comic | Keep separate typed keys and membership refs |
| Nested folder returned by legacy data | Never offer it as a creation or move destination |

### 5. Good / Base / Bad Cases

- Good: drag completion publishes the new order immediately, Exit only changes toolbar/grid interaction, and the queued save later confirms without another visual reorder.
- Base: selecting books at root enables Move when at least one root folder exists; selecting a folder disables Move but enables Delete.
- Bad: keep changes in `useShelf` until an explicit Save/Exit, refetch after a failed save, or let an older queued completion replace a newer order.

### 6. Tests Required

- Client-core tests must assert synchronous subscriber publication, normalization, serialized save order, stale-completion suppression, failed-pending `load()` protection, retry confirmation, typed duplicate-id membership, and a book toggle extending pending optimistic state.
- Pure mobile tests must assert root/folder destination lists, recursive Novel/Comic visibility and counts/previews, nested-folder exclusion, route media parsing, unresolved cards, and Move/Delete enabled-state rules without filtering edit siblings.
- Run workspace checks, shelf tests, localization parity, both Expo exports, and Android `:novella-ui:compileDebugKotlin` when native action icons change.
- Device acceptance covers both platform toolbars, selection/reorder switching, move/delete/name sheets, immediate updates before Exit, Back-to-exit-edit behavior, and failed-save Retry.

### 7. Wrong vs Correct

```ts
// Wrong: screen-local transaction; Exit is now an accidental data boundary.
const draft = createShelfDraft(snapshot);
updateDraft(reorderShelfSiblings(draft, input));
await saveOnlyWhenExitIsPressed(draft);

// Correct: publish one complete shared projection, then confirm in order.
const current = shelf.getSnapshot();
const next = reorderShelfSiblings(createShelfDraft(current), input);
void shelf.save(next); // optimistic publication is synchronous

// Correct: membership carries media identity; numeric ids are not global keys.
await shelf.toggleBook({ id: bookId, type: 'COMIC' });
```

## Paged Reader Images

- Separate pagination geometry from image pixels. Hidden measurement may render
  deterministic image frames but must never mount a network image or await all
  chapter image downloads.
- Geometry priority is explicit HTML dimensions, then the bounded persisted URL
  cache, then a stable `2:3` fallback. Standalone unknown illustrations retain
  a frozen page frame for pagination, but their visible loading/error
  placeholder is a centered `2:3` box inside that frame. Other unknown chapter
  images use `2:3` as both placeholder and initial geometry.
- Once a page model is visible, image `onLoad` may update pixels inside its
  frame and persist natural dimensions for future builds, but may not resize
  that frame or trigger repagination.
- Rely on the visible page-list window for the active chapter's immediate
  pixels; never make whole-chapter image prefetch a display gate. After that
  chapter is visible, the configured 0–3 chapter lookahead may preload future
  chapter images one-by-one to disk at background priority. It must stop its
  pending generation on chapter change, reader exit, or app background.
- Horizontal comic paging must warm native components, not only URLs. Track the
  current page with a stable greater-than-half-visible callback, keep a bounded
  multi-viewport `FlatList` window attached with `removeClippedSubviews={false}`,
  and render that window without the default 50 ms cell-batch delay. This lets
  the same nearby `ComicPage` / `Image` instances decode and paint while still
  outside the viewport. `Image.prefetch` remains useful for the farther disk
  tier, but it is not a substitute for mounted immediate-neighbor components.
  The initial restore target must reject transient viewability callbacks until
  the intended page itself is reported visible.
- In comic double-page mode, build display slots from the validated source
  dimensions already attached to each logical page. A known landscape page
  (`width > height`) is non-pairable and occupies its own viewport; adjacent
  portrait pages may still pair. Keep the original `ComicPageSlot.index` and
  resolve restoration, progress jumps, taps, and boundary checks against the
  generated slots rather than `floor(pageIndex / 2)`. Missing dimensions use
  the stable fallback and remain pairable. On a phone-sized single-column
  paged or continuous viewport, a known landscape source image (`width >
  height`) is represented by two horizontal virtual segment slots; a known
  source image at least `2:1` tall whose width-fitted height exceeds one
  viewport is represented by consecutive vertical segment slots. Render each
  segment by clipping the original image, not by changing its aspect ratio or
  source URI; reverse horizontal source offsets for RTL while keeping logical
  segment indexes stable. Segment navigation tracks the display index while
  persisted progress keeps the original logical page index. Unknown/invalid
  dimensions are not segmented. Continuous mode uses the same single-column
  segment items with segment-sized vertical layout entries; paged mode uses
  fixed viewport-width entries. Physical image slicing remains out of scope
  when it would create new resources; virtual clipping is the reader
  implementation.
- Reader images, placeholders, and errors share a 4 dp continuous clip radius.

## Readium Swift Novel Reader

### 1. Scope / Trigger

- Applies when the novel reader is rendered by the iOS-only `NovellaReadiumView` Expo module.
- The native renderer owns only Readium publication/navigator lifecycle and native input. React owns chapter API requests, publication resource materialization, settings, chrome, preview UI, and backend progress.
- Android must resolve a TypeScript fallback and an unsupported state; it must not autolink a Readium module or depend on Readium Kotlin.

### 2. Contracts

- Publication resources are generated in TypeScript with stable `EPUB/chapters/{chapterId}.xhtml` hrefs, deterministic `nv-block-N` fragments, current `processNovelFootnotes()` + `inlineNovelFootnotesAfterBlocks()` output, relative stylesheet/font links, and API-origin image rebasing.
- First paint waits only for OPF/container/navigation/stylesheet, target XHTML, and a required cached WOFF2 font. Future chapter XHTML is materialized asynchronously by the existing preload window.
- `ReadiumLocator` is a bridge value only. Persisted progress remains `{ bookId, chapterId, position: block.locator }`; never store a raw Readium locator as the backend position.
- The novel progress slider uses `locations.progression` for the current chapter and displays a percentage. It must not call novel page-count estimation. Comic progress remains page based.
- `navigatorContentInset()` receives the values from `createReaderChromeInsets()`; do not add a second React padding layer that changes the safe-area contract.
- Native `onBoundary` emits only an outward release at the active navigator's leading/trailing boundary. JS maps `previous` to `openChapter(previousSortNum, 'end')` and `next` to `openChapter(nextSortNum, 'start')`.
- A React loading indicator covering the native Readium navigator must be an opaque absolute overlay. Never place a `flex: 1` loading view as a normal-flow sibling of the navigator: that splits the navigator's bounds, exposes Readium's own spinner, and makes the first-paint transition jump.

### 3. Preferences

- Submit `EPUBPreferences` with `publisherStyles = false` so font size, line height, margins, paragraph indent/spacing, colors, scroll mode, and column count are effective.
- Map the existing large-screen double-page policy to `columnCount = .two`; otherwise use `.one`. Do not reintroduce JS pagination or Skia layout.
- When Readium cannot express a setting exactly, document the fallback in the task design and test the resulting bridge values.

### 4. Good / Base / Bad

- Good: a cached WOFF2 is present before the target XHTML is opened, a locator fragment maps directly to the same normalized block, and a percentage seek creates a current-resource locator without changing the backend protocol.
- Base: Android builds the app and shows the unsupported novel-reader state without resolving an unregistered native view.
- Bad: add Readium Kotlin only to satisfy the shared TypeScript import, persist `totalProgression` as a server position, calculate device-specific novel pages, or materialize every future chapter before first paint.

### 5. Tests Required

- Publication tests assert stable chapter hrefs/spine, target readiness, WOFF2 gating, XHTML fragments, image rebasing, and inline footnote order.
- Locator tests assert fragment, text-anchor, progression fallback, and foreign-chapter rejection.
- Preference/progress tests assert opaque colors, paragraph mappings, percentage display/seek behavior, and that novel page-count helpers are not used.
- Run workspace type checks, reader tests, boundary checks, iOS native build, iOS device acceptance, Android export, and Android Kotlin compilation without Readium dependencies.

### 6. Wrong vs Correct

```tsx
// Wrong: keeps the old renderer alive for Android and silently diverges behavior.
const Renderer = Platform.OS === 'ios' ? NovellaReadiumView : ReaderSkiaScroll;

// Correct: iOS owns Readium; Android has an explicit temporary unsupported path.
const Renderer = NovellaReadiumView; // resolved to a no-op TS fallback on Android
```

```ts
// Wrong: device-specific pages are not stable for reflowable text.
const pages = estimateNovelPageCount(layoutHeight, viewportHeight);

// Correct: Readium exposes chapter progression; backend still receives a block locator.
const percentage = locator.locations.progression ?? 0;
const position = readiumLocatorToReaderPosition(locator, chapterId, blocks);
```

## Platform Presentation

- React Native components use React Native primitives and accessibility props;
  website components use semantic HTML.
- A shared package must not return JSX or expose React hooks.
- Future Electron window behavior stays in `apps/desktop`; it cannot leak into
  reader, sync, API or authentication packages.

### Migrating Reference Screens

- Before recreating a non-trivial Flutter screen, record a source-derived
  parity matrix under the active Trellis task. Cover the render hierarchy,
  scroll geometry, explicit dimensions, typography, icon geometry, theme
  roles, loading/error/empty states, interactions, and platform overrides.
- Inspect framework defaults used implicitly by the source. Values such as
  `ListTile.horizontalTitleGap`, toolbar height, text-theme metrics, and
  `FlexibleSpaceBar` fade/parallax formulas are part of the rendered contract
  even when the feature file does not spell them out.
- Screenshots verify results but do not define implementation behavior. Do not
  change navigation layers, offsets, or colors solely from a screenshot when
  the archived source is available.
- When native Expo navigation owns back/actions but the source screen owns a
  collapsible background, document the paint order explicitly. Native controls
  may remain native while the content implementation preserves the source
  surface, flexible background, clipping, and body-occlusion behavior.
- Record deliberate deviations beside the parity matrix. A later explicit
  product requirement may override the reference, but an accidental framework
  default may not.

### Reusable Native Grouped Lists

- Use `@expo/ui` Universal components for isolated controls and simple rows,
  but verify the resulting native hierarchy on both platforms. Universal
  `FieldGroup.Section` currently wraps child rows differently on Android and
  can create a nested Compose `ListItem` when the child is another Universal
  `ListItem`.
- When a grouped list needs a leading icon, headline, supporting description,
  trailing accessory, and full-row navigation, expose a reusable component
  contract instead of implementing the row in a screen. The current shared
  contract is `NativeGroupedList`, `NativeGroupedListSection`, and
  `NativeGroupedListRow` under `apps/mobile/src/components/`.
- Keep the props platform-neutral (`icon`, `title`, `description`,
  `trailing`, `onPress`, `disabled`). Put the actual row tree in paired
  `.ios.tsx` and `.android.tsx` implementations. iOS should render a SwiftUI
  `List` with `Section` and a native button row; Android should render a
  Compose `LazyColumn` with grouped surfaces and Compose `ListItem` rows.
- Do not pass a Universal `ListItem` as a child of `FieldGroup.Section` when
  the target is Android. This is the known source of nested dark list blocks
  and incorrect row spacing.
- A component is reusable only when its public props do not mention a single
  screen or feature. Settings is one consumer of the grouped-list primitives;
  account, downloads, filters, and future desktop-adapted surfaces may reuse
  the same contract.

### Native Slider Optimistic Commit Contract

Reader settings sliders separate immediate interaction feedback from expensive
reader work:

- `NativeSliderRow` owns a local draft value. The thumb and formatted value
  label update on every native slider event without publishing app settings.
- iOS commits on SwiftUI `onEditingChanged(false)`; Android commits on Compose
  `onValueChangeFinished`. Do not emulate release with a persistence call on
  every `onValueChange` event.
- Keep the optimistic draft visible until `useAppSettings()` publishes the same
  committed value, so storage latency cannot make the label snap backward.
- `loadAppSettings()` hydrates storage once per app runtime. An update must not
  reread storage before every write.
- After release, capture the current visible block locator from the native
  scroll/page offset, then unmount old Skia tiles and show the native spinner
  plus `正在应用设置` while the existing 300ms debounce and synchronous layout
  complete. Mount the new generation and restore that locator only after the
  new `FlatList` ref exists.
- Route `start`/`end` positions are one-shot chapter-opening intentions. Once a
  live locator exists, settings reflow and mode remounts must resolve as
  `saved`; never replay `start` and send the reader back to block zero.
- Treat scroll/paged switching as a staged reflow too. The direct native
  toolbar handler captures the live locator and imperatively shows an isolated
  `ReaderReflowOverlayHost`; it must not replace or reconcile the chapter list
  just to display feedback. Native navigation keeps a local optimistic mode so
  its icon changes in the press turn, independently of the delayed Skia mode.
  Wait until the overlay has painted before mode planning, progress save, and
  settings persistence. Rebuild the new-axis list beneath the overlay, restore
  its locator, then hide the overlay.

```tsx
// Wrong: each drag tick wakes the whole settings store and reader layout.
<Slider onValueChange={(fontSize) => updateAppSettings({ fontSize })} />

// Correct: local draft during drag, one global commit on native release.
<NativeSliderControl
  value={draftValue}
  onValueChange={setDraftValue}
  onSlidingComplete={() => updateAppSettings({ fontSize: draftValue })}
/>
```

> **Warning**: Do not mark a reflow restore key as consumed while the loading
> state has unmounted `FlatList`. `scrollToOffset`/`scrollToIndex` will be a
> no-op against a null ref, and the remounted list will start at the chapter
> boundary.

### Native UIKit Slider Thumb Rendering

Custom iOS `UISlider` thumb images must include transparent bounds around the
visible grabber. Draw the visible `18×12` thumb inside a `30×30` image (or use
a similarly padded layer-backed container) before applying a shadow. A shadow
drawn into a bitmap whose edge matches the visible thumb is clipped at the
bottom and produces incomplete corners; the padded container preserves the
full shadow without changing slider values or track geometry.

### Native ColorPicker Commit Contract

The iOS `@expo/ui/swift-ui` `ColorPicker` emits `onSelectionChange` for each
SwiftUI selection change while the user drags across the palette. Treat those
events like slider drag ticks:

- Keep the live selection inside the native picker; do not publish app settings
  or write SQLite on every callback.
- Debounce the latest value after the interaction becomes idle. The current
  reader color-picker boundary uses a 180 ms trailing commit.
- Flush the pending value when the settings control unmounts so dismissing the
  settings sheet cannot lose the final color.
- Keep this coalescing at the iOS presentation boundary. Other settings and the
  Android no-op implementation must not inherit an iOS-only native import.

```tsx
// Wrong: every palette sample wakes all settings subscribers and queues SQLite.
<ColorPicker onSelectionChange={(color) => updateAppSettings({
  novelReaderBackgroundColor: color,
})} />

// Correct: the native picker stays responsive; only the settled/latest color
// enters the durable settings projection.
<ColorPicker onSelectionChange={debouncedCommit.schedule} />
```

### Native Alerts vs RNHostView Re-renders (iOS)

### Void Hub Methods: The "Offline" Delete Lie

- The server's `DeleteComment` hub method is void: it performs the delete, then
  answers with an empty payload that `@microsoft/signalr-protocol-msgpack`
  rejects (`_parseMessage` throws `Error("Invalid payload.")` for a zero-length
  message — present in both v9 and v10). The raw error is misclassified as
  `network` by `toApiError`, so a successful delete rendered as
  "Comments are unavailable while offline." with the comment still visible.
- Rule: the invoke error for a void mutation is NOT proof the mutation failed.
  Reconcile with a silent reload and treat the reloaded list as the server
  truth. In `use-comments.ts` `deleteComment`: swallow the invoke error, reload
  page 1, and only surface an error when the reload itself fails or the deleted
  comment is still present on the reloaded page.
- `load` returns the fetched page on success / `null` on failure (errors are
  set in state, never thrown) so callers can branch without breaking the
  `void load()` / `void refresh()` call sites.

> **Gotcha**: Re-rendering a row whose icon is a Tabler SVG hosted in
> `RNHostView` while a native `Alert.alert` presents over it can leave that
> row's icon blank until the screen re-renders again.

- Tabler icons (`@tabler/icons-react-native`) are react-native-svg vectors. On
  iOS, names without an SF Symbol entry are wrapped in `RNHostView` (SwiftUI
  hosting). Re-rendering the row tears down and rebuilds the hosted content.
- When that rebuild lands in the same window the alert is presented over, the
  freshly rebuilt hosting view can fail to repaint after dismissal → the icon
  disappears. Only the row that re-rendered in that window is affected, which
  makes it look random and hard to reproduce.
- Verified timing rule (settings clear-cache rows):
  - Bad: `setState(busy)` → `await` (microtask boundary lets React commit the
    re-render) → `Alert.alert(...)`. The re-render happens before the alert.
  - Good: `setState(busy)` → synchronous work → `Alert.alert(...)` in the same
    sync block. The alert presents before the re-render commits; later
    re-renders happen behind the alert.
- **Fix**: keep action rows static during the operation — no `disabled` flip,
  no dynamic title. Guard re-entry in the handler instead:

```tsx
async function handleClear() {
  if (clearing) return; // re-entrancy guard
  setClearing(true);
  try { /* ... */ } finally { setClearing(false); }
}
// Row: <NativeGroupedListRow icon="clearImageCache" onPress={...} title="Clear image cache" />
```

- Do not chase this with cache theories: expo-image's `clearMemoryCache` /
  `clearDiskCache` only touch SDImageCache (cover images) and have no code
  path to vector icons.

### HeroUI Community Surfaces (mobile)

- The community screens are composed with `heroui-native` primitives (`Card`, `Chip`, `Skeleton`, `Spinner`) over the app theme (`createThemedStyles`/`useAppTheme`); native navigation, virtualized/scroll containers, the rich-text editor, and the app-owned HTML renderer remain intentional exceptions (parent plan R9).
- **iOS color trap**: `use-platform-app-colors.ios.ts` sets both `accent` and `primaryContainer` to `systemPink`. Content placed on a `primaryContainer` background (selected board chips, score badges, icon boxes) must use `onPrimaryContainer` — never `accent`, which is invisible on iOS. This is a M3-filled pattern and it is theme-safe on Android too.
- Rank/highlight accents that must be identical across platforms are fixed hex literals (`#F59E0B`, `#FB7185`, `#60A5FA`); a `"${hex}26"` suffix gives the 15% alpha tint without dynamic-color alpha support.
- **Tabler icon naming differs from Material**: `IconDeviceGamepad2` (not `IconGamepad2`), `IconPin` (not `IconPushPin`), and there is no `IconForum` — use `IconMessages`. Verify against `dist/cjs/icons-list.cjs` before use.
- **Pinned filter toolbar**: the home filter bar (Sort/Time/Category pills) is pinned under the native navbar by making it data item 0 of the `FlatList` and passing `stickyHeaderIndices={[0]}`; the row renders itself with an opaque `background` surface and a hairline bottom border. Feed rows own their own horizontal padding so the pinned bar spans edge-to-edge. Row types are a discriminated union (`toolbar | thread | loading | error | empty`) so empty/error/skeleton states are data rows, not `ListEmptyComponent`.
- **Node unit tests cannot import modules that transitively import `react-native`** (e.g. `@tabler/icons-react-native`). Pure resolvers (board icon keys, count/time formatters) live in react-native-free modules (`community-board-icon-keys.ts`) with `.test.mjs` coverage; the UI wrapper (`community-board-icons.ts`) maps keys to components and stays out of the test graph.

### iOS Large-Title Scroll Ownership

- An Expo Router native-stack large title tracks the first native `UIScrollView` found down the screen's first descendant chain. Android's Compose `NativeScreenScaffold` does not exercise this UIKit behavior, so a hierarchy can appear correct on Android while the iOS title never collapses.
- Tab roots that use a large iOS title must put the primary vertical `ScrollView` directly inside `NativeScreenScaffold`, matching `HomeScreen`. Community Home deliberately uses that direct root scroll view rather than a `FlatList` composition with `ListHeaderComponent`, sticky data rows, and nested horizontal scroll views, which failed to establish reliable UIKit title coordination.

```tsx
// Wrong for this tab: iOS did not reliably bind the large title.
<NativeScreenScaffold title="Community">
  <View style={{ flex: 1 }}>
    <FlatList ListHeaderComponent={...} stickyHeaderIndices={[1]} />
  </View>
</NativeScreenScaffold>

// Correct: the native stack sees the vertical scroll owner immediately.
<NativeScreenScaffold title="Community">
  <ScrollView
    contentInsetAdjustmentBehavior="automatic"
    style={{ flex: 1 }}
  >
    {/* all Community Home content */}
  </ScrollView>
</NativeScreenScaffold>
```

- A Metro reload is enough for this JS hierarchy change in an existing development client; `expo run:ios` is only needed when native dependencies/configuration changed. Device/simulator behavior remains user-accepted unless UI automation was explicitly authorized.

### iOS 26 Fabric ScrollView Recycling and Navigation Chrome

#### 1. Scope / Trigger

- Applies to React Native 0.86 Fabric screens on iOS 26 when UIKit navigation
  owns a large title, search integration, or another view installed directly
  into an RN `UIScrollView`.
- Trigger signature: after a native-stack/NativeTabs screen has shown a large
  title, a later reader/window resize causes that exact title to appear inside
  an unrelated reader or root-stack ScrollView. The wrong title can persist
  across pushes even though every `UINavigationItem` remains correct.

#### 2. Signature

The compatibility contract lives in
`apps/mobile/modules/novella-ui/ios/NovellaFabricScrollViewRecyclingFix.m`:

```objc
// Installed on the RCTScrollViewComponentView metaclass before Fabric creates
// its component descriptor.
+ (BOOL)shouldBeRecycled; // returns NO
```

The installer resolves `RCTScrollViewComponentView` with `NSClassFromString`
and adds the class method through the Objective-C runtime only when React Native
does not already provide it. It must remain independent of React pod headers.

#### 3. Contracts

- iOS 26 may place `_UINavigationBarLargeTitleView` directly under
  `RCTEnhancedScrollView`, beside React Native's own container view. The
  underscored class name is diagnostic evidence only; production code must not
  inspect, remove, hide, or otherwise call private UIKit APIs.
- React Native 0.86's `RCTScrollViewComponentView.prepareForRecycle()` resets
  offset, zoom, inset, adjustment behavior, and frame, but it does not remove
  UIKit-owned sibling subviews. The default Fabric component descriptor is
  recyclable unless the class responds to `shouldBeRecycled` with `NO`.
- Therefore Novella disables cross-mount pooling for the Fabric ScrollView host.
  `FlatList` cell virtualization/reuse and ordinary scrolling remain enabled;
  only reuse of the outer native component between unrelated React mounts is
  disabled.
- The compatibility installer must use only `Foundation` and `objc/runtime`.
  Do not add a direct `React-RCTFabric` dependency to `NovellaUi`: Expo's
  precompiled React Core owns that dependency graph, and importing its C++
  headers from this module breaks ordinary builds with missing transitive Yoga
  headers.
- If a future React Native version supplies `shouldBeRecycled`, the installer
  leaves the upstream implementation untouched. Re-evaluate and remove this
  compatibility layer after confirming upstream also clears UIKit-owned
  subviews or opts ScrollView out of recycling.

#### 4. Validation / Error Matrix

| Condition | Required behavior |
|---|---|
| `RCTScrollViewComponentView` exists and has no recycling override | Add `shouldBeRecycled = NO` before Fabric descriptor creation |
| React class is unavailable | No-op; never crash app startup |
| Future React version already implements the selector | Do not replace or swizzle the upstream implementation |
| `pod install` after adding the fix | Podspec, Podfile.lock dependency graph, and Xcode project remain unchanged |
| UIKit large-title object appears under an unrelated ScrollView | Treat as host-view ownership/recycling evidence, not a wrong route title |

#### 5. Good / Base / Bad Cases

- Good: History's large-title view stays with History while reader and ranking
  rotate/resize; returning to History preserves its expanded/collapsed state.
- Base: ordinary lists continue to virtualize cells and restore offsets; the
  compatibility layer adds no JS listener, navigation mutation, or private API.
- Bad: hide inactive Tab headers, toggle `prefersLargeTitles`, move reader
  toolbars, or add z-order overlays. Those alter symptoms/state but cannot clean
  a UIKit-owned subview carried by a recycled Fabric host.
- Bad: infer a corrupted `UINavigationItem` from visible text alone. First log
  controller stacks/items and the actual large-title view identity and parent.

#### 6. Tests Required

- Run mobile type checking, `git diff --check`, ordinary `pod install`, the
  `NovellaUi` simulator build, and the full `Novella` simulator build.
- Native acceptance: cold launch; open History, book detail, and a reader;
  rotate or resize; return; open ranking; rotate again. Assert no History title
  appears in reader/ranking and History retains its own large-title state.
- When collecting temporary evidence, compare object identity and complete
  superview paths before changing UI. Remove all diagnostic views/loggers after
  the fault is classified.

#### 7. Wrong vs Correct

```objc
// Wrong: pulls React's precompiled C++ header graph into the local Expo module.
#import <React/RCTScrollViewComponentView.h>
// podspec: s.dependency 'React-RCTFabric'

// Correct: bounded runtime compatibility with no React header/pod dependency.
Class componentClass = NSClassFromString(@"RCTScrollViewComponentView");
Class metaClass = object_getClass(componentClass);
class_addMethod(metaClass, NSSelectorFromString(@"shouldBeRecycled"), fixIMP, "c@:");
```

> **Debugging lesson**: “reader + rotation reproduces the fault” identifies a
> trigger, not the owner of corrupted state. In this incident every root-stack
> item remained correct while one `_UINavigationBarLargeTitleView` object moved
> History → reader → History → ranking under different `RCTEnhancedScrollView`
> paths. That discriminating evidence rules out route-title, toolbar, header
> visibility, and blur ownership fixes and points to native host reuse.

### iOS Per-Route System Chrome

- This app uses Expo `StatusBar` / `RCTStatusBarManager` for app-wide and
  route-local status-bar icon contrast. Keep
  `UIViewControllerBasedStatusBarAppearance: false` in
  `apps/mobile/app.config.ts` under `ios.infoPlist`; the manager asserts when
  the key is true.
- Do not set a native-stack `statusBarStyle`: React Native Screens instead
  requires the same key to be true, so the two mechanisms cannot be mixed.
  A route that needs a local override (such as the forced-light comic reader)
  mounts `<StatusBar style="dark" />` within its scope and unmounts it on exit.
- Expo Router's bottom `Stack.Toolbar` portals items into
  `UINavigationController.toolbar`; it is not a descendant of the route's RN
  view and is distinct from the top `navigationBar`. A scoped interface-style
  view does not reach it automatically. The comic reader's
  `NovellaLightAppearanceScopeView` applies `.light` to that toolbar while
  mounted and restores the prior override on exit. Do not replace this with
  per-button tint patches or assume the top header trait covers both bars.
- `the generated local iOS project/Novella/Info.plist` is a generated local artifact. It may
  be refreshed for a local build, but `app.config.ts` is the persistent source
  used by future Expo prebuilds and CI.

### iOS Native Stack Material Contract

1. **Native ownership**: Expo Router's native `Stack` is the sole owner of every
   iOS navigation top-bar background. The shared preset in
   `apps/mobile/src/theme/stack-preset.ts` must use
   `isLiquidGlassAvailable()` once at module scope: Liquid Glass-capable iOS
   uses `headerTransparent: true` with no explicit blur effect; older iOS uses
   `headerBlurEffect: 'systemMaterial'`. Do not add an RN blur overlay, a
   replacement blur abstraction, or private UIKit API.
2. **Route overrides**: Route components may continue to set title, tint,
   content style, toolbar items, and reader header visibility. They must not set
   `headerBackground: () => null`, `headerBlurEffect: 'none'`, or unconditional
   iOS `headerTransparent: true` to recreate the native material. The parent
   stack preset must remain the source of the material and scroll-edge behavior.
3. **Scroll owners**: Ordinary iOS `ScrollView`, `Animated.ScrollView`, and
   `FlatList` instances must render directly beneath their screen/scaffold when
   a wrapper existed only to coordinate the removed imitation. Transfer any
   required `flex: 1` or scroll styling to the actual scroll owner; do not add a
   new marker, RN background, or loading wrapper just to control native edge
   effects. The native stack and UIKit scroll view own their own transition.
4. **Cleanup boundary**: Do not reintroduce `IosTopBarBackground`,
   `IosProgressiveBlur`, `IosScrollViewMarker`, `NativeScrollEdgeMarker`, or
   native registration/modifier code that exists solely to suppress or imitate
   the system material. Native search, reader progress, bottom-sheet, and
   Android Compose top-app-bar controls are separate contracts and remain
   registered and platform-scoped.
5. **Reader behavior**: Reader status-bar ownership remains with Expo
   `StatusBar`; `UIViewControllerBasedStatusBarAppearance` stays `false`.
   `chromeHidden` may control native header visibility, and reader toolbars,
   page controls, reflow overlays, and content scroll/paging behavior remain
   independent of the native header material. Do not re-add per-screen scroll
   listeners or visibility state for a top-bar overlay.
6. **Android boundary**: Android continues to use
   `NativeTopAppBarScaffold` and its Jetpack Compose implementation. Do not
   replace it with Stack blur options or change its OLED/theme behavior as part
   of an iOS header migration.
7. **Tests Required**: Run TypeScript/boundary checks, relevant feature tests,
   `git diff --check`, `pod install`, and Debug simulator builds for `NovellaUi`
   and `Novella`. Source searches must find no fake-blur, marker, native
   suppression, or disabling-header references. Native acceptance remains
   user-owned: after rebuilding the development client, check large-title and
   pushed routes, book-detail hero, announcement detail, reader chrome,
   light/dark appearance, and scroll-edge transitions on supported iOS versions.
8. **Wrong vs Correct**:

```tsx
// Wrong: shadows the shared native material with an app-owned imitation.
<Stack.Screen options={{ headerBackground: () => null, headerBlurEffect: 'none' }} />
<IosTopBarBackground />

// Correct: let the parent stack preset select UIKit material or Liquid Glass.
<Stack.Screen options={{ title, headerTintColor }} />
```

### Comment Infinite Scroll Pagination

- Keep mobile comment feeds on `FlatList.onEndReached`; do not replace the
  automatic trigger with page buttons.
- The mobile hook owns the next requested page. Do not derive that cursor only
  from a response `Page` field, because a Hub response may echo a default page
  value when the request includes the explicit comment batch size.
- Append pages by stable root-comment ID. A non-empty response may continue
  when `TotalPages` is stale, but a response that adds no new root IDs must
  terminate the continuation to prevent an endless repeated-page request loop.
- A failed append remains retryable at the same page, but must block automatic
  `onEndReached` retries until the user activates the inline retry control. A
  refresh failure keeps its existing page and uses the refresh action.

### Shared Comment Threads

#### Comic Comment Target Contract

1. **Scope / Trigger**: Comic detail, comment-list, compose, reply, and return-refresh flows must interoperate with Web-Master and share one comment namespace across every uploaded volume.
2. **Signatures**: `GetComments`, `PostComment`, and `ReplyComment` use `CommentTargetType = 'Series'` for comics. `bookId` remains the current volume route/theme identifier and is not the comment target ID.
3. **Contracts**: Comic requests send `{ Type: 'Series', Id: 0, SeriesTitle: <canonical series title> }`; novels send `{ Type: 'Book', Id: <positive book id> }`; announcements send `{ Type: 'Announcement', Id: <positive announcement id> }`. Visible comic detail titles continue to use the current volume's `book.title`; `seriesTitle` is a separate hidden route field. All internal comic entry points and version switches must preserve it. A direct comic route without the field resolves it through `GetComicSeriesByIds([bookId])`.
4. **Validation & Error Matrix**: `Series` with nonzero `Id` is invalid; `Series` with a blank/missing title is invalid; `Book`/`Announcement` with a nonpositive ID is invalid; an explicitly unknown route `commentType` is rejected rather than falling into `Book`. An omitted legacy `commentType` may resolve to `Book`.
5. **Good/Base/Bad Cases**: Good: different upload versions display their own titles but read/write `Series:0:<same title>`. Base: novels retain `Book:<id>`. Bad: using `Book:<volume id>` for comics, using a volume title as `SeriesTitle`, or silently falling back from a malformed series route.
6. **Tests Required**: Assert route target mapping, cross-series refresh-key isolation, canonical title resolution from a volume ID, client-core validation, and exact SignalR payloads for get/post/reply. Device acceptance posts from mobile and confirms visibility on Web, then posts on Web and confirms visibility on mobile.
7. **Wrong vs Correct**:

```ts
// Wrong: isolates each uploaded comic volume from Web and other versions.
{ type: 'Book', id: volumeId }

// Correct: one Web-Master-compatible comment namespace for the series.
{ type: 'Series', id: 0, seriesTitle: canonicalSeriesTitle }
```

- Book comments and Community thread replies share `CommentThreadRow` and `CommentThreadChildren` from `apps/mobile/src/components/comment-thread.tsx`. Screens adapt their palette and domain model; they do not duplicate avatar/name/content/time/reply/delete/like row geometry.
- The shared component owns Tabler action icons, touch targets, top-level/child spacing, the nested reply guide, accessibility state, and highlight presentation. Book comments enable reply/delete. Community enables reply/like, author badges, deleted-author display, pagination controls around the shared rows, and notification-target highlighting.
- Palette adapters must preserve `ColorValue` objects. Never call `String(colors.accent)` on iOS dynamic colors; pass the color object through and use a type cast only at vector-icon type boundaries.

### Book-detail quick-search contract

- Keep Flutter-parity search target resolution in the React-Native-free service
  `apps/mobile/src/services/book-quick-search.ts`, not in Hero or settings
  components. Its core contracts are:

  ```ts
  resolveSeriesSearchKeyword(classification, category, mode): string | null
  resolveBookQuickSearch(book, 'title' | 'author', mode):
    { query: string; mode: BookSearchMode } | null
  resolveTagQuickSearch(tag): { query: string; mode: 'tags' } | null
  ```

- `SeriesSearchMode` is `system | original | display`, persisted as the
  `seriesSearchMode` field in the device-local `AppSettings` object. Missing or
  invalid stored values must resolve to `system`. The detail screen must read
  the setting through `useAppSettings()` so a mounted screen responds to a
  setting change without refetching its `BookDetail`.
- The title target uses `mode: 'name'` when a configured series name exists,
  and otherwise uses the trimmed book title with `mode: 'fuzzy'`. Author and tag
  targets must be trimmed and empty values must produce no navigation. Search
  route params include `format: 'Novel' | 'Comic'` based on the detail format.
- Detail quick-search uses a root-stack route instead of pushing the nested
  Search tab route; otherwise Expo Router may mount a second NativeTabs tree and
  delay the transition. Keep the Search tab route for tab entry, but share the
  route adapter/screen implementation.
- A routed initial query is an interactive search, not an idle screen: render
  loading/skeleton state before the hook commits the query, and never await
  `saveSearchHistory()` before starting the network request. History projection
  is synchronous and persistence is fire-and-forget; only a completed request
  may render “no results”. Merge late-loaded old history with the optimistic
  route query rather than replacing it.
- On Android, a collapsible Hero that is a visual overlay above a scroll view
  must use `pointerEvents="box-none"` on the overlay/flexible background and
  visual-only layers must not intercept touches. Only title/author Pressables
  should consume the event; otherwise the overlay makes both quick search and
  ordinary scrolling unreliable. Tag sheets replace the sheet route with the
  search route so Back returns to detail rather than reopening the sheet.
- Pure resolver edge cases require `.test.mjs` coverage for original/display/
  system precedence, Japanese-category aliases, missing/blank fallbacks,
  invalid settings, tags, and route format. Actual iOS/Android hit routing and
  native sheet back-stack behavior remain manual acceptance checks.

```tsx
// Wrong: screen-specific parsing and an untyped default can drift from Flutter.
const query = book.classification.seriesNameCn || book.title;
router.push({ pathname: '/search', params: { query } });

// Correct: use the shared resolver and the existing typed search contract.
const target = resolveBookQuickSearch(book, 'title', settings.seriesSearchMode);
if (target) {
  router.push({
    pathname: BOOK_SEARCH_ROUTE,
    params: toBookSearchRouteParams(target, format),
  });
}
```

### Android Compose Bottom-Sheet Background Ownership

- The native Compose `BottomSheet` is the only owner of the sheet's base
  surface color. Pass the resolved app/book surface as its `containerColor`.
  Keep `RNHostView`, its wrapper `View`, and Android RN screen roots
  transparent; cards, inputs, selected rows, and WebView documents may still
  paint their own semantic child surfaces.
- Do not set `backgroundColor` on the hosted RN root to match the Compose
  surface. `RNHostView(matchContents = false)` fills the available sheet height,
  while `matchContents = true` uses the Yoga child's intrinsic height. Opaque
  hosted roots therefore become differently sized platform-view rectangles:
  full-height for partial/expandable sheets and content-height for compact
  sheets. Those rectangles can escape the expected native shape/translation
  and look like an extra opaque scrim.
- Shared iOS/Android sheet screens may keep their iOS root background using a
  platform condition. On Android, rely on the native surface behind the
  transparent RN root.
- Android sheet routes use Expo Router `transparentModal` only as the route
  carrier. The custom Compose `Dialog` owns modal dimming. Do not replace the
  route with an opaque modal to hide a hosted-view background bug.

```tsx
// Wrong: the hosted Android view becomes an opaque rectangle sized by RNHostView.
<RNHostView matchContents={fitToContents} style={{ backgroundColor: containerColor }}>
  <View style={{ backgroundColor: containerColor }}>{children}</View>
</RNHostView>

// Correct: Compose paints one shaped surface; hosted RN content stays transparent.
<NativeBottomSheetView containerColor={containerColor}>
  <RNHostView matchContents={fitToContents}>
    <View>{children}</View>
  </RNHostView>
</NativeBottomSheetView>
```

### Android Compose IME Ownership

- Material 3's state-based collapsed `SearchBar` intentionally suppresses the
  software keyboard; it expects the same input to be rendered by an
  `ExpandedFullScreenSearchBar` or `ExpandedDockedSearchBar`. Novella keeps
  search results in React Native, so its always-editable native search field
  uses `DockedSearchBar` and passes the same `TextFieldState` and
  `SearchBarState` to `SearchBarDefaults.InputField`.
- Do not combine a state-based `SearchBar` with the deprecated InputField
  overload fixed at `expanded = false`. That overload clears focus after the
  field asks to expand, while the collapsed state-based container also blocks
  the IME.
- An edge-to-edge Compose `Dialog` (`decorFitsSystemWindows = false`) owns a
  window separate from `MainActivity`. Activity `adjustResize` and an RN
  `ScrollView`'s keyboard-inset behavior cannot keep the native dialog above
  the IME. Apply `imePadding()` to the dialog's full-screen layout boundary
  before measuring bottom-sheet anchors and hosted RN content; do not also pad
  the child sheet unless a device test proves an independent inner inset is
  needed.
- Native verification requires `:novella-ui:compileDebugKotlin`. Device
  acceptance must cover search focus/typing/submission and opening, hiding, and
  reopening the IME in both fit-to-content comment sheets and partially
  expanded sheets.

```kotlin
// Wrong: collapsed SearchBar disables the IME, and fixed false expansion clears focus.
SearchBar(state = searchBarState, inputField = {
  SearchBarDefaults.InputField(
    state = textFieldState,
    expanded = false,
    onExpandedChange = {},
    onSearch = onSearch
  )
})

// Correct for Novella's inline field; search results remain in the RN list.
DockedSearchBar(
  expanded = false,
  onExpandedChange = {},
  inputField = {
    SearchBarDefaults.InputField(
      textFieldState = textFieldState,
      searchBarState = searchBarState,
      onSearch = onSearch
    )
  }
) {}

Dialog(
  properties = DialogProperties(decorFitsSystemWindows = false),
  onDismissRequest = onDismissRequest
) {
  Box(Modifier.fillMaxSize().imePadding()) {
    BottomSheet(/* ... */)
  }
}
```

### iOS Reader Native Title Sizing

- A custom iOS `headerTitle` must constrain the **outer title view**, not only a child `GlassView` or `Text`. `UINavigationItem.titleView` may measure a custom child by its intrinsic title width, so a child-only `maxWidth` does not prevent overlap with native back/toolbar items.
- Use an explicit window-width-derived title slot with a conservative reservation for the native back button and every right toolbar item. Keep the glass and text inside that slot with `overflow: 'hidden'`; render one line with `ellipsizeMode="tail"` and `numberOfLines={1}`.
- No public JS API exposes the exact runtime frames of UIKit navigation-bar items. Do not use private UIKit APIs or responder-stealing overlays to measure them; a conservative slot is the supported boundary.

```tsx
// Wrong: the native title view can still measure to the full title width.
<GlassView style={{ maxWidth: 244 }}>
  <Text numberOfLines={1}>{title}</Text>
</GlassView>

// Correct: constrain the title view itself, then clip its contents.
<View style={{ width: titleWidth, overflow: 'hidden' }}>
  <GlassView style={{ width: '100%', overflow: 'hidden' }}>
    <Text numberOfLines={1} ellipsizeMode="tail">{title}</Text>
  </GlassView>
</View>
```

### Skia Reader Font and Mode-Switch Safety

- A required reader WOFF2 must be loaded from the canonical `readerFontFile()` bytes and passed directly to `Skia.Typeface.MakeFreeTypeFaceFromData()`. Do not invoke a JS Brotli/WOFF decoder, create an intermediate TTF/OTF buffer, silently replace a failed required font with the system font, or emit payload diagnostics in production code. Propagate direct-loading failures to the reader error state; release the temporary `SkData` wrapper after Skia takes ownership of the typeface data.
- Scroll-mode tiles must keep each native Skia Canvas below the bounded drawable height (`4096pt` maximum). If a single image or paragraph crosses a tile boundary, include it in each intersecting tile and rely on the tile's clipping so the content remains continuous without one giant Metal texture.
- During reader mode changes, detach the old Skia `FlatList` before mounting the new mode's list. The reflow overlay may remain visible while the old Canvas surfaces unmount; change the mode on a later frame to avoid overlapping old/new Metal drawables.

## Review Checklist

- No platform imports under `packages/*`.
- No API payload parsing inside screens or controls.
- All interactive controls have labels and disabled/loading behavior.
- Error UI uses sanitized domain errors and never renders credentials,
  request bodies or response bodies.
- Layout is checked on compact and large phone widths for mobile, and narrow
  and wide viewports for the website.

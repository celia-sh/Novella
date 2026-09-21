# Complete Book System Plan

## Product decisions

1. Novels and comics are equal-priority formats. Every delivery phase that owns
   catalog, search, detail, library, history, comments, or reading must ship and
   verify both formats together.
2. Web-Master owns current backend operations and data semantics. Flutter owns
   mobile hierarchy, gestures, sheets, drag behavior, loading states, and cover
   continuity where it has a corresponding feature.
3. Flutter has no complete comic system; comic business behavior comes from
   Web-Master and receives a native mobile interaction treatment consistent with
   the Flutter novel surfaces.
4. Gist-backed/local book marks are removed: no `toRead`, `reading`, `finished`,
   “read” chip/filter, mark long-press, mark sheet, `book_mark_*` storage, Gist
   warning, or replacement local-only mark system.
5. Shelf membership, reading history, canonical reader position, and local
   reader settings remain four independent domains.
6. Reader-facing book management is in scope. Publishing, book/chapter editing,
   comic image upload, collaborator administration, and other authoring/admin
   flows remain deferred.
7. Current implementation boundary: only synchronized **comic shelf**
   membership/management is temporarily deferred while its backend identity and
   round trip remain unproven. Comic discovery, search, series detail, comments,
   history, and reading remain equal-priority requirements and must not be
   described or implemented as deferred.

## Target capability matrix

| Surface | Novel | Comic | Shared requirement |
| --- | --- | --- | --- |
| Home | Continue Reading, recently updated, rank preview | Continue Reading and recently updated at equal prominence; rank only after a real contract exists | Independently loadable modules, user ordering/filter settings, retry/empty/stale states |
| Discovery | Flat volumes, grouped series, series drill-in; latest/new/view | Series cards; latest/new/view | Native paged/infinite mobile lists, pull refresh, cover continuity |
| Search | fuzzy/exact/title/author/name/tags | Same mode model forwarded to comic search | Novel/Comic tabs, route-backed query/mode/tab, local search history, stale-request guards |
| Ranking | daily/weekly/monthly `GetRank` | Add/confirm a true comic periodic-rank operation; never substitute all-time view sorting | Tabs, refresh, pagination/reveal behavior, filters, clear unavailable capability messaging during contract work |
| Detail | Volume metadata, chapters, tags, uploader, shelf, Book comments | Series metadata, uploaded volumes, uploaders, grouped chapters, shelf, Series comments | Flutter-quality collapsible header, cover handoff, loading/error/empty, resume/start |
| Shelf | Unified mixed-format library | Unified mixed-format library after fixture proof | Root/nested folders, edit transaction, create/rename/delete, batch select/delete/move, sibling reorder, save/cancel |
| History | Novel IDs hydrated as volumes | Comic volume IDs hydrated and deduplicated as series | Equal tabs, groups of 24, refresh, empty/error/retry, all-or-nothing clear |
| Reader | Native HTML scroll/paged | Native image vertical/horizontal | One canonical server progress protocol, chapter navigation, lifecycle save, cache/retry/cancellation |

## Required backend/API contract work

### Missing typed operations

- Novel: `GetBookList`, `GetSeriesList`, `GetBooksBySeries`, all six search
  operations, `GetRank`, captured `GetNovelContent` fixture.
- Comic: `GetComicList`, `SearchComicSeries`, `GetComicSeriesInfo`, typed
  `{Ids, Type:'Comic'}` hydration, and a real comic ranking operation if product
  requires periodic ranks.
- Shared: `GetReadHistory`, `ClearReadHistory`, complete comment fixtures,
  shelf legacy/current fixtures, and exact failure envelopes.

### Comic shelf gate

Web-Master proves that comics use the physical `GetBookListByIds` Hub method
for history when `Type:'Comic'` is supplied, but does not prove synchronized
shelf support. Before exposing comic shelf actions, capture and test:

1. `SaveBookShelf` with a comic candidate ID;
2. `GetBookShelf` read-back;
3. `{Ids}` versus `{Ids,Type:'Comic'}` hydration;
4. comic series ID/title versus uploaded volume ID identity;
5. mixed novel/comic folders, invalid IDs, and nested paths.

The target product is one unified mixed-format shelf. If the current server
cannot round-trip the required identity, add a backward-compatible shelf media
identity contract and migrate old `20220211` novel-only records. Do not use the
browser-local manga “following” prototype as a fallback.

### Whole-document shelf semantics

The only server shelf mutations remain `GetBookShelf` and
`SaveBookShelf({data,ver})`. Do not invent granular server RPCs. Confirm
concurrent-device/last-write behavior before promising offline editing. A failed
save retains the draft and exposes retry/discard; it must not silently claim
success.

## Architecture

### `packages/api-client`

- Own discriminated novel-volume, novel-series, comic-series, comic-volume,
  shelf, history, comments, and reader DTO decoders.
- Expose separate typed functions for novel and comic hydration even where the
  physical Hub method name is shared.
- Normalize empty/null/date/enum fields at the boundary and preserve comic
  `seriesTitle`, uploaded `bookId`, and `chapterId` as distinct identities.
- Add captured fixture tests for good/empty/malformed/auth/offline envelopes.

### `packages/client-core`

Add platform-neutral use cases/repositories for:

- paged novel/comic discovery and search;
- novel/comic series detail and resume projection;
- dual-format history hydration and clear;
- comments by typed target (`Book` ID or `Series` title);
- a shelf repository with cached/main snapshots, refresh/save serialization,
  legacy migration, invalid-entry projections, and media-aware hydration;
- a pure shelf draft editor with commands and selectors.

Shelf editor commands:

```text
beginEdit / cancelEdit / saveEdit
createFolder / renameFolder / deleteFolder
select / clearSelection / removeSelection
moveBooks(destinationPath)
reorderSiblings(parentPath, orderedItemKeys)
addBookToRoot / removeBookGlobally
```

Core validates full parent paths, unique trimmed folder names, book-only
cross-folder moves, sibling-only reorder, index compaction, and preservation of
unknown/deeper legacy paths. Screens never mutate raw shelf documents.

### `apps/mobile`

- Hooks own request generations, route focus refresh, and screen-specific
  loading/error state while consuming typed use cases.
- Screens own transient selection, sheet visibility, gesture coordinates, and
  navigation only.
- Continue using native novel/comic renderers and shared cover/progress systems.
- Add interaction tests around hooks/state reducers and device smoke matrices;
  current mobile typecheck alone is insufficient.

## Shelf mobile interaction contract

### Modes

```text
Browse -> Edit -> Sort
```

- Browse: book opens the correct novel/comic detail; folder opens recursively.
- Root Edit: books and folders may be selected. Nested Edit: direct books only;
  folder taps are inert.
- Sort: no selection, all card taps/preview/Hero behavior disabled, drag overlay
  visible, cancel/confirm rules match Flutter.
- Save persists the whole draft. Cancel discards it. Leaving with dirty edits
  requires an explicit discard confirmation.

### Folder and batch management

- Root-only create/rename with keyboard-aware native sheets and validated names.
- Delete uses an explicit destructive confirmation. Business semantics follow
  Web-Master: deleting a folder moves contained books to root/end before removing
  the folder unless backend/product explicitly changes that rule.
- Move is book-only and uses a draggable destination sheet showing complete
  breadcrumb paths. Nested move includes root and excludes the current folder.
- Invalid/deleted book IDs remain visible as unavailable entries and can still
  be selected/removed.

### Drag/reorder

- Explicit Sort mode only.
- 180 ms long-press activation.
- Fixed three-column mixed book/folder grid.
- Reorder only among siblings in the exact current parent path.
- No drag into folder, no cross-folder drag, no folder move.
- Cross-folder book movement remains sheet-driven.
- No invented haptics; Flutter calls no haptic API here.
- Start with existing Gesture Handler + Reanimated. Build a bounded
  `ReorderableShelfGrid` spike before adding a dependency. Validate edge
  scrolling, interruption/cancel, accessibility reorder actions, large folders,
  and Android/iOS parity. Add a library only if it supports grid reorder and the
  exact activation/scroll contract without implicit cross-container behavior.
- Accessibility provides Move before/after actions so reorder is not
  drag-exclusive.

## Detail and navigation contract

- Every list/history/search/rank source passes exact initial cover/title and a
  stable transition identity into detail.
- Novel detail keeps Book comments; comic series detail uses Series comments.
- Comic series detail must not be the current single-volume `GetComicInfo`
  screen: it owns series metadata, volumes/uploaders, chapter groups, and
  most-recent resume resolution.
- Shelf membership loads independently from public detail; shelf/auth failure
  cannot fail the whole detail page.
- Empty explicit author is omitted. Classification metadata remains separate.
- Remove all stale mark chip/filter/sheet/long-press/Gist-warning requirements
  from existing Flutter parity documents and implementation checklists.

## Delivery plan

### Phase 0 — Contract fixtures and decisions

- Capture all missing novel/comic/shelf/history/comments fixtures.
- Prove or extend comic shelf identity and mixed-folder round trip.
- Decide/implement a true comic periodic ranking contract; do not fake parity.
- Define shelf concurrent-save and failed-draft behavior.

**Gate:** no synchronized comic shelf or comic ranking UI before fixtures pass.

### Phase 1 — Shared models and repositories

- Add all missing API decoders/operations and tests.
- Build paged catalog/search/history use cases.
- Build shelf repository, migration, pure editor, selectors, and serialization
  tests including mixed formats and nested paths.
- Decouple detail from shelf availability.

### Phase 2 — Equal-priority discovery and search

- Ship novel flat/series discovery and comic series discovery together.
- Ship Novel/Comic search tabs with all modes, history, pagination, filters,
  stale guards, and quick-search entry points.
- Add both formats to Home at equal prominence.
- Ship novel and contract-backed comic ranking together; otherwise keep the
  overall phase open rather than calling the book system complete.

### Phase 3 — Equal-priority details/comments

- Finish Flutter parity for novel detail.
- Replace the comic volume-only detail with complete series detail while
  retaining uploaded-volume identity for reading/progress.
- Generalize comments routes/hooks to Book and Series targets.
- Add shelf actions only after Phase 0 comic shelf proof.

### Phase 4 — Complete shelf management

- Cached root/nested browse and media-aware hydration.
- Browse/Edit/Sort state machine and native toolbar actions.
- Create/rename/delete sheets, selection/action sheet, move destination sheet.
- 180 ms sibling grid drag/reorder plus accessible reorder alternatives.
- Save/cancel/dirty-exit/failure retry and whole-document persistence.

### Phase 5 — Dual-format history and resume

- Replace placeholder with equal Novel/Comic tabs.
- Hydrate IDs in groups of 24; deduplicate comic series correctly.
- Add refresh, load-more, unavailable entries, empty/error/retry, and clear-all
  confirmation/failure feedback.
- Verify history, shelf, and reader progress remain independent.

### Phase 6 — Reader/system hardening

- Complete novel long-block/image/device verification.
- Add comic batch/page retry, cancellation, RTL, and memory tests.
- Verify auth expiry, foreground/background, stale responses, cache clearing,
  deep links, compact/large devices, reduced motion, and accessibility.

## Verification matrix

- API fixtures: all operation request shapes and response/error variants.
- Shelf pure tests: migration; add/remove; create/rename/delete; selection
  impact; move; reorder; nested paths; index normalization; invalid IDs; mixed
  novel/comic; failed/concurrent saves.
- Hook/use-case tests: pagination, request generation, refresh preservation,
  independent detail/shelf errors, comic resume selection, history dedupe.
- Interaction tests: every Browse/Edit/Sort transition, sheets/dialogs,
  drag cancel/drop/edge scroll, accessibility reorder, dirty exit.
- Device matrix: Android/iOS, compact/large phone, light/dark/OLED, reduced
  motion, cold/warm cache, offline/stale/auth-expired.

## Completion criteria

The book system is complete only when novels and comics both have production
catalog, search, detail, comments, unified shelf management, history, and
reader entry/resume flows; every surface has loading/error/empty/retry states;
shelf drag/edit behavior passes Android/iOS interaction tests; and no abandoned
Gist/book-mark state or UI remains.

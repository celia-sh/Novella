# RN complete-book system gap audit

## Audit boundary and verdict

This document audits the **current uncommitted worktree**, including untracked
Expo reader files, against:

- `research/web-complete-book-system-reference.md` — business behavior, routes,
  operations, and DTO authority.
- `research/flutter-complete-book-system-reference.md` — mobile interaction and
  presentation authority, subject to its explicit exclusion ledger.

The current branch is not just a shell: novel detail/comments, shelf browsing,
and native novel/comic reader baselines exist. It is nevertheless far from the
complete Web-Master book system. Search, ranking, novel series discovery, comic
series discovery/detail, history, and shelf editing are absent. Comic shelf
support remains contract-blocked, not merely UI-incomplete.

Status terms:

- **Implemented** — current route, contract, use case, and usable screen exist.
- **Partial** — a meaningful vertical slice exists but misses reference
  behavior or contract coverage.
- **Absent** — no current route/use case/operation for the capability.
- **Blocked** — source evidence is insufficient; implementation must wait for
  fixtures or backend confirmation.

The Web audit requires equal-priority novel/comic discovery, detail, history,
and reading while explicitly acknowledging asymmetric ranking and shelf
contracts (`research/web-complete-book-system-reference.md:588-599`). Flutter
supplies no comic contract (`research/flutter-complete-book-system-reference.md:176-182`).

## Current route and composition inventory

The native tab shell exposes Discover, Shelf, History, Community, and Settings
(`apps/mobile/src/app/(tabs)/_layout.tsx:11-45`). The root stack registers one
polymorphic numeric book route, novel book comments/compose/info sheets, one
polymorphic reader route, and reader chapter/footnote sheets
(`apps/mobile/src/app/_layout.tsx:49-159`). There are no search, ranking, novel
series, comic series, or dedicated history-detail routes.

| Surface | Current route and screen | Current hook/service/use case | Assessment |
| --- | --- | --- | --- |
| Discover | `(tabs)/(discover)/index` renders `HomeScreen`; the nested stack contains only `index` (`apps/mobile/src/app/(tabs)/(discover)/_layout.tsx:8-17`; `apps/mobile/src/screens/home-screen.tsx:31-72`). | `useDiscovery` independently loads latest books, announcements, and online info (`apps/mobile/src/hooks/use-discovery.ts:32-148`); `DiscoveryUseCase` exposes only those three sections (`packages/client-core/src/index.ts:77-88,387-407`). | **Partial, novel-oriented home only.** |
| Novel detail | `/book/[id]` defaults to `BookDetailScreen` (`apps/mobile/src/app/book/[id].tsx:7-35`). | `useBookDetail` loads detail, shelf membership, and cached progress together, then subscribes to progress (`apps/mobile/src/hooks/use-book-detail.ts:26-84`). | **Partial/strong baseline.** |
| Comic detail | The same `/book/[id]` dispatches on a route `type=Comic` hint to `ComicDetailScreen` (`apps/mobile/src/app/book/[id].tsx:7-27`). | Screen calls `ReaderUseCase.loadComicInfo` directly (`apps/mobile/src/screens/comic-detail-screen.tsx:26-45`). | **Partial uploaded-volume detail, not Web comic-series detail.** |
| Shelf | `(tabs)/(shelf)/shelf` renders `ShelfScreen` (`apps/mobile/src/app/(tabs)/(shelf)/shelf.tsx:1-5`). | `useShelf` only loads/reloads `ShelfUseCase` (`apps/mobile/src/hooks/use-shelf.ts:14-50`). | **Partial browse-only.** |
| History | `(tabs)/(history)/history` renders `PlaceholderScreen` (`apps/mobile/src/app/(tabs)/(history)/history.tsx:1-10`). | None. | **Absent.** |
| Community | Community is a placeholder despite mentioning comments (`apps/mobile/src/app/(tabs)/(community)/community.tsx:1-10`). | Book comments are instead reached from novel detail. | **Broader community absent.** |
| Novel comments | `/book/[id]/comments` and `/book/[id]/comment-compose` are registered (`apps/mobile/src/app/_layout.tsx:50-68`). | `useComments` plus `CommentsUseCase` load/post/reply/delete (`apps/mobile/src/hooks/use-comments.ts:23-100`; `packages/client-core/src/index.ts:102-107,463-485`). | **Partial, Book target only.** |
| Readers | `/reader/[bookId]/[sortNum]` dispatches on `type=Comic` to native comic or novel readers (`apps/mobile/src/app/reader/[bookId]/[sortNum].tsx:7-19`). | One `ReaderUseCase` owns novel content, comic info/content, and server position writes (`packages/client-core/src/index.ts:94-100,421-460`). | **Partial but substantial.** |

## Feature-gap matrix

| Capability | Web/Flutter contract | Current Expo/shared implementation | Gap and required next seam |
| --- | --- | --- | --- |
| Novel latest/home | Web home latest is novel-only; Flutter has Recently Updated and rank modules (`research/web-complete-book-system-reference.md:20-34`; `research/flutter-complete-book-system-reference.md:120-135`). | `GetLatestBookList` is typed and decoded (`packages/api-client/src/index.ts:449-453,543-555`); Home renders at most the returned grid with independent loading/error/empty states (`apps/mobile/src/screens/home-screen.tsx:78-131,218-255`). | **Partial.** Add Continue Reading, configured module ordering/filter invalidation, full recently-updated route/pagination, and ranking module. Do not call the current home equal-format discovery. |
| Novel flat/series discovery | Web requires flat list, grouped series, and series-volume drill-in with latest/new/view order (`research/web-complete-book-system-reference.md:69-76,151-176`). | No route beyond Discover index; API has no `GetBookList`, `GetSeriesList`, or `GetBooksBySeries`. Current shared discovery surface ends at three home calls (`packages/client-core/src/index.ts:77-88`). | **Absent.** Add decoded list/series DTOs, operations, paged use cases, routes, stale-request guards, and screens. |
| Comic discovery | Web requires `GetComicList` series cards ordered latest/new/view (`research/web-complete-book-system-reference.md:77-81,169-176`). | `BookListItem` can carry `type` and `seriesTitle` (`packages/api-client/src/index.ts:200-224`), and grids forward `type` into navigation (`apps/mobile/src/screens/home-screen.tsx:218-251`), but no comic-list operation/use case/route exists. | **Absent.** Add a distinct `ComicListPage`/series-card contract and dedicated discovery route. A type-aware novel list decoder is not comic discovery parity. |
| Search | Web has Novel/Comic tabs and six modes; Flutter preserves local history, exact-mode promotion, 24-result pages, and detail quick-search (`research/web-complete-book-system-reference.md:80-87,178-193`; `research/flutter-complete-book-system-reference.md:137-143`). | No route, screen, hook, search DTO, search mode, API operation, use case, or tests. Detail tag/title/author surfaces do not navigate to search. | **Absent.** Add one shared six-mode model, distinct novel/comic result DTOs, serializable query/tab/mode route state, local search history, request generations, and paged UI. Keep comic `Mode` decoder tolerant until fixtures prove narrowing. |
| Ranking | Web exposes novel `GetRank({Days:1|7|31})`; no periodic comic ranking exists (`research/web-complete-book-system-reference.md:164-176,194-208`). Flutter defines day/week/month interaction (`research/flutter-complete-book-system-reference.md:145-150`). | No rank route, DTO, operation, use case, hook, screen, or test. | **Novel absent; comic contract unavailable.** Implement novel periodic ranking. Present comic ranking as unavailable or obtain a backend operation; never substitute `GetComicList({Order:'view'})`. |
| Novel detail | Web detail includes metadata, chapters, resume, shelf, Book comments, tags, and uploader (`research/web-complete-book-system-reference.md:210-234`). Flutter supplies the collapsible mobile detail contract (`research/flutter-complete-book-system-reference.md:152-160`). | `BookDetail`, `GetBookInfo`, and decoder exist (`packages/api-client/src/index.ts:275-294,569-570,874-903`). The screen has collapsible native presentation, shelf toggle, introduction, metadata, resume/start, and chapters (`apps/mobile/src/screens/book-detail-screen.tsx:70-128,216-344`). | **Partial/strong.** Hard coupling `Promise.all(GetBookInfo, GetBookShelf, cache)` means a shelf/auth failure can fail the whole detail (`apps/mobile/src/hooks/use-book-detail.ts:34-68`); shelf membership should degrade independently. Search links and remaining parity/device states are open. |
| Comic series/detail | Web route identity is `seriesTitle`; response groups series metadata, uploaded books/volumes, uploaders, chapter groups, resume, and Series comments (`research/web-complete-book-system-reference.md:78-81,210-234`). | Current DTO/operation is only numeric uploaded-volume `ComicInfo`/`GetComicInfo` (`packages/api-client/src/index.ts:336-374,589-601`). `ComicDetailScreen` shows one volume’s cover/introduction/chapters and starts its reader (`apps/mobile/src/screens/comic-detail-screen.tsx:61-103`). | **Major gap.** Add `ComicSeriesInfo`, `GetComicSeriesInfo({SeriesTitle,Order})`, a series-title route, volume identity preservation, per-volume resume reconciliation, Series comments, and explicit no-chapters state. Do not rename current volume screen “series detail.” |
| Novel shelf membership | Web uses whole-document `GetBookShelf`/`SaveBookShelf`; detail add/remove is root/global (`research/web-complete-book-system-reference.md:399-465`). | API decodes/encodes shelf and whole-document operations (`packages/api-client/src/index.ts:226-250,644-666,824-845`). Core `contains` and `toggleBook` refetch the document, insert at root, normalize, and save (`packages/client-core/src/index.ts:488-535`). Novel detail exposes the toggle (`apps/mobile/src/screens/book-detail-screen.tsx:216-260`). | **Partial.** No local-first repository, migration, conflict policy, mutation serialization, or shelf contract tests. `contains` should not require a separate remote shelf fetch for each detail load. |
| Shelf folders/browse | Web model is a versioned flat tree with full `parents` path and sibling `index`; Flutter recursively browses full paths (`research/web-complete-book-system-reference.md:401-440`; `research/flutter-complete-book-system-reference.md:9-23`). | Current DTO mirrors BOOK/FOLDER records. Screen filters exact parent paths, recursively pushes IDs in local state, shows direct previews/counts, and preserves unavailable book tiles (`apps/mobile/src/screens/shelf-screen.tsx:69-145,196-223`). | **Partial browse-only.** Add stable routed/breadcrumb path behavior, demand-driven hydration, refresh preservation, and selectors in core. Existing deep documents must remain representable. |
| Shelf drafts/edit/sort | Web has `main` and `draft` with cancel/save; Flutter has explicit Browse/Edit/Sort modes and selection rules (`research/web-complete-book-system-reference.md:428-440,442-478`; `research/flutter-complete-book-system-reference.md:48-65`). | `ShelfUseCase` exposes only `contains/load/toggleBook` (`packages/client-core/src/index.ts:109-120`). `ShelfScreen` owns only a browse `parents` array and refresh (`apps/mobile/src/screens/shelf-screen.tsx:19-64`). | **Absent.** No draft, enter/cancel/save edit, selection, sort, create, rename, delete, move, or reorder exists. |
| History | Web returns `{Novel:number[],Comic:number[]}`, hydrates each format differently, pages IDs by 24, and clears all (`research/web-complete-book-system-reference.md:531-549`). Flutter requires explicit loading/error/retry/empty and all-or-nothing clear (`research/flutter-complete-book-system-reference.md:145-150`). | Placeholder route only; there are no DTOs, `GetReadHistory`, `ClearReadHistory`, use case, hook, hydration, clear action, or tests. Reader-position cache is a separate domain and must not be presented as history. | **Absent.** Add exact history DTO/ops, format tabs, novel volume and comic-series hydration, deduplication, ID-page cursor, empty/retry/clear states. |
| Comments | Web supports Book, Announcement, and Series targets with normalized user/comment maps (`research/web-complete-book-system-reference.md:361-380`). | API types all target names and decodes nested comments (`packages/api-client/src/index.ts:382-430,617-641,967-1020`). Screen has pagination, empty/error, nested replies, compose, and deletion (`apps/mobile/src/screens/book-comments-screen.tsx:34-146,153-258`). | **Partial.** Mobile hooks hard-code `type:'Book'` (`apps/mobile/src/hooks/use-comments.ts:23-100`; `apps/mobile/src/hooks/use-comment-submission.ts:10-38`). Add a typed target object to routes/hooks, Series comments on comic detail, Announcement comments where scoped, and captured payload fixtures before trusting inferred map fields. |
| Novel reader | Web requires HTML content, chapter navigation, settings, dynamic font, local/server XPath progress; Flutter is the native interaction source (`research/web-complete-book-system-reference.md:236-295`). | DTO/API/use case exist (`packages/api-client/src/index.ts:296-320,573-587`; `packages/client-core/src/index.ts:94-100,421-460`). Native screen normalizes blocks, supports scroll/paged lists, measured page plans, font/footnotes/images, preload, chapter sheets, lifecycle saves, and request generations (`apps/mobile/src/screens/reader-screen.tsx:68-176,233-340,373-578`; `apps/mobile/src/hooks/use-reader-chapter.ts:18-97`). | **Partial/advanced WIP.** Keep hardening long-block pagination, image memory/device behavior, stale/error states, and transport cancellation. API tests still lack a captured `GetNovelContent` fixture/operation test. |
| Comic reader | Web requires 12-page batches, stale guards, page windowing, vertical/horizontal modes, mobile single page, chapter navigation, and decimal-page progress (`research/web-complete-book-system-reference.md:297-359`). | Current reader validates book/chapter identity, batches 12, suppresses stale first loads, prefetches ±2, has horizontal paged and vertical scroll lists, saves one-based page strings, and changes chapters in place (`apps/mobile/src/screens/comic-reader-screen.tsx:35-152,155-237,269-323`). | **Partial.** No series-detail entry contract, RTL setting, explicit batch/page failure UI, or cancellable comic request. `loadBatch` has `finally` but no `catch`, so later-batch failures are not represented (`apps/mobile/src/screens/comic-reader-screen.tsx:136-153`). |

## Shared DTO, use-case, and test audit

### Present contracts

- API transport matches MessagePack Hub invocation with the gzip options
  argument and shared scheduler (`packages/api-client/src/index.ts:9-30,455-541`).
- Present book-system DTO families are list/latest, shelf, novel detail/content,
  comic uploaded-volume info/content, read position, and comments
  (`packages/api-client/src/index.ts:200-430`).
- Present client-core families are home discovery, book detail, reader,
  comments, and the minimal shelf use case (`packages/client-core/src/index.ts:77-120`).
- Reader normalization, locator restore, page planning, comic slots, and
  serialized writes are platform-neutral (`packages/reader-engine/src/index.ts:1-75,144-220,318-420`).

### Missing or unsafe contract seams

1. Missing API/client-core families: novel flat discovery, novel series and
   series volumes, comic series list/detail, search modes/results, novel rank,
   read history, and clear history.
2. Shelf `version` is a general `string|null`, and decode accepts modern-like
   records but performs no legacy migration (`packages/api-client/src/index.ts:247-250,824-845,1085-1131`).
   Saving reuses any non-null version rather than proving `20220211`
   compatibility (`packages/api-client/src/index.ts:648-656`).
3. `GetBookListByIds` has only the novel/general `{Ids}` shape and
   `BookListItem[]` return (`packages/api-client/src/index.ts:659-666`). There
   is no typed `{Ids,Type:'Comic'}` overload.
4. Comic `seriesTitle`, uploaded `bookId`, and `chapterId` are not represented
   together in one series projection. Current routing can therefore lose the
   identity needed to move from a series card to a specific reader volume.
5. Mobile still owns durable reader position cache and sync orchestration
   (`apps/mobile/src/services/reader-position-cache.ts:1-24,94-123`;
   `apps/mobile/src/services/reader-progress-sync.ts:1-48`). That is outside the
   shelf scope, but it remains a future desktop-reuse boundary to move behind
   `client-core` plus `KeyValueStore`/lifecycle ports.

### Current tests

- `api-client` tests cover optional novel detail fields, comic info/content,
  BlurHash, scheduling, cancellation, and one auth retry
  (`packages/api-client/src/index.test.mjs:16-262`). They do **not** cover shelf,
  comments, discovery/search/rank/history, novel content, exact Hub payloads
  for the book system, or comic shelf overloads.
- `client-core` tests cover session lifecycle, novel preload priority, and the
  three independent home sections (`packages/client-core/src/index.test.mjs:50-276`).
  There are no book-detail, comments, shelf, comic-reader-use-case, search,
  rank, or history tests.
- `reader-engine` has useful unit coverage for novel blocks/footnotes/locators,
  page plans, comic batch merge, progress, chapter boundaries, stale restore,
  and write serialization (`packages/reader-engine/src/index.test.mjs:20-219`).
- `apps/mobile` has no test script; it exposes typecheck only
  (`apps/mobile/package.json:42-49`). No route/screen/hook interaction test
  currently protects the complete-book flows.

## Shelf model and operation audit

### What exists now

The current decoded model correctly mirrors the Web flat-tree shape:

```text
UserShelf { version, items[] }
BOOK   { id:number, index, parents:string[], updatedAt }
FOLDER { id:string, title, index, parents:string[], updatedAt }
```

Evidence: `packages/api-client/src/index.ts:226-250,1085-1131`.

Implemented operations are exactly:

| Operation | Current status | Evidence |
| --- | --- | --- |
| Fetch/decode whole document | Implemented | `packages/api-client/src/index.ts:644-656,824-845` |
| Sort and hydrate all book IDs in chunks of 24 | Implemented, novel/general shape only | `packages/client-core/src/index.ts:496-510` |
| Browse root and arbitrary existing nested paths | Implemented in screen-local state | `apps/mobile/src/screens/shelf-screen.tsx:19-45,82-118` |
| Render folders/direct previews/unavailable IDs | Implemented | `apps/mobile/src/screens/shelf-screen.tsx:96-145,196-210` |
| Contains | Implemented by fresh remote fetch | `packages/client-core/src/index.ts:490-494` |
| Add to root / remove globally | Implemented only as detail `toggleBook` | `packages/client-core/src/index.ts:512-535`; `apps/mobile/src/hooks/use-book-detail.ts:89-114` |
| Main/draft branches | **Absent** | `ShelfUseCase` has only three methods (`packages/client-core/src/index.ts:115-120`) |
| Explicit edit/selection mode | **Absent** | Browse-only screen state (`apps/mobile/src/screens/shelf-screen.tsx:19-64`) |
| Explicit sort mode / sibling reorder | **Absent** | No shelf reorder command or gesture surface |
| Move books between folders | **Absent** | No command/use case/sheet |
| Create folder | **Absent** | No command/use case/sheet |
| Rename folder | **Absent** | No command/use case/sheet |
| Delete folder or selected books/folders | **Absent** | No command/use case/confirmation |
| Save/cancel draft as a unit | **Absent** | No editor transaction |
| Comic shelf add/hydrate/display round trip | **Blocked** | See below |

There is an authority conflict to resolve deliberately: current Web-Master
folder deletion moves contained books to root, while Flutter root multi-delete
says contained books are deleted (`research/web-complete-book-system-reference.md:456-465`;
`research/flutter-complete-book-system-reference.md:27-33`). Business behavior
comes from Web-Master, so RN must not copy Flutter’s destructive wording unless
product/backend explicitly changes the contract.

### What must move into `client-core`

The native screen should own only route path, sheet visibility, selected visual
IDs, gesture coordinates, and rendering. The following must be platform-neutral:

1. **Shelf repository:** load/cache/refresh the whole document, serialize saves,
   preserve unknown/deeper parent paths, expose initialized/stale/saving/error
   snapshots, and use `KeyValueStore` rather than SQLite directly.
2. **Shelf document decoder/migrator:** validate `20220211`, migrate captured
   legacy fixtures, normalize sibling indices without flattening groups, and
   retain invalid IDs as explicit hydration results.
3. **Draft editor aggregate:** `beginEdit`, `cancelEdit`, `saveEdit`, with a
   main document and an isolated draft. One save persists the complete draft.
4. **Pure commands with invariants:** add/remove books, create/rename/delete
   folder, move books, and reorder siblings. Commands must validate exact full
   parent paths, folder-name rules, book-only cross-folder moves, and
   sibling-only reorder.
5. **Selectors:** siblings at path, folder/breadcrumb titles, direct preview
   IDs, selected-folder contained-book impact, valid move destinations, and
   ordered hydration batches.
6. **Conflict policy:** because the server document has no visible revision or
   ETag, fixture/test concurrent writes before promising optimistic offline
   editing. Do not invent a granular `MoveBook`/`ReorderShelf` RPC; persistence
   remains `SaveBookShelf({data,ver})`.
7. **Media-aware hydration seam:** keep novel and comic batch results distinct;
   presentation receives a discriminated hydrated entry and never guesses media
   from an ID.

## Comic shelf contract blocker and fixture-first seams

Web-Master proves that comics share the physical `GetBookListByIds` method only
when `{Type:'Comic'}` is supplied for history. It does not prove that comic IDs
can round-trip through shelf documents, that mixed `{Ids}` hydration returns
comics, or whether shelf identity is uploaded volume versus series
(`research/web-complete-book-system-reference.md:480-529,601-617`). Current RN
is more limited: it saves format-neutral numeric BOOK records and hydrates only
`GetBookListByIds({Ids})` (`packages/api-client/src/index.ts:228-245,659-666`),
while the actual comic detail screen exposes no shelf action
(`apps/mobile/src/screens/comic-detail-screen.tsx:70-103`).

Required fixture-first sequence:

1. Capture raw MessagePack-decoded fixtures for:
   - `GetBookShelf` containing novel-only, comic-only, mixed, empty, legacy,
     invalid, and nested documents.
   - `SaveBookShelf` request/response round trips with a comic candidate ID.
   - `GetBookListByIds({Ids})` and
     `GetBookListByIds({Ids,Type:'Comic'})` for valid/invalid/empty/mixed IDs.
   - The identity relationship among comic series title/ID, uploaded book ID,
     and chapter ID.
2. Add exact decoders and operation tests in `api-client`. Expose distinct
   names such as `getNovelBooksByIds` and `getComicSeriesByBookIds` even though
   both invoke the same physical Hub method; do not return an ambiguous union.
3. Add a fixture-backed `ShelfEntryHydrator` port in `client-core`. Keep the
   persisted `ShelfItem` unchanged until fixtures prove whether a media
   discriminator can or must be stored.
4. Add pure shelf-document tests for mixed folders, add/remove, all folder
   commands, sibling reorder, move, legacy migration, stale whole-document
   saves, and invalid hydration placeholders.
5. Gate comic shelf UI until save → read-back → typed hydration is proven.
   Browser-local comic “following” is not a fallback synchronized shelf.

## Drag/reorder dependency audit

- `react-native-gesture-handler ~2.32.0` and
  `react-native-reanimated 4.5.1` are direct mobile dependencies
  (`apps/mobile/package.json:29-31`); `react-native-worklets 0.10.1` is also
  direct (`apps/mobile/package.json:36`).
- Reanimated is currently imported only for the novel detail collapsible header
  (`apps/mobile/src/screens/book-detail-screen.tsx:19-27`).
- No app source imports gesture-handler for shelf dragging, and there is no
  installed direct list-drag/reorder/sort library. The current shelf uses a
  plain `ScrollView` and manual three-column rows
  (`apps/mobile/src/screens/shelf-screen.tsx:23-64,82-94`).
- No shelf code calls haptics or vibration. Flutter explicitly has no haptic
  parity requirement (`research/flutter-complete-book-system-reference.md:67-74`).

### Minimal native shelf architecture

Use the dependencies already present before adding a drag-list package:

1. `ShelfScreen` has explicit **Browse → Edit → Sort** states. Sort can start
   only with no selection; card presses are inert during Sort. Root Edit may
   select books/folders; nested Edit selects books only. This follows Flutter’s
   mode table (`research/flutter-complete-book-system-reference.md:48-65`).
2. Render one `ReorderableShelfGrid` for the **current exact parent path**. It
   receives one ordered mixed sibling list and never receives descendants.
3. Compose gesture-handler long-press activation at **180 ms** with pan
   tracking. Reanimated may animate translation/placeholder layout, but the
   source order remains a JS draft until drop. Use scale 1 and no invented drag
   decoration, matching Flutter (`research/flutter-complete-book-system-reference.md:67-71`).
4. On drop, submit `{parents, orderedSiblingIds}` to the core draft editor. Core
   rejects any item whose `parents` differs. This makes cross-folder drag and
   drop-into-folder structurally impossible while allowing mixed book/folder
   sibling reorder.
5. Cross-folder movement is **book-only and sheet-driven**. The move sheet lists
   full-path destinations, includes root from a nested folder, excludes the
   current folder, and commits immediately on destination selection
   (`research/flutter-complete-book-system-reference.md:41-46,72-73`).
6. Create/rename use keyboard-aware sheets; delete uses explicit confirmation.
   Keep folder delete semantics aligned to Web-Master as noted above.
7. Save commits one whole draft; cancel discards it. Leaving the shelf with an
   active draft must use an explicit discard policy rather than silently saving.
8. Add no mark filters, mark long-press, Gist synchronization, encrypted sync,
   or settings merge. These are excluded (`research/flutter-complete-book-system-reference.md:162-174`).
9. Add **no haptics**. A future product request may add them, but Flutter parity
   may not be cited as justification.
10. Do not add a drag library until the fixed three-column implementation is
    device-tested for edge scrolling, interruption, accessibility, and large
    folders. If a library becomes necessary, require maintained grid support,
    exact 180 ms activation, external `ScrollView`/edge-scroll control, and no
    implicit cross-container semantics; validate it in a separate dependency
    decision.

## Recommended implementation order

1. Land captured fixtures and missing API DTOs/operations, beginning with comic
   shelf, comic series, search, and history.
2. Split detail from shelf availability so public/cached detail can render when
   shelf membership fails.
3. Build `client-core` shelf repository, migrator, pure editor, selectors, and
   tests before native edit UI.
4. Add novel/comic discovery and search routes in parallel; add novel rank while
   surfacing the comic-rank capability gap honestly.
5. Add comic series detail and Series comments before treating comic detail as
   complete.
6. Replace History placeholder with exact dual-format hydration and clear-all.
7. Add explicit shelf edit/sort UI and the 180 ms sibling-only grid reorder on
   top of the tested core draft.
8. Harden both readers with captured operation fixtures, comic batch retry UI,
   cancellation, shared-core progress persistence, and Android/iOS device
   tests.

Until steps 1–7 pass contract and interaction tests, the current app should be
described as a **novel-first discovery/detail baseline with native novel/comic
reader work in progress**, not a complete equal-priority book system.

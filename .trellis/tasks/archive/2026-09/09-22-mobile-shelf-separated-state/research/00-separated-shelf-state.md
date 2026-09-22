# Research: separate mobile shelf media states

## Status and scope

This is a research-only note for `09-22-mobile-shelf-separated-state`. No product code was changed while producing it. Line numbers refer to the current branch and may move during implementation.

The related `09-22-shelf-contract-migration` task owns the API/client-core migration from the legacy `BOOK` shelf item to the Web-Master `NOVEL`/`COMIC`/`FOLDER` contract. This task should consume that model; it should not re-create a second shelf contract in the mobile screen. The broader `09-22-server-api-followup` remains a separate API-diff task.

## Executive recommendation

Implement the smallest useful product shape as follows:

1. Add a two-option shelf segmented control, `Novel` and `Comic`, with `Novel` selected by default, matching the existing history control. Do **not** add a mixed `All` view for this task.
2. Keep one process-wide, complete `ShelfSnapshot`, one load/refresh/error state, and one optimistic complete-shelf save queue. The selected media type is only a browse projection over that snapshot; switching tabs must not fetch or save a second shelf.
3. In browse mode, filter book entries by the authoritative shelf item type. Recursively keep a folder visible only when its subtree contains at least one book of the selected type. Folder counts and cover previews must use the same filtered subtree.
4. In edit mode, hide/disable the type control and show the complete unfiltered sibling list. Reordering a filtered list would write incorrect sibling indexes and could drop the other media type from a complete-shelf save.
5. Carry the selected type through folder navigation as the canonical route query `media=novel|comic`, so a Comic view remains a Comic view after opening a folder or deep-linking to one. Keep folder creation, rename, move, delete, and breadcrumb semantics unchanged.
6. Make the client-core shelf operations type-aware before the screen is changed: hydration, optimistic projection, `contains`/toggle, selection keys, move/delete, and book maps must distinguish `NOVEL` and `COMIC` even when numeric IDs happen to match.
7. Make empty-state copy type-aware. The existing root copy says “add novels”, so it cannot be reused for the Comic tab. Reuse the existing localized `history.novelsTab`/`history.comicsTab` labels unless a product-specific label is desired.

This is a view-state split, not two persisted shelves. The server still owns one ordered tree containing both media types.

## 1. Existing mobile behavior

### Reading history is the correct UI precedent

- `apps/mobile/src/hooks/use-read-history.ts:13-41` defines `HistoryTab = 'Novel' | 'Comic'` and maintains independent Novel and Comic tab state, while `ReadHistory` remains one index containing `novelIds` and `comicIds`.
- `apps/mobile/src/hooks/use-read-history.ts:75-136` loads each media type through its own use-case method and guards the two tab loads independently.
- `apps/mobile/src/hooks/use-read-history.ts:138-243` refreshes the shared index, starts both first pages, supports per-tab retry/load-more, and clears both types together.
- `apps/mobile/src/screens/history-screen.tsx:40-53` defaults to Novel and builds localized two-option labels. `apps/mobile/src/screens/history-screen.tsx:121-170` puts the existing `NativeSegmentedControl` inside the primary list and routes Novel and Comic items to the correct detail parameters.
- `apps/mobile/src/screens/history-screen.tsx:211-225` already has type-specific empty descriptions.

The shelf should copy the visible interaction pattern and default, but not copy history's two independently paginated data stores: `GetBookShelf` returns one ordered folder tree, so one complete snapshot plus a derived filter is smaller and safer.

### Shelf is currently one mixed legacy view

- `apps/mobile/src/screens/shelf-screen.tsx:60-129` has no media tab. It obtains one `snapshot` from `useShelf`, resolves the current path, and derives `visibleItems` with `getShelfItemsAtPath`.
- `apps/mobile/src/screens/shelf-screen.tsx:101-106` treats only `type === 'BOOK'` as a selectable book. Folder selection and move/delete eligibility consequently assume the old union.
- `apps/mobile/src/screens/shelf-screen.tsx:351-518` renders a single grid. Folder previews/counts scan the unfiltered `snapshot.items`; book navigation already forwards `pressed.type` and Comic `seriesTitle` at `apps/mobile/src/screens/shelf-screen.tsx:448-480`.
- `apps/mobile/src/screens/shelf-screen.tsx:639-653` has one generic empty state, and the root description is explicitly novel-only through `shelf.shelfEmptyDescription`.
- `apps/mobile/src/hooks/use-shelf.ts:60-217` owns load/refresh, edit mode, pure draft mutations, immediate optimistic persistence, and retry. It is already the correct owner of the shared shelf projection; a second per-tab draft would violate the shelf optimistic-management contract.
- `apps/mobile/src/components/shelf-navigation.tsx:16-77` owns header title and toolbar actions. The existing root/folder/edit toolbar distinction should remain unchanged.

### API/client-core assumptions that prevent a UI-only filter

The current contract cannot represent the server's current mixed shelf:

- `packages/api-client/src/index.ts:171` still sets `SHELF_STRUCT_VERSION` to `20220211`.
- `packages/api-client/src/index.ts:281-315` defines `ShelfItemType = 'BOOK' | 'FOLDER'`; a shelf book has no Novel/Comic type.
- `packages/api-client/src/index.ts:1469-1508` has one `GetBookShelf`/`SaveBookShelf` pair and a general `GetBookListByIds`. `getComicSeriesByIds` is a history/search-style series aggregation and should not replace one-to-one shelf item hydration without checking identity/order semantics.
- `packages/api-client/src/index.ts:2766-2817` decodes and encodes only `BOOK` or `FOLDER`; current `NOVEL`/`COMIC` server entries fail at the decoder.
- `packages/client-core/src/index.ts:247-278` exposes `ShelfSnapshot.books`, a legacy `ShelfItemKey` of `BOOK:<id>`, and a `ShelfUseCase` whose `contains`/`toggleBook` methods accept only an ID.
- `packages/client-core/src/index.ts:1480-1605` hydrates, projects, saves, and checks membership using `item.type === 'BOOK'`. The book cache is also keyed only by numeric ID.
- `packages/client-core/src/index.ts:1615-1665` and `packages/client-core/src/index.ts:1763-1823` use the legacy key and `BOOK` guard throughout folder selection, deletion, moving, and sibling reorder.
- `apps/mobile/src/services/client.ts:18-42, 76-80` constructs one `ApiClient`, one `createShelfUseCase(api)`, and exports it to the mobile hooks. The screen should continue to consume this boundary rather than call the API directly.

Therefore a type selector added before the contract migration would either render no current Comic entries or accidentally treat them as invalid. Normalize the API/core model first, then add the presentation projection.

## 2. Reference behavior from Web-Master

The read-only reference supplies the desired shelf semantics:

- `references/web-master/src/types/shelf.ts:1-48` uses `NOVEL`, `COMIC`, and `FOLDER`, with latest structure version `20260921`; `isShelfBookItem` treats both media types as books.
- `references/web-master/src/pages/MyShelf/List.vue:8-20` shows the type toggle only outside edit mode.
- `references/web-master/src/pages/MyShelf/List.vue:277-293` makes edit mode unfiltered and, in browse mode, retains a folder only when `booksInFolderTree(folder, type)` is non-empty. The reference also offers an `all` option, but the mobile requirement is specifically separate Novel/Comic states, so adding `All` is not necessary for the smallest shape.
- `references/web-master/src/pages/MyShelf/components/ShelfFolder.vue:29-64` counts books, previews covers, and counts matching child folders from the recursive subtree using the active type.
- `references/web-master/src/components/biz/MyShelf/AddToShelf.vue:20-41` maps a detail item to a typed shelf book (`COMIC` or `NOVEL`) when adding it.

The mobile recommendation is thus a native adaptation of the reference's browse/edit distinction, deliberately omitting the reference's mixed `All` tab.

## 3. Recommended smallest technical shape

### 3.1 State model

Introduce a presentation-level type such as:

```ts
type ShelfTab = 'Novel' | 'Comic';
```

The root shelf and folder shelf should each have one active tab, defaulting to `Novel` as history does. The tab is not part of `ShelfSnapshot`, `ShelfDraft`, or the server payload. No AsyncStorage setting is needed for the MVP; route propagation is enough to preserve it while navigating folders.

Use the existing flow:

```text
GetBookShelf
  -> api-client decode/legacy normalization
  -> client-core createShelfUseCase.load()
  -> one complete ShelfSnapshot (typed items + hydrated books)
  -> useShelf()
  -> browse selector(snapshot, parents, activeTab)
  -> grid / folder previews / type-aware empty state
```

A tab change must only recompute the selector. It must not call `getBookShelf`, rehydrate, mutate indexes, or invoke `saveBookShelf`.

### 3.2 Browse projection and folder rules

Use the shelf item's typed source (`NOVEL` or `COMIC`) as the filter authority, not a hydrated card's `BookListItem.type`. This preserves the correct tab even when a detail lookup is unresolved; unresolved matching entries can still render the existing unavailable tile and remain editable.

For a path `parents` and selected `type`:

1. Start with direct siblings from the complete draft (`getShelfItemsAtPath` semantics).
2. Keep a book only when `item.type === type`.
3. Keep a folder only when any descendant book in that folder's subtree has `item.type === type`.
4. For a visible folder, compute descendant count and preview covers from matching books only. Nested folders without a matching descendant are not counted as matching child folders.
5. Apply the same projection at root and inside a folder. A folder containing only novels is therefore absent from the Comic browse state, but remains available in edit mode.

This should be a pure, unit-testable shelf-tree helper alongside the existing client-core shelf helpers (`packages/client-core/src/index.ts:1637-1665`), or one small pure mobile selector that calls those helpers. Do not put recursive `parents` traversal in JSX or duplicate it separately for visibility, count, and covers.

When the selected type has no matching items, show a type-aware root empty state. When a valid folder has no matching descendant, show a folder/type-aware empty state. Do not make a Comic tab say “add novels”.

### 3.3 Edit mode must show the complete tree

The current reorder implementation sends all visible sibling keys to `reorderShelfSiblings` (`apps/mobile/src/screens/shelf-screen.tsx:499-518`). Filtering that list would make a reorder appear valid while omitting the other media type from the sibling set.

Recommended behavior:

- Browse mode: show the active Novel or Comic projection and show the segmented control.
- Enter edit mode: hide or disable the segmented control and replace the projection with all direct siblings, including both media types and all folders.
- Selection, reorder, move, delete, optimistic save, and retry operate on the complete snapshot. The selected tab is retained privately and restored when edit mode ends; it does not change what edit mode displays.
- Exiting edit mode only clears selection/reorder interaction state. It must not discard or delay a mutation, consistent with `.trellis/spec/frontend/component-guidelines.md:105-157`.

The screen-level `selectedBooks` type guard (`shelf-screen.tsx:101-103`) and the client-core mutation signatures must accept both typed book variants. `moveBooks` should pass type-qualified book references/keys rather than a bare numeric ID list, unless the contract explicitly guarantees a global ID namespace. This avoids moving or deleting both media entries if the same number ever occurs in both types.

### 3.4 Typed identity and hydration invariants

The contract migration must establish these invariants before the UI filter lands:

- `ShelfItemKey` distinguishes `NOVEL:<id>`, `COMIC:<id>`, and `FOLDER:<id>`. Do not retain `BOOK:<id>` in the normalized UI model.
- `project`, save confirmation, missing-book hydration, and any `Map` used by `ShelfSnapshot` use the typed shelf key, not only `book.id`.
- `removeShelfItems` removes any typed book key; it must not rely on a `BOOK:` prefix.
- `getShelfSelectionBookCount`, folder deletion/promotion, `moveShelfBooks`, and `reorderShelfSiblings` treat Novel and Comic as the same structural “book” category while preserving each item's media type.
- A folder operation never changes a book's media type. Deleting a folder promotes both media types using the existing folder rules.

`GetBookListByIds` already decodes a common `BookListItem` with `Novel`/`Comic` type at `packages/api-client/src/index.ts:1778-1788, 2729-2745`. The smallest default is to keep one mixed batch hydration if the migrated endpoint returns one-to-one items. If the server contract requires type-specific requests, split the batch inside client-core and merge results by typed shelf key. Do not use the history `ComicSeriesListItem` aggregation for shelf ordering unless the API contract proves that every concrete shelf ID is preserved one-to-one.

The snapshot should retain a typed relationship between each shelf entry and its hydrated card. A missing detail response must leave the shelf entry in `items`; only its cover/card payload is unavailable. That lets the active-type filter and edit mode remain structurally correct.

### 3.5 Navigation and folder route state

Current navigation is:

- `apps/mobile/src/app/(tabs)/(shelf)/shelf.tsx:1-5` renders the root `ShelfScreen`.
- `apps/mobile/src/screens/shelf-screen.tsx:143-150` pushes `/shelf/folder` with a JSON-serialized `path` only.
- `apps/mobile/src/app/shelf/folder.tsx:6-25` decodes that path and renders the folder screen.
- `apps/mobile/src/app/_layout.tsx:154-160` registers the folder route; `shelf/action` is a separate form sheet for one focused edit action.

Add a normalized `kind` route parameter to the root/folder shelf routes (or pass an equivalent initial tab prop):

- Root defaults invalid/missing values to Novel.
- Opening a folder passes the current `kind` alongside the serialized path.
- A direct folder deep link without `kind` defaults to Novel.
- Back navigation returns to the existing root screen and its tab; a fresh/deep-linked folder still has deterministic state.
- Action sheets do not need a type parameter because edit mode is intentionally unfiltered.

Keep the existing book detail route contract. `apps/mobile/src/app/book/[id].tsx:5-42` accepts `type`, `seriesTitle`, and cover hints; the shelf card path already supplies these at `shelf-screen.tsx:448-480`. The selector must not route a Comic shelf item as a Novel. If the screen includes detail-page shelf toggling end-to-end, `apps/mobile/src/hooks/use-book-detail.ts:76-146` also needs the media type passed to `contains` and `toggleBook`; the current detail UI suppresses the Comic shelf button at `apps/mobile/src/screens/book-detail-screen.tsx:301-318`.

### 3.6 Localization

Current relevant resources:

- `apps/mobile/src/localization/locales/library.ts:84-114` contains shelf copy, including the novel-only `shelfEmptyDescription`.
- `apps/mobile/src/localization/locales/library.ts:116-130` already contains the exact Novel/Comic history tab labels and type-specific history empty copy.
- `apps/mobile/src/localization/locales/library.ts:240-270` contains the Traditional Chinese shelf equivalents.
- `apps/mobile/src/localization/resources.ts` registers the resources, and `apps/mobile/src/localization/resources.test.mjs` checks resource shape/parity.

Smallest localization change:

- Reuse `history.novelsTab` and `history.comicsTab` for the two control labels, or add `shelf.novelsTab`/`shelf.comicsTab` only if shelf wording is intentionally different.
- Add separate Simplified/Traditional shelf empty descriptions for Novel and Comic (and, if the product wants distinct wording, folder-without-selected-type descriptions). Existing generic folder action/error strings can remain shared.
- Keep all user-facing new copy in the locale resources; do not interpolate hard-coded Chinese or English media names in the screen.
- Preserve the existing accessibility labels for folder, unavailable book, retry, and toolbar actions. If folder counts become type-specific, the localized count label must describe the filtered count, not the total mixed subtree.

The `TranslationShape<typeof zhCNLibrary>` declaration for `zhTWLibrary` and the localization parity test make a missing Traditional Chinese key a test failure, which is desirable.

## 4. Open decisions and recommended defaults

| Decision | Evidence / risk | Recommendation for this task |
|---|---|---|
| Include a mixed `All` tab? | Web-Master has one, but the requested mobile behavior is separate states matching history. A mixed view would preserve the original ambiguity. | No. Keep only Novel and Comic for the smallest product shape. |
| Persist the last selected tab? | History keeps a screen-local selection; no shelf preference exists. | No persistent setting. Preserve it through folder route params and normal navigation stack behavior. |
| What is visible in edit mode? | Web hides filtering because filtered indexes cannot safely reorder (`references/web-master/src/pages/MyShelf/List.vue:8-20, 277-293`). | Full unfiltered sibling list; hide/disable the control. |
| Hide folders with no matching descendants? | Web recursively hides them and type-filters count/preview (`ShelfFolder.vue:39-59`). Showing empty folders would make a selected type look mixed or broken. | Hide in browse projection; keep them in edit mode. |
| One mixed hydration call or two? | `GetBookListByIds` already yields typed common cards; history's Comic endpoint aggregates series. | Prefer one mixed `GetBookListByIds` batch and typed-key merge. Split by type only if the migrated server contract requires it. |
| What does legacy `BOOK` mean? | The old mobile detail path could not add Comics (`book-detail-screen.tsx:301-318`), so legacy entries are expected to be novels. | Normalize legacy `BOOK` to `NOVEL` at the API/core boundary, write the latest contract on the next save, and never expose `BOOK` to mobile presentation. Confirm this migration policy in `09-22-shelf-contract-migration`. |
| Should Comic add/remove be part of this child? | A Comic tab can display server-populated entries, but current mobile detail neither shows the shelf button nor passes type to core toggle. | For a complete user journey, include the small type-aware detail toggle as a dependency/acceptance item. If this child is presentation-only, explicitly leave add/remove to the contract/detail follow-up rather than claiming Comic shelf population is complete. |
| How should duplicate numeric IDs be handled? | Current core maps and mutators use only `id`; the new contract has two book types and the UI selection key must be unambiguous. | Use typed shelf references/keys through hydration, selection, move, delete, and toggle. |

## 5. Recommended acceptance criteria

### Product behavior

- [ ] The root shelf defaults to Novel and exposes localized Novel/Comic tabs matching the reading-history control.
- [ ] With a mixed fixture, Novel browse shows only Novel book entries and folders with at least one Novel descendant; Comic browse shows the inverse. There is no mixed browse list and no `All` tab in this scope.
- [ ] Switching tabs does not reload, rehydrate, reorder, save, or mutate the complete shelf. Existing refresh, load error, optimistic update, and retry behavior remains shared.
- [ ] A folder containing both media types shows type-specific direct entries, descendant count, and cover previews. A type-only-empty folder is hidden from the corresponding browse projection but appears in edit mode.
- [ ] Opening a folder preserves the selected type, including when navigating through multiple folder levels or opening a route with the canonical `media` query. Back/breadcrumb behavior remains valid.
- [ ] Novel and Comic shelf cards open `/book/[id]` with the correct ID, `type`, cover hints, and Comic series title when available. Unresolved matching entries remain selectable in edit mode and do not become a different media type.
- [ ] Edit mode hides/disables the type selector and displays all sibling media entries and folders. Reorder, selection, move, delete, folder creation, rename, and folder deletion continue to operate on the complete typed tree.
- [ ] A complete-shelf save never drops the non-selected media type, folders, or unresolved entries. Exiting edit does not discard an optimistic mutation or pending retry.
- [ ] If detail add/remove is included, Novel and Comic details both query and mutate membership with the correct typed reference; the Comic control is no longer silently omitted.
- [ ] Root and folder empty states are accurate for the active type in both Simplified and Traditional Chinese.

### Cross-layer behavior

- [ ] API/client-core consume normalized `NOVEL`/`COMIC`/`FOLDER` items and the `20260921` version without a screen-level legacy branch.
- [ ] Legacy `BOOK` handling, if retained, is tested as an explicit normalization/migration rule rather than silently falling through.
- [ ] Typed keys prevent collisions in snapshot maps, selection, reorder, removal, move, membership, and optimistic save confirmation.
- [ ] No new per-type shelf endpoint or second repository is introduced; the mobile screen remains behind `useShelf` and `apps/mobile/src/services/client.ts`.

## 6. Test and verification plan

### Pure/API/client-core tests

Extend the existing tests rather than adding UI-only mocks:

- `packages/api-client/src/index.test.mjs:1021-1055`: round-trip current `20260921` payloads containing Novel, Comic, and Folder items; test legacy `BOOK` normalization according to the migration decision; retain null/empty payload behavior.
- `packages/client-core/src/index.test.mjs:1051-1110`: load and save a mixed snapshot, hydrate both media types, preserve unresolved entries, publish one shared optimistic snapshot, and retain all types after a save.
- `packages/client-core/src/index.test.mjs:1429-1490`: update folder/move/delete/reorder fixtures to contain both typed book variants; assert folder deletion promotes both; assert typed keys distinguish same numeric IDs if that case is supported by the contract.
- Add selector/tree tests for root and nested paths: direct type filtering, recursive folder visibility, type-specific counts/previews, Comic-only/Novel-only/empty folders, and invalid paths.
- Add mutation tests for selecting/moving/deleting typed books, complete sibling reorder in edit mode, stale save protection, retry, and no loss of the unselected type.

### Mobile tests

- `apps/mobile/package.json:78` currently runs `test:shelf` over pure service tests, but `test:shelf` at line 78-79 does not cover media filtering. Add a pure selector test to this suite if the projection remains mobile-owned; otherwise keep the tests in client-core.
- Keep `apps/mobile/src/services/shelf-editing.test.mjs` coverage for root/folder move destinations and enablement rules. Extend fixtures to use both media types and verify folders remain type-neutral.
- Extend localization parity checks in `apps/mobile/src/localization/resources.test.mjs` for new shelf keys.
- Run the existing workspace test entry point (`package.json:16`), type/boundary checks, API/client-core tests, shelf tests, localization tests, and both Expo exports.

### Device/manual acceptance

On iOS and Android, verify: default Novel tab, Comic tab, mixed folder previews/counts, hiding of type-empty folders, preserving `kind` through nested navigation/back, edit-mode full list, reorder without dropping the other type, move/delete/folder actions, refresh/error/retry, unavailable entries, localized Simplified/Traditional copy, and correct Novel/Comic detail routing. Keep the existing large-title ownership: the segmented control should live inside the primary scroll/list content, not replace the direct scroll child expected by the native stack (`apps/mobile/src/screens/history-screen.tsx:121-137`; shelf root ownership is at `shelf-screen.tsx:237-290`).

## 7. Explicitly out of scope

- A mixed `All` shelf mode, cross-type sorting/filter chips, or a redesign of shelf cards.
- A second persisted shelf per media type, per-tab local drafts, or separate shelf repositories.
- New server endpoints, server-side type-filter query parameters, or changes to folder storage beyond the sibling contract migration.
- Changing folder policy: root-only creation, existing move-destination rules, folder non-movability, deletion promotion, and action-sheet UX remain as documented in `.trellis/spec/frontend/component-guidelines.md:105-157`.
- Reworking reading history, its independent pagination, clear behavior, or localization.
- Search, discovery, download, reader, community, or unrelated Web-Master differences.
- Persistent user preferences for the selected tab, analytics, or a new global media-state store.

The implementation should stay limited to consuming the typed shelf contract, deriving two browse states, preserving the existing edit/navigation model, and making the necessary type-aware detail membership path explicit.

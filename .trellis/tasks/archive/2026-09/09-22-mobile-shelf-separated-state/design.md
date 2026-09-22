# Technical design

## Boundary and dependency

This child owns the mobile shelf presentation and detail membership flow. It depends on `09-22-shelf-contract-migration` for normalized `ShelfItem`, `ShelfBookRef`, `ShelfItemKey`, `ShelfBookRecord`, and the final `ShelfUseCase` signatures. It must not decode shelf wire data, call transport methods, or reimplement legacy `BOOK` migration.

## State model and routes

Use one local `ShelfMediaType = 'Novel' | 'Comic'` state, initialized to `Novel`. The state is a browsing/navigation parameter, not persisted user data and not a second repository. Use one canonical mapping at the mobile boundary: `ShelfMediaType.Novel` ↔ normalized shelf `NOVEL` ↔ detail `Novel`, and `ShelfMediaType.Comic` ↔ `COMIC` ↔ `Comic`. Serialize the route as `media=novel|comic`; the parser accepts only those lowercase values and falls back to `Novel` for missing or invalid values.

- The root shelf renders the segmented control using the existing `NativeSegmentedControl` pattern from history.
- Opening a folder pushes both the existing `path` and `media=novel|comic`. Back navigation and deep links preserve it; the existing book detail `type=Novel|Comic` parameter is produced only by the explicit mapping above.
- Edit mode hides or disables the segmented control and uses the full typed tree at the current path. Exiting edit keeps the client-core optimistic snapshot and any retry state.
- Detail routes use the shelf card's normalized type: `Novel` cards open the novel detail path and `Comic` cards pass `type: 'Comic'` plus the series title hint. No Comic item is coerced to Novel.

## Recursive browse projection

Keep `getShelfItemsAtPath` as the source for the complete current sibling list, then apply a pure mobile projection only in browse mode:

1. For each child at the current path, retain a book when its normalized item type matches the selected media type.
2. Retain a folder when a recursive walk of that folder's descendants contains at least one matching book.
3. Build the folder's visible count and preview cards from that same recursive filtered subtree, not from global item counts or the hydrated-card list.
4. Preserve original sibling order and parent paths. Hydrated cards are looked up by `ShelfItemKey`; a missing card still produces an unavailable typed book tile.
5. Apply the exact same function at the root and at every folder depth. An empty filtered result uses a localized type-specific empty state.

The projection is memoized from `{ snapshot, parents, mediaType, mode }`. Changing the segmented control changes only this projection and route-local rendering; it does not call `shelf.load`, hydrate, save, or mutate indexes.

## Edit and persistence behavior

Selection, deletion, moving, and reordering operate on the complete `visibleItems` from the unfiltered tree whenever `mode === 'edit'`. Typed keys are used for selection and reorder output. Moving books passes typed refs/keys to the updated hook helper; it never reconstructs identity from a numeric id.

The existing `useShelf` load/refresh/error/persistence state remains the single source of truth. The screen only changes which items it renders and which navigation state it carries. Folder creation, rename, action-sheet destinations, retry, and prevent-remove behavior remain unchanged.

## Comic membership

`useBookDetail` maps its `BookDetailKind` to the client-core ref (`Novel` -> `NOVEL`, `Comic` -> `COMIC`) for both `shelf.contains` and `shelf.toggleBook`. Remove the current Comic-only hiding condition in the detail screen. Preserve loading, auth/network/server error mapping, retry, and the existing route/detail presentation.

## Localization and accessibility

Reuse the existing `library.history.novelsTab`/`comicsTab` vocabulary where appropriate and add parallel shelf-specific empty/accessibility keys in both `zh-CN` and `zh-TW`. Keep resource key shapes identical. Labels for the segmented control, empty states, retry, unavailable cards, folder actions, move/delete actions, and Comic membership remain localized and screen-reader meaningful; no media name is hard-coded in JSX.

## Verification and rollback

- Pure projection tests cover mixed nested fixtures, empty branches, counts, previews, original order, unresolved cards, and both media states.
- Screen/service tests cover default/invalid route state, deep folder preservation, no load/save on tab change, full-tree edit operations, and correct Novel/Comic detail params.
- Detail tests cover typed Comic add/remove and preserve Novel behavior/error handling.
- If the projection causes unsafe editing or navigation regressions, revert the UI projection while retaining the API/client-core migration; the latter keeps legacy shelves readable.

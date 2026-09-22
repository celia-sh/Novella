# Technical design

## Boundary

This follow-up is mobile presentation and pure projection work only. The
normalized `ShelfSnapshot`, typed shelf identity keys, client-core use case,
transport decoder, save queue, and book-detail membership contract remain
unchanged.

Expected implementation files:

- `apps/mobile/src/services/shelf-media.ts` — add the All filter state, route
  parsing/serialization, and complete mixed projection semantics.
- `apps/mobile/src/screens/shelf-screen.tsx` — default to All, render the three
  options, pass the state through folder navigation, and select generic All
  empty-state resources.
- `apps/mobile/src/app/(tabs)/(shelf)/shelf.tsx` and
  `apps/mobile/src/app/shelf/folder.tsx` — consume the expanded route union
  without duplicating parser behavior.
- `apps/mobile/src/localization/locales/library.ts` and
  `apps/mobile/src/localization/resources.test.mjs` — add All labels and keep
  Simplified/Traditional structures aligned.
- `apps/mobile/src/services/shelf-media.test.mjs` — cover route and projection
  behavior without importing React Native.

## State and type boundary

Define `ShelfMediaType = 'All' | 'Novel' | 'Comic'` and
`ShelfMediaRouteParam = 'all' | 'novel' | 'comic'`. Keep
`ShelfDetailType = 'Novel' | 'Comic'` separate so All cannot leak into a book
route or typed membership reference. `shelfMediaToBookType` and
`shelfBookRefForMedia` accept only the two typed book media values.

`parseShelfMediaParam` accepts only lowercase route values and returns All for
missing, arrays with no value, and invalid values. `serializeShelfMedia`
round-trips all three states. `ShelfScreen` and both route files use the shared
parser and default to All.

## Projection

The browse projection treats All as an explicit unfiltered browse state, while
`null` remains the internal edit-mode signal:

Empty and unresolved data are not new states to decode here. A valid empty
`ShelfSnapshot` projects to zero items and the screen selects its localized
empty state. A typed shelf item whose hydrated `book` is `null` still passes
through the projection based on `ShelfItem.type`; the existing grid renders its
unavailable-card tile. Neither case is converted into a projection exception or
a screen-wide load error.

```text
All browse  → complete recursive browse projection
Novel browse → recursive NOVEL projection
Comic browse → recursive COMIC projection
null edit   → complete sibling tree for selection/reorder/move/delete
```

The implementation can share the existing `shelfType = null` recursion for All
and edit mode, but the public state must keep the distinction so the UI only
renders the segmented control and empty-state mode in browse mode. All folder
visibility, book counts, child-folder counts, and previews derive from the
complete subtree. A mixed folder with both media types therefore remains
visible in all three browse states; its child projection is complete for All
and type-filtered for Novel/Comic. Novel/Comic continue to hide folders without
matching children and derive their summaries from the filtered subtree.
Hydration misses remain typed unavailable cards and never remove a shelf item.

## Screen behavior

- The segmented control options are ordered All, Novel, Comic.
- A mixed folder is navigable from each state when it contains a matching
  descendant; the folder screen keeps the state and filters only its children.
- Changing a state updates only local state and the existing `media` route
  param; it does not reload or save.
- Opening a folder carries the current state. Back and deep links therefore
  restore the same projection.
- Edit mode still passes `null` to the projection and hides the segmented
  control. It must operate on all typed siblings regardless of the browse state
  previously selected.
- All empty root/folder views use the existing generic shelf/folder empty keys;
  Novel/Comic retain their type-specific keys.
- All folder accessibility text uses the localized All label; detail navigation
  continues to derive `Novel`/`Comic` from the normalized item type.

## Localization

Add one All tab/media label in both locale branches. Update the generic root
empty description to refer to books rather than only novels, because it becomes
visible in All mode. Keep existing type-specific strings and all interpolation
variables unchanged. Resource parity tests remain the structural guard.

## Compatibility and rollback

No persisted state or server schema changes are needed. The implementation must
not modify `decodeUserShelf`, `createShelfUseCase.load`, `loadCards`, or the
unresolved-card record shape. The new All tests explicitly cover an empty
snapshot and a mixed snapshot containing unresolved Novel/Comic records.

Existing `novel` and
`comic` deep links remain valid. If a route or projection regression appears,
remove only the All option/parser branch and retain the existing typed
projection; the normalized shelf API and edit semantics remain independently
safe.

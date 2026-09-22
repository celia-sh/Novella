# All-media shelf filter evidence

## Current implementation

- `apps/mobile/src/services/shelf-media.ts` defines `ShelfMediaType` as
  `Novel | Comic`, parses only lowercase `novel`/`comic`, and defaults invalid
  or missing values to `Novel`.
- The same module already supports an unfiltered projection when its `media`
  argument is `null`; the screen uses that only in edit mode. Recursive folder
  summaries and previews are already centralized in `buildFolderProjections`.
- `apps/mobile/src/screens/shelf-screen.tsx` defaults `initialMedia` to
  `Novel`, renders two segmented-control options, serializes the state when
  changing tabs and opening folders, and uses type-specific empty-state keys.
- `apps/mobile/src/app/(tabs)/(shelf)/shelf.tsx` and
  `apps/mobile/src/app/shelf/folder.tsx` both consume the shared media parser,
  so adding `all` at that boundary preserves root/folder route symmetry.
- `apps/mobile/src/services/shelf-media.test.mjs` covers the current default,
  lowercase parser, recursive Novel/Comic projection, complete edit projection,
  unresolved cards, and typed detail route parameters.
- `packages/api-client/src/index.test.mjs` already covers null/empty shelf
  payloads, while `packages/client-core/src/index.test.mjs` covers mixed typed
  hydration and unresolved records. `createShelfUseCase.load()` skips
  `getBookListByIds` when the reference list is empty, and the mobile screen
  already renders `book: null` records through `UnavailableBookGridItem`.
- `apps/mobile/src/localization/locales/library.ts` has both locale branches,
  generic shelf empty/folder strings, and Novel/Comic strings, but no All tab
  key. `resources.test.mjs` maintains key and interpolation parity.

## Product decision

- The new browse states are All / Novel / Comic.
- Missing or invalid route media defaults to All, because the user wants the
  complete shelf visible on entry; the selection is not persisted.
- All is a browse filter state only. It must not be accepted as a book detail
  type or passed to typed `contains`/`toggleBook` membership APIs.

## Contract boundary

The API/client-core normalized shelf model remains unchanged:

```text
ShelfSnapshot → mobile route parser/state → pure browse projection → grid
                                      ↘ typed Novel/Comic detail route
```

Changing All/Novel/Comic only changes the local projection. It must not call
`shelf.load`, hydrate again, `shelf.save`, reorder, or mutate indexes. The All
follow-up adds regression coverage for an empty snapshot and unresolved typed
records but does not alter the empty-shelf decoder or hydration behavior.

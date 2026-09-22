# Add all-media shelf filter

## Goal

Restore a useful mixed shelf browse view by presenting three mutually exclusive
browse states — All, Novel, and Comic — while preserving the typed Web-Master
shelf API, one complete server-side tree, existing edit behavior, and typed book
navigation.

## Confirmed repository facts

- The archived shelf follow-up (`09-22-mobile-shelf-separated-state`) changed
  mobile browse state to `ShelfMediaType = 'Novel' | 'Comic'` and currently
  renders only two segmented-control options.
- `apps/mobile/src/services/shelf-media.ts` already projects a complete
  `ShelfSnapshot` recursively and accepts `null` as an unfiltered projection for
  edit mode. The current browse projection filters by `NOVEL` or `COMIC` and
  hides folders without matching descendants.
- `apps/mobile/src/screens/shelf-screen.tsx` defaults the root and folder routes
  to Novel, serializes only `media=novel|comic`, and passes the unfiltered
  projection only while editing.
- The current shelf resource files already contain type-specific empty-state,
  folder, count, and accessibility vocabulary in both `zh-CN` and `zh-TW`, but
  do not contain an All shelf tab/empty-state label.
- Existing pure shelf tests cover lowercase route parsing, recursive Novel/Comic
  filtering, edit completeness, unresolved cards, and typed detail routing.
- The normalized API/client-core shelf contract is already implemented; this
  follow-up must not add transport or decoder work.

## Requirements

### R1 — Three browse states

- Add All, Novel, and Comic options to the shelf browse segmented control.
- All shows both normalized `NOVEL` and `COMIC` books and all folders that are
  part of the complete tree; Novel and Comic retain their current recursive
  type-filtered behavior.
- Keep one local projection over one complete `ShelfSnapshot`; do not create
  separate repositories, save queues, persisted shelves, or cross-type sorting
  rules.
- The selected browse state changes only the projection and route state; it must
  not reload, hydrate, save, reorder, or mutate the server snapshot.

### R2 — Route and navigation state

- Extend the canonical shelf route parameter to `media=all|novel|comic`.
- Root and folder routes preserve the selected state through folder navigation,
  Back, refresh, and deep links.
- Normalize missing or invalid values to All.
- Book detail routes continue to use explicit `type=Novel|Comic`; All is only a
  browse state and must never be passed as a detail type.

### R3 — Folder projection and edit safety

- In All browse mode, folder counts, child-folder counts, and cover previews are
  derived from the complete recursive subtree.
- A folder containing both Novel and Comic descendants remains visible in All,
  Novel, and Comic browse states; entering it shows the complete, novel-only,
  or comic-only child projection respectively.
- In Novel/Comic browse mode, retain the existing matching-descendant rules and
  derive counts/previews from the matching subtree.
- Edit mode continues to render the complete unfiltered sibling list regardless
  of the selected browse state; reorder, move, delete, folder actions,
  optimistic saves, retry, and unresolved typed cards must preserve both media
  types.
- Switching browse states must not discard selection or optimistic state in a
  way that affects later edit operations.

### R4 — Localization and accessibility

- Provide the All tab/media label and complete generic All root/folder
  empty-state copy, reusing existing generic keys where possible, plus
  segmented-control and folder-media accessibility resources in both Simplified
  Chinese and Taiwan Traditional Chinese.
- Keep existing Novel/Comic labels, error/retry behavior, unavailable-card
  behavior, and folder actions unchanged.
- Keep resource keys and interpolation variables identical across locales.

### R5 — Preserve empty and unresolved shelf behavior

- Keep the existing valid empty-shelf behavior for `null`/empty server payloads:
  loading an empty shelf must settle into the localized empty state rather than
  a generic load error, and the empty shelf must not cause an empty hydration
  request.
- Keep unresolved/deleted book items in the typed snapshot with `book: null`.
  All, Novel, and Comic projections must retain matching unresolved items and
  render the existing unavailable-book card; a missing card must not make the
  whole shelf fail or be silently reclassified.
- Do not modify API/client-core shelf decoding or hydration in this follow-up;
  this task only adds mobile projection coverage around those existing results.

### R6 — Verification

- Add pure tests for All route parsing/serialization, default normalization,
  complete mixed projection, mixed-folder visibility in each browse state,
  recursive folder summaries/previews, deep-folder state, empty snapshots,
  unresolved cards, and no regression of Novel/Comic filtering.
- Extend localization parity/resource tests for All resources.
- Run shelf, navigation, localization, mobile typecheck, boundary, and diff
  checks; retain the existing api-client/client-core empty and unresolved shelf
  tests; device acceptance covers the three-state control, folder navigation,
  and edit-mode safety.

## Resolved product decision

- Missing or invalid `media` values default to All. The segmented control order
  is All / Novel / Comic, and the selected state is not persisted as a user
  preference.

## Out of scope

- Any API/client-core transport, decoder, or persisted shelf schema change.
- Persisting the selected media state as a user preference.
- Cross-type sorting, new card designs, or changes to history/discovery.
- Changing the complete-tree edit semantics or creating separate Novel/Comic
  shelves.

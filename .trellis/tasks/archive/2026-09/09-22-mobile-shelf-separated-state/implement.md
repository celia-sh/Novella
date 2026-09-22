# Implementation plan

## Dependency gate

1. Do not start this child until `09-22-shelf-contract-migration` has a reviewed normalized `ShelfItem`, `ShelfItemKey`, `ShelfBookRef`, `ShelfBookRecord`, and typed `contains`/`toggleBook` API. If any signature differs from this plan, update this file and the manifests first.

## Shelf state and projection

2. Add a single `ShelfMediaType` parser/state with `Novel` as the deterministic default; map it to normalized `NOVEL`/`COMIC` only at the client-core boundary and use the existing history segmented-control component with localized labels.
3. Thread the selected type through the canonical `media=novel|comic` root/folder route param and folder pushes. Invalid or absent params normalize to Novel; returning from nested folders preserves the selected type, while detail routes receive the explicit title-case `type=Novel|Comic` mapping.
4. Add a pure recursive browse projection that filters books by `ShelfItem.type`, keeps only folders with matching descendants, and derives counts/previews from the same filtered subtree.
5. Render browse mode from the filtered projection, but render edit mode from the complete sibling list. Keep selection, reorder, move, delete, folder actions, retry, and prevent-remove behavior on typed keys and the full tree.
6. Update card lookup to use typed keys/records and keep the unavailable-card tile when hydration is missing. Preserve cover activation keys, original ordering, and existing loading/error/refresh surfaces.

## Membership and localization

7. Update `useBookDetail` to pass `NOVEL`/`COMIC` refs to `shelf.contains` and `shelf.toggleBook`; show the shelf action for Comic details without changing existing loading or error semantics.
8. Add/align `zh-CN` and `zh-TW` shelf tab, empty, retry, unavailable, folder, move, delete, and accessibility resources. Keep key structures in sync and add tests for resource parity.
9. Add focused tests for:
   - recursive mixed Novel/Comic folder visibility, counts, previews, and unresolved cards;
   - the canonical `media=novel|comic` parser, Novel default, invalid/deep-link state, and detail-type mapping;
   - no load/hydrate/save on tab changes;
   - edit-mode full-tree reorder/move/delete without dropping the other type;
   - correct Novel/Comic detail route params;
   - Comic and Novel typed membership/error retry behavior;
   - a locale key inventory asserting both `zh-CN` and `zh-TW` provide tab labels, type-specific empty states, folder counts, retry/error labels, unavailable-card labels, and segmented-control/folder/move/delete accessibility labels.

## Validation

10. Register the route-state and projection tests in the existing `test:shelf` command (or add a dedicated mobile script if the test files are split), then run:
    - `npm run test:shelf --workspace @novella/mobile`
    - `npm run test:navigation --workspace @novella/mobile`
    - `npm run test:localization --workspace @novella/mobile`
    - `npm run typecheck --workspace @novella/mobile`
11. Run the API/client-core suites and workspace typecheck after integration, then `npm run check:boundaries` and `git diff --check`.
12. Perform a device/manual check for segmented state, deep folder navigation, edit/reorder, unavailable cards, Comic detail membership, and refresh/retry behavior.

## Rollback points

- If the API contract is not stable, stop before changing mobile callers.
- If browse projection is unsafe, temporarily render the existing full tree while retaining typed keys and membership updates.
- If route-state parsing causes deep-link regressions, default safely to Novel and remove only the new route parameter; do not create a second persisted shelf state.

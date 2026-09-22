# Technical design

## System boundary

This parent task coordinates two independently verifiable layers:

- `09-22-shelf-contract-migration` owns the wire contract in `packages/api-client` and the presentation-neutral shelf use case in `packages/client-core`.
- `09-22-mobile-shelf-separated-state` owns the Expo shelf projection, navigation state, edit interactions, localization, and Comic detail membership actions in `apps/mobile`.

`references/web-master` remains read-only. The parent does not add Web-only features, community keyword search, a mixed All view, or any work already owned by `09-06` or `09-18`.

## Contract and data flow

```text
GetBookShelf / SaveBookShelf
  -> api-client decoder/encoder
     -> normalized ShelfItem (NOVEL | COMIC | FOLDER)
        -> client-core typed ShelfSnapshot/ShelfDraft/use case
           -> mobile useShelf hook
              -> full-tree edit model + type-filtered browse projection
                 -> typed book/folder routes and Comic/Novel detail membership
```

The API/client-core boundary is the only place that translates legacy `BOOK` to `NOVEL`. Mobile code consumes the normalized model and never branches on wire versions or legacy names.

## Shared domain decisions

- The current write version is `20260921`; `BOOK` is a read-only compatibility alias and is never emitted.
- A book identity is `{ type: 'NOVEL' | 'COMIC', id: number }`. Folder identity remains a string id. Every key, map, selection, remove, move, reorder, and save-confirmation comparison uses the type-qualified identity.
- Hydrated card data is optional. Shelf items remain authoritative, so a missing card never removes a typed item or changes its type; mobile renders the existing unavailable-book behavior for an unresolved card.
- The shelf remains one ordered tree and one save queue. Novel/Comic is a mobile browsing projection only; changing it does not load, hydrate, reorder, or save.
- Browse filtering recursively keeps a folder when its complete subtree contains at least one book of the selected type. Counts and previews are derived from that same filtered subtree. Edit mode uses the complete unfiltered sibling list.

## Dependency and rollout

1. Finish and review the API/client-core normalized model and typed public methods.
2. Run the API/client-core tests and typechecks with mixed Novel/Comic fixtures.
3. Implement the mobile projection against the stabilized methods; do not duplicate decoder or transport logic in the screen.
4. Run mobile tests, cross-layer typecheck, boundary checks, diff hygiene, and the final integration review.

The mobile task must not enter implementation until the API child has a reviewed normalized `ShelfItem`, `ShelfItemKey`, `ShelfBookRef`, snapshot shape, and `contains`/`toggleBook` signatures. Any contract change updates the mobile design and manifests before implementation resumes.

## Compatibility and rollback

- Decoder compatibility is additive: current `NOVEL`/`COMIC`/`FOLDER` and legacy `BOOK`/`FOLDER` are accepted; malformed or unknown types still produce the existing server-category error.
- Encoding is canonical and always sends `ver: '20260921'` with normalized item types, preserving order, parents, timestamps, folder titles, and unresolved book items.
- If mixed card hydration is not proven by the existing one-to-one `GetBookListByIds` response, the API child must stop at a typed unresolved record and add a contract-specific adapter/test rather than using the grouped comic-series endpoint. The grouped endpoint is not a safe shelf hydration substitute.
- Rollback can revert the mobile projection independently while retaining the API normalization. The API/client-core child must preserve legacy read support so a server rollback does not strand existing shelves.

## Parent verification

The final review checks the complete read/write path, same numeric id in Novel and Comic fixtures, legacy migration, unresolved-card preservation, deep-folder tab state, full-tree editing, Comic detail membership, and absence of community/Web-only scope. Automated checks are supplemented by a manual device check of tab switching, folder navigation, edit/reorder, unavailable cards, and correct detail routes.

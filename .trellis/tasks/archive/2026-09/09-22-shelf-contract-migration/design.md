# Technical design

## Boundary and dependency

This child owns `packages/api-client` and `packages/client-core`. It does not add tabs, route parameters, UI filtering, community search, or speculative Web endpoints. `09-22-mobile-shelf-separated-state` consumes this child after the public normalized model and typed membership methods are stable.

## Normalized model

The API client exposes a presentation-neutral model:

- `ShelfBookType = 'NOVEL' | 'COMIC'`.
- `ShelfItemType = ShelfBookType | 'FOLDER'`.
- A book item keeps its numeric id, type, index, parents, and update timestamp.
- A folder keeps its string id, title, index, parents, and update timestamp.
- `ShelfBookRef = { id: number; type: ShelfBookType }` is the identity passed across client-core boundaries.
- `ShelfItemKey` is type-qualified: `NOVEL:<id>`, `COMIC:<id>`, or `FOLDER:<id>`. Numeric-only maps are forbidden.
- `ShelfBookRecord = { ref: ShelfBookRef; book: BookListItem | null }` keeps one record for every shelf book, including unresolved cards. `ShelfSnapshot.books` uses this record shape so the screen can retain typed unavailable items without guessing from card data.

`BookListItem.type` remains the existing title-case API card type (`Novel`/`Comic`); conversion to the uppercase shelf type happens at the boundary. The grouped `ComicSeriesListPage` shape is not used for shelf hydration because it can collapse volumes by series.

## Decoder and encoder

1. Decode the outer `{ data, ver }` envelope with the existing null/empty response behavior and error category.
2. Normalize `type`/`Type` and `updateAt`/`UpdateAt` casing already accepted by the client.
3. Accept `NOVEL`, `COMIC`, and `FOLDER` as current types. Accept legacy `BOOK` (including the existing `Book`/numeric legacy forms) as a read-only alias for `NOVEL` regardless of whether `ver` is missing, `20220211`, or `20260921`; this tolerates a mixed-version rollout. Reject unknown values with the existing server `ApiError`.
4. Preserve item order, parent paths, indexes, timestamps, folder titles, and the supplied version while decoding. Do not expose `BOOK` after normalization.
5. `saveBookShelf` canonicalizes every item and always sends `ver: '20260921'`; it never emits `BOOK`, even when the draft originated from the old version. The request keeps the existing `data` envelope and `updateAt` wire spelling.

This makes old shelves readable and guarantees that the first subsequent save upgrades the structure without dropping folders or either media type.

## Hydration and typed identity

`createShelfUseCase` treats the normalized shelf items as authoritative:

- Collect distinct typed references from the complete item tree and batch the direct, one-to-one `getBookListByIds` response within the existing request limit. Numeric request ids are deduplicated for transport, but the resulting cards are indexed by both id and returned card type. Do not call `getComicSeriesByIds` for shelf cards.
- Match a returned card only when its normalized title-case card type maps to the requested uppercase shelf type. The existing decoder may treat a missing card `Type` as `Novel`; that can satisfy a Novel ref but must never be inferred as Comic. If the same numeric id is requested as both Novel and Comic and only one typed card is returned, keep the other record unresolved; if both typed cards are returned, retain both.
- Return one record per typed shelf ref in shelf order and keep `book: null` for missing, ambiguous, or invalid card results. The original typed `ShelfItem` remains in `items`.
- If the server response is grouped or cannot prove one-to-one comic cards, add a narrowly scoped typed adapter and fixture before implementation; never infer a shelf card from a grouped series response.

Projection and save confirmation use `ShelfItemKey`/`ShelfBookRef` maps. A new or unresolved item remains visible to the next snapshot, while a removed key is removed from hydrated records. A save response or follow-up hydration cannot overwrite a newer optimistic generation.

## Public use-case and editing behavior

Change the shelf public methods to accept typed references:

```ts
contains(ref: ShelfBookRef): Promise<boolean>;
toggleBook(ref: ShelfBookRef): Promise<boolean>;
```

`toggleBook` adds a typed item at the existing insertion position or removes only the exact typed key. Folder creation, rename, move, delete, child promotion, sibling reorder, draft cloning, and change detection continue to operate on the same ordered tree. Book-moving helpers accept typed refs/keys rather than numeric-only ids. Folder keys remain unchanged.

The existing serial save queue, pending-generation barrier, optimistic publication, retry path, and stale-load protection remain in place. `contains` must compare both type and id whether it reads the cached snapshot or loads the server shelf.

## Verification design

- API fixtures cover current `NOVEL`/`COMIC`/`FOLDER`, `BOOK` with missing/`20220211`/`20260921` versions, legacy casing and numeric forms, field casing, empty/null shelf, unknown type, and canonical save payload.
- Client-core fixtures cover mixed trees, the same numeric id under Novel and Comic with both typed cards and a one-type response, unresolved cards, typed contains/toggle, move/remove/reorder, optimistic save, failed save/retry, stale response protection, and legacy-loaded then current-saved shelves.
- Package typechecks run before the mobile child consumes the signatures.

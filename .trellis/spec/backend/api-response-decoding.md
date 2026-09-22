# API Response Decoding

## Scenario: Optional Web-Master text fields

### 1. Scope / Trigger

This contract applies when `packages/api-client` decodes Web-Master DTO text
fields from `unknown`. Web-Master payloads distinguish required text from
optional display metadata, and some optional values use the empty string rather
than `null` to mean “not supplied.”

### 2. Signatures

```ts
export function decodeBookDetail(value: unknown): BookDetail;
export function decodeComicInfo(value: unknown): ComicInfo;

// Private boundary normalizer used by optional DTO fields.
function asNullableString(value: unknown): string | null;
```

### 3. Contracts

`asNullableString` owns the wire-to-domain normalization for optional text:

| Wire value | Domain value |
| --- | --- |
| non-empty `string` | unchanged `string` |
| `""` | `null` |
| `null` / `undefined` | `null` |
| any other type | `ApiError(category: "server")` |

Current consumers include `Book.Author`, `Book.LastUpdatedChapter`,
`Chapter.Font`, list `SeriesTitle` / `UserName`, and classification author and
series names. Keep explicit `Book.Author` separate from classification metadata:
Flutter omits the detail author row when the explicit author is empty, while
classification author remains available for features that deliberately use it.

Required identifiers and display fields that cannot be absent continue to use
`asString`, which rejects both an empty string and a non-string. Fields designed
to degrade to an empty presentation value use `asStringOrEmpty` explicitly.
Do not weaken `asString` globally to accommodate optional server metadata.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Optional field is `""`, `null`, or missing | Decode as `null`; do not reject the enclosing book |
| Optional field is a non-empty string | Preserve it |
| Optional field is a number, object, array, or boolean | Throw `ApiError("The server returned an invalid text field.", "server")` |
| Required text is empty or non-string | Throw the same server `ApiError` |
| Detail `Book.Author` is empty and classification author exists | Keep `authorName: null`; preserve `classification.author` separately |

### 5. Good / Base / Bad Cases

- **Good:** `Author: "Original author"` remains `"Original author"`.
- **Base:** `Author: ""` and `Extra.classification.author: "Classified author"`
  produce `authorName: null` while preserving the classified value separately.
- **Base:** `LastUpdatedChapter: ""` produces `lastUpdatedChapter: null` and the
  detail page still loads.
- **Bad:** `Author: 42` remains a protocol error rather than being stringified or
  silently discarded.

### 6. Tests Required

`packages/api-client/src/index.test.mjs` must include a detail response with:

- empty `Author` and a non-empty, separately preserved classification author;
- empty `LastUpdatedChapter`;
- empty and nullable classification series names;
- assertions for normalized domain values and successful whole-response decode.

When another optional text field is added, add its empty-string behavior to a
contract test before using it in presentation code.

### 7. Wrong vs Correct

#### Wrong

```ts
// Rejects a valid Web-Master “not supplied” representation and makes the
// entire detail page fail.
function asNullableString(value: unknown): string | null {
  return value == null ? null : asString(value);
}
```

#### Correct

```ts
function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return asString(value);
}
```

## Scenario: Nullable `GetBookListByIds` entries

### 1. Scope / Trigger

This contract applies only when `packages/api-client` decodes the response from
`GetBookListByIds`. The server can preserve the position of an unresolved or
deleted requested ID with a `null`-like non-record entry. Other book list,
search, and ranking responses remain strict collections of book records.

### 2. Signatures

```ts
class ApiClient {
  getBookListByIds(ids: number[]): Promise<BookListItem[]>;
}

function decodeResolvableBookListItems(value: unknown): BookListItem[];
function decodeBookListItems(value: unknown): BookListItem[];
```

### 3. Contracts

- `GetBookListByIds` accepts up to 24 normalized IDs per invocation.
- Its response can be a direct array or an object whose `Data` field is an
  array.
- Non-record array entries represent unresolved requested IDs and are omitted
  from the typed result.
- Record-shaped entries always pass through the strict `BookListItem` decoder.
- `client-core` restores requested history order by ID and naturally drops an
  ID absent from the decoded result.
- General `decodeBookListItems` consumers do not adopt placeholder tolerance.

### 4. Validation & Error Matrix

| Wire condition | Result |
| --- | --- |
| Valid book record | Decode and preserve it |
| `null`, `undefined`, string, number, boolean, or array entry | Omit it only for `GetBookListByIds` |
| Record with an invalid required field | Throw `ApiError(category: "server")` |
| Top-level response is neither an array nor `{ Data: array }` | Throw `ApiError("Invalid book list items.", "server")` |
| Normal list/search/ranking contains a non-record entry | Keep strict behavior and throw |

### 5. Good / Base / Bad Cases

- **Good:** Two valid records decode to two `BookListItem` values.
- **Base:** `[validBook, null]` decodes to `[validBook]`; History omits the stale
  ID without failing the page.
- **Bad:** `[{ Id: 3, Title: null, ... }]` remains a protocol error because the
  entry is record-shaped but its required title is invalid.

### 6. Tests Required

`packages/api-client/src/index.test.mjs` must invoke the public
`getBookListByIds` method with a valid record plus a `null` placeholder and
assert that only the valid ID remains. The same test must prove a malformed
record still rejects.

`packages/client-core/src/index.test.mjs` must hydrate history with an omitted
ID and assert that resolved books retain the requested history order.

### 7. Wrong vs Correct

#### Wrong

```ts
// One deleted history ID rejects the entire batch.
return rawItems.map(decodeBookListItem);
```

#### Correct

```ts
// Tolerance is scoped to the ID-batch endpoint; records stay strict.
return rawItems.filter(isRecord).map(decodeBookListItem);
```

## Scenario: Versioned typed shelf payloads and hydration identity

### 1. Scope / Trigger

This contract applies when `GetBookShelf` or `SaveBookShelf` is changed, or when
`client-core` hydrates cards for shelf items. It owns compatibility with the
Web-Master `20260921` shelf structure and prevents Novel/Comic numeric-id
collisions from leaking into presentation code.

### 2. Signatures

```ts
export const SHELF_STRUCT_VERSION = '20260921';
export type ShelfBookType = 'NOVEL' | 'COMIC';
export type ShelfItemType = ShelfBookType | 'FOLDER';
export interface ShelfBookRef { id: number; type: ShelfBookType }
export interface ShelfBookRecord {
  ref: ShelfBookRef;
  book: BookListItem | null;
}

interface ShelfUseCase {
  contains(ref: ShelfBookRef): Promise<boolean>;
  toggleBook(ref: ShelfBookRef): Promise<boolean>;
}
```

### 3. Contracts

- `GetBookShelf` keeps the `{ data, ver? }` envelope. `NOVEL`, `COMIC`, and
  `FOLDER` are the normalized domain types; legacy `BOOK`, `Book`, and numeric
  legacy book enum `0` decode as `NOVEL` even when `ver` is missing,
  `20220211`, or `20260921`. Unknown types remain server-category errors.
- `SaveBookShelf` always sends `ver: '20260921'`. It preserves item order,
  indexes, parents, timestamps, folder titles, and emits no `BOOK` alias.
- Shelf card hydration uses the direct one-to-one `GetBookListByIds` response,
  never the grouped comic-series response. Cards match by numeric id **and**
  title-case card type (`Novel`/`Comic`). A missing, ambiguous, or mismatched
  card leaves `ShelfBookRecord.book` as `null` while retaining the shelf item.
- Numeric transport IDs may be deduplicated, but maps and public identity use
  `NOVEL:<id>` / `COMIC:<id>` / `FOLDER:<id>`. A response containing only one
  type for a duplicate numeric id resolves only that type.

### 4. Validation & Error Matrix

| Wire condition | Required result |
| --- | --- |
| `NOVEL`, `COMIC`, or `FOLDER` item | Strictly decode and preserve metadata |
| `BOOK`/`Book`/legacy `0` item | Normalize to `NOVEL`; never expose alias |
| Unknown item type | Throw `ApiError(category: "server")` |
| Save from an old or missing version | Send canonical `ver: '20260921'` |
| Missing card or `GetBookListByIds` placeholder | Keep typed shelf item; set card to `null` |
| Same id requested as Novel and Comic, one typed card returned | Resolve matching ref only; other remains unresolved |
| Same id and same card type returned more than once | Treat card as ambiguous; set matching record to `null` |

### 5. Good / Base / Bad Cases

- **Good:** `{ type: 'COMIC', id: 7 }` and `{ type: 'NOVEL', id: 7 }`
  produce two distinct records and two distinct keys.
- **Base:** A legacy `BOOK` shelf loads as `NOVEL`, then the next save sends
  `NOVEL` with version `20260921`.
- **Bad:** Indexing cards only by `book.id`, or using the grouped comic-series
  result, silently attaches or removes the wrong media entry.

### 6. Tests Required

- `packages/api-client/src/index.test.mjs`: current mixed payload, missing/
  old/latest-version legacy aliases, unknown type, field casing, and exact
  canonical save request.
- `packages/client-core/src/index.test.mjs`: mixed hydration, duplicate numeric
  ids, one-type response, duplicate same-type ambiguity, unresolved records,
  typed membership, editing, optimistic save, stale response, and retry.
- Run API/client-core tests and typechecks before changing mobile consumers.

### 7. Wrong vs Correct

#### Wrong

```ts
const booksById = new Map(snapshot.books.map((book) => [book.id, book]));
await shelf.toggleBook(bookId);
```

#### Correct

```ts
const booksByKey = new Map(snapshot.books.map((record) => [
  `${record.ref.type}:${record.ref.id}`,
  record,
]));
await shelf.toggleBook({ id: bookId, type: 'COMIC' });
```

## Scenario: Public user summary through the current Hub contract

### 1. Scope / Trigger

Apply this contract when loading a public user summary from
`packages/api-client`. The current Web-Master contract exposes the summary as a
Hub operation; the removed REST route must not be reintroduced as a parallel
fallback.

### 2. Signatures

```ts
class ApiClient {
  getPublicUserSummary(userId: number): Promise<PublicUserSummary>;
}

// Internal transport shape used by ApiClient.invoke.
GetUserSummary(
  { UserId: number },
  { UseGzip: true },
): Promise<PublicUserSummaryWireResponse>;
```

### 3. Contracts

- `getPublicUserSummary` accepts only a positive safe integer and keeps the
  normalized `PublicUserSummary` return shape unchanged.
- The request invokes exactly `GetUserSummary` with `{ UserId: userId }` and
  `{ UseGzip: true }` through the shared Hub helper.
- The existing strict `decodePublicUserSummary` owns wire-to-domain conversion;
  callers and `client-core` do not parse the response or construct a REST URL.
- The old `/api/user/summary?id=<id>` endpoint constant and request path are
  removed. There is no silent REST fallback when Hub invocation fails.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Positive safe integer user id | Invoke `GetUserSummary` with exact casing and gzip options |
| Zero, negative, fractional, unsafe, or non-number id | Reject before transport with the existing valid-user-id `TypeError` |
| Valid Hub response | Decode through `decodePublicUserSummary` and return normalized data |
| Malformed Hub response | Preserve strict server-boundary decoder error behavior |
| Hub auth/server/transport failure | Propagate shared invocation error classification; do not retry through REST |

### 5. Good / Base / Bad Cases

- **Good:** `getPublicUserSummary(8)` produces one Hub call with
  `{ UserId: 8 }` and `{ UseGzip: true }`.
- **Base:** A valid Hub response has the same normalized fields and cache
  behavior for `client-core` public-profile consumers as before.
- **Bad:** Keep `publicUserSummaryPath` or catch a Hub failure by requesting
  `/api/user/summary?id=8`; this creates two competing backend contracts.

### 6. Tests Required

`packages/api-client/src/index.test.mjs` must construct an HTTP transport that
would fail if used and a Hub mock that returns a valid summary. Assert the
normalized user name and the exact `{ method: 'GetUserSummary', args: [...] }`
call, including `{ UseGzip: true }`. Keep the invalid-id assertion to prove
validation occurs before transport.

`packages/client-core` public-profile cache tests should remain green without
changing their mock interface, proving the normalized use-case boundary is
stable while transport moves from REST to Hub.

### 7. Wrong vs Correct

#### Wrong

```ts
try {
  return await this.invoke('GetUserSummary', { UserId: userId }, decodePublicUserSummary);
} catch {
  return this.request({
    method: 'GET',
    path: `/api/user/summary?id=${userId}`,
  });
}
```

#### Correct

```ts
return this.invoke(
  'GetUserSummary',
  { UserId: userId },
  decodePublicUserSummary,
);
```

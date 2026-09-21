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

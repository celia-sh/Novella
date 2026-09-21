# Fix account-specific history decoding

## Goal

Prevent one deleted or otherwise unresolvable novel in an account's reading history from failing the entire mobile History novel tab with `Invalid book list item.`.

## Confirmed Background

- Mobile first loads `GetReadHistory`, then hydrates novel IDs in batches through `GetBookListByIds`.
- `GetBookListByIds` can preserve request positions with `null`/non-record entries for IDs that no longer resolve. Accounts without stale IDs therefore work, while accounts with stale IDs hit the decoder failure.
- The current shared `decodeBookListItems` maps every response entry through the strict book decoder, so one `null` entry throws before the history use case can drop the unresolved ID.
- Web renders `bookData.filter((x) => !!x)`, intentionally omitting falsey batch entries.
- Flutter models `getBooksByIds` as `List<Book?>`, converts non-map or missing positions to `null`, and removes the corresponding missing IDs when merging history details.
- The existing mobile history use case already reorders hydrated books by requested ID and drops IDs absent from the decoded response; the shared API decoder currently prevents that behavior from running.

## Requirements

- Treat non-record entries in batch book-list responses as unresolved books and omit them from the decoded result.
- Keep strict field validation for entries that are records; do not silently accept malformed book objects.
- Preserve valid book order and the existing history use-case behavior that reorders results to the requested history ID sequence.
- Do not change `GetReadHistory`, `GetBookListByIds`, pagination, clearing, novel/comic separation, or the History screen layout.
- Add a protocol regression test using a real nullable batch shape, and retain a client-core regression proving missing hydrated IDs do not fail or render.

## Acceptance Criteria

- [x] A `GetBookListByIds` response containing valid books plus a `null` placeholder decodes the valid books without throwing.
- [x] A record-shaped book with invalid required fields still fails decoding.
- [x] History hydration preserves requested order among resolved books and omits unresolved IDs.
- [x] Accounts with clean history keep the existing behavior.
- [x] API client tests, client-core tests, workspace check, and `git diff --check` pass.
- [ ] An affected account with stale history IDs opens the novel History tab without a whole-tab error.

## Out of Scope

- Automatically mutating or clearing stale history IDs on the server.
- Redesigning History UI, pagination, local caching, or comic history.
- Relaxing strict validation for normal list/search/ranking payload fields beyond non-record batch placeholders.

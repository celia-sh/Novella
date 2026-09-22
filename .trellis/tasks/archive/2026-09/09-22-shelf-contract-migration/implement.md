# Implementation plan

## Phase 1 — API contract

1. Replace the old `BOOK`-only shelf types with normalized `NOVEL`/`COMIC`/`FOLDER` types while preserving all item metadata and legacy field casing.
2. Update the decoder to normalize legacy `BOOK` to `NOVEL`, reject unknown values, and keep null/empty/error behavior unchanged.
3. Update encoding and `saveBookShelf` so every write uses `ver: '20260921'` and never emits `BOOK`.
4. Add API tests for current/legacy fixtures, malformed types, field casing, order/parents/timestamps, and the exact save request.
5. Run:
   - `npm test --workspace @novella/api-client`
   - `npm run typecheck --workspace @novella/api-client`

## Phase 2 — client-core typed shelf

6. Add `ShelfBookRef`, type-qualified `ShelfItemKey`, and `ShelfBookRecord`; migrate `ShelfSnapshot`, `ShelfDraft`, key helpers, and editing utilities.
7. Rewrite hydrate/projection/save-confirmation maps to use typed keys, keep unresolved records, and avoid collisions for the same numeric id in different media types.
8. Update `contains`/`toggleBook` and all folder/edit helpers to preserve exact typed identity without changing the existing serialized tree rules or save queue semantics.
9. Do not use the grouped comic-series endpoint for shelf hydration; add a direct mixed-card fixture or a narrowly scoped adapter if the transport contract requires it.
10. Add client-core tests for mixed trees, duplicate ids, unresolved cards, membership, folder operations, optimistic saves, stale responses, and retry.
11. Run:
   - `npm test --workspace @novella/client-core`
   - `npm run typecheck --workspace @novella/client-core`
   - `npm run typecheck --workspace @novella/api-client`

## Phase 3 — handoff gate

12. Confirm the mobile child can import the final normalized types and call `contains({ id, type })` / `toggleBook({ id, type })` without transport knowledge.
13. Record any public signature change in the mobile child design/manifests before that child starts implementation.
14. Do not alter mobile screens in this child except for compile-driven shared type fixes that are explicitly handed off.

## Rollback and validation

- Keep compatibility decoding isolated so it can be retained if the server rollout is delayed.
- If comic hydration is not one-to-one, leave the item unresolved and stop for a contract fixture/adapter rather than silently showing a wrong series card.
- `git diff --check` and the API/client-core tests are required before handoff.

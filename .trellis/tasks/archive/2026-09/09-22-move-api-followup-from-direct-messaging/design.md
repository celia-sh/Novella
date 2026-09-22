# Technical design

## Boundaries

- The target branch is `feat/server-api-followup`; only its
  `packages/api-client` public-summary contract and focused test change.
- The source branch `feat/sync-web-master-direct-messages` is read-only for this
  task. Its private-message API/client-core, UI, native composer, and dependency
  changes remain there.
- `packages/client-core` is not modified: the existing public-profile use case
  already calls `api.getPublicUserSummary`, so changing the API client's
  transport implementation is sufficient.
- No PanelUI, direct-message wiring, unread-message field, or package-lock
  changes move to the target branch.

## Contract change

Replace the target's legacy public-summary request:

```text
GET /api/user/summary?id=<id>
```

with the Web-Master Hub operation:

```text
GetUserSummary({ UserId: userId }, { UseGzip: true })
```

The existing `decodePublicUserSummary` remains the response decoder and the
public `getPublicUserSummary(userId)` signature remains unchanged. Remove only
the obsolete `SERVICE_ENDPOINTS.publicUserSummaryPath` entry and update the
exact-call test fixture to use a Hub transport mock.

## Composition strategy

The source commit is mixed and cannot be cherry-picked. Apply the two public-
summary hunks manually to the current target files while retaining all current
shelf changes and all other target-branch code. Do not copy the source commit's
private-message additions around those hunks.

The source branch is not rebased or amended. This deliberately avoids changing
its direct-message feature history and leaves its existing API/UI relationship
intact.

## Compatibility and rollback

- The normalized `PublicUserSummary` type and client-core cache behavior do not
  change, so callers have no route or state migration.
- Rollback is a single revert of the target's public-summary API commit; it must
  restore the old endpoint constant, request path, and exact-call fixture.
- If the Hub operation is unavailable in an environment, fail at the API
  boundary rather than adding a second fallback route in client-core or mobile.

## Risk controls

- Compare the target API file before and after against the source commit with a
  focused diff, not the full mixed commit.
- Assert that `packages/client-core`, `apps/mobile`, root manifests, and the
  source branch have no task-induced changes.
- Run API-client tests/typecheck first, then workspace typecheck and boundary
  checks before committing.

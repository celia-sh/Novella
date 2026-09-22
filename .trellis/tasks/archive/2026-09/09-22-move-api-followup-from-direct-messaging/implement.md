# Implementation plan

## 1. Freeze branch evidence

- [x] Record the current target commit and source commit (`72fafcc` and
  `5cf99dd`) in the task notes before editing.
- [x] Confirm the source branch working tree and ref remain unchanged.
- [x] Keep the source mixed commit as read-only evidence; do not cherry-pick it.

## 2. Apply the narrow API hunk on the target

- [x] Remove `SERVICE_ENDPOINTS.publicUserSummaryPath` from
  `packages/api-client/src/index.ts`.
- [x] Change only `ApiClient.getPublicUserSummary` to invoke
  `GetUserSummary({ UserId })` through the existing Hub helper with gzip.
- [x] Update the matching `packages/api-client/src/index.test.mjs` mock and
  exact-call assertion.
- [x] Do not copy direct-message DTOs, operations, events, unread counts,
  client-core state, `apps/mobile/src/services/client.ts`, or any UI/native
  paths.

## 3. Verify ownership and behavior

- [x] Run the API-client focused test and typecheck.
- [x] Run workspace typecheck, boundary checks, and `git diff --check`.
- [x] Audit the target diff by path and content: only the public-summary API
  hunk/test plus task artifacts are new for this task.
- [x] Verify `feat/sync-web-master-direct-messages` still resolves to `5cf99dd`
  and has no working-tree or ref changes from this task.
- [x] Confirm no direct-message symbols or UI paths were introduced on the
  target branch.

## 4. Review and commit

- [x] Review the final diff against the task PRD/design and the source commit's
  public-summary hunk.
- [x] Record the target commit and validation evidence in the task artifacts.
- [ ] Commit the target API change only after all checks pass.
- [x] Keep rollback as a single revert of that target commit.

## Validation commands

```bash
npm test --workspace @novella/api-client
npm run typecheck --workspace @novella/api-client
npm run typecheck
npm run check:boundaries
git diff --check
```

## Verification evidence

- API-client tests: 35 passed.
- API-client and workspace typechecks passed.
- Boundary check and `git diff --check` passed.
- Source ref remains `feat/sync-web-master-direct-messages` at `5cf99dd`.
- Target diff contains no direct-message symbols or UI/package paths.

## Risk / rollback points

- **Hunk composition:** stop if the public-summary method cannot be merged
  without importing direct-message additions; resolve against the current target
  file manually.
- **Transport contract:** stop if the exact Hub method/argument test fails;
  do not retain both REST and Hub calls as an implicit fallback.
- **Ownership audit:** revert unintentional mobile/package/client-core changes
  before commit.

# Move unrelated API follow-up from direct messaging branch

## Goal

Bring the one Web-Master API follow-up in the direct-messaging branch that is
unrelated to private messages onto `feat/server-api-followup`, while leaving all
private-message API and UI work on `feat/sync-web-master-direct-messages`.

## Confirmed repository facts

- Target: `feat/server-api-followup` at `72fafcc`; it already contains the
  typed Novel/Comic shelf contract changes.
- Source: `feat/sync-web-master-direct-messages` at `5cf99dd`, whose mixed commit
  includes both private-message contracts and unrelated public-profile API work.
- The unrelated API change is the `getPublicUserSummary` migration from the
  legacy REST route `/api/user/summary?id=<id>` to the Web-Master Hub operation
  `GetUserSummary` with `{ UserId }` and gzip invocation options.
- The source commit also adds private-message DTOs, operations, realtime event
  decoders, unread-message profile state, client-core message state, and mobile
  message wiring. Those are message-related and remain on the source branch.
- The target's `packages/api-client` source and tests have independent shelf
  changes, so only the public-summary hunk should be composed into the target;
  the source's mixed commit must not be blindly cherry-picked.

## Requirements

### R1 — Migrate only the unrelated API change

Apply the `GetUserSummary` Hub contract and its focused API test expectation to
`feat/server-api-followup`, preserving the target branch's shelf contract and
all other existing API behavior.

### R2 — Keep private-message work on its branch

Do not move private-message DTOs, Hub methods, event decoders, unread-message
fields, client-core message state, mobile services, screens, routes, native
composer, navigation, localization, theme, icons, Metro, or dependency changes
to the target branch.

### R3 — Do not rewrite the source UI branch

Leave `feat/sync-web-master-direct-messages` and its mixed implementation intact;
this task only applies the unrelated public-profile API change to the target
branch and does not attempt to split or rebase the private-message feature.

### R4 — Verify the narrow boundary

The final target diff and tests must prove that exactly the public-summary API
contract moved, with no private-message or UI paths added.

## In scope

- Extracting the public-summary Hub migration from `5cf99dd`.
- Composing it with the target branch's current `packages/api-client` files.
- Updating the focused API test and validating the target branch.
- Recording the exact path/hunk boundary for future branch work.

## Out of scope

- Private-message API/client-core contracts, unread counts, events, or UI.
- Moving or rewriting `feat/sync-web-master-direct-messages`.
- New direct-message product behavior or UI redesign.
- Changes to Web-Master or reference repositories.
- Unrelated work in `09-06-sync-latest-web-master-contracts` or
  `09-18-panelui-reader-improvements`.

## Acceptance Criteria

- [x] On `feat/server-api-followup`, `getPublicUserSummary` invokes
  `GetUserSummary` with `{ UserId }` and `{ UseGzip: true }`, and the focused
  API test asserts that contract.
- [x] The target branch retains its typed shelf behavior and all existing API
  tests pass; no direct-message API/client-core or mobile UI paths are added.
- [x] `feat/sync-web-master-direct-messages` remains unchanged by this task,
  including its private-message implementation and UI dependencies.
- [x] API-client typecheck/test, workspace typecheck as appropriate, and
  `git diff --check` pass.
- [x] A path and content audit proves that only the unrelated public-summary API
  hunk was migrated.

# Branch boundary inventory

## Repository evidence

- Target branch: `feat/server-api-followup`, currently at `72fafcc` (`feat: split mobile shelf by media type`). It already contains the typed shelf changes in `packages/api-client` and `packages/client-core`.
- Source branch: `feat/sync-web-master-direct-messages`, based on `0a0f99b` and currently at `5cf99dd` (`feat(mobile): add direct messaging and native composer`).
- The source branch has three commits after the common base: `7f1575a`, `b42fbeb`, and `5cf99dd`.
- `5cf99dd` is a mixed commit: 35 files, 3,038 insertions, combining direct-message UI/native implementation with API/client-core contracts.

## API/client-core portion in `5cf99dd`

The mixed commit changes four package files, but only one change is unrelated to private messages and is in scope for this task:

- `packages/api-client/src/index.ts`: migrate `getPublicUserSummary` from
  `/api/user/summary?id=<id>` to `GetUserSummary` with `{ UserId }` and gzip
  invocation options; remove the obsolete endpoint constant.
- `packages/api-client/src/index.test.mjs`: update the public-summary fixture to
  assert the Hub method and arguments.

The same files also add direct-message DTOs, five Hub operations, realtime event
decoders, and the unread-direct-message profile field. Those hunks stay on the
source branch. `packages/client-core/src/index.ts` and its test contain only the
private-message use case from this commit and are out of scope.

The target branch has independently changed `packages/api-client/src/index.ts`
for the shelf contract, so the public-summary hunk must be composed manually or
with a path/hunk-aware patch rather than blindly cherry-picking the source commit.

## UI/native portion that should remain on the source branch

The mixed commit also changes direct-message screens, routes, navigation, localization, theme, native composer, icons, realtime presentation, Metro/package wiring, and direct-message utility tests. Representative paths include:

- `apps/mobile/modules/novella-ui/**`
- `apps/mobile/src/app/messages/**`
- `apps/mobile/src/screens/direct-message-*.tsx`
- `apps/mobile/src/components/direct-message-*.tsx`
- `apps/mobile/src/hooks/use-direct-messages.ts`
- `apps/mobile/src/localization/locales/messages.ts`
- `apps/mobile/src/theme/panel-ui-theme.ts`

## Shared / boundary-sensitive paths

- `apps/mobile/src/services/client.ts` wires the client-core direct-message use case into the mobile singleton and resets it on sign-out; it is an integration bridge, not API-client code.
- `apps/mobile/package.json`, root `package.json`, and `package-lock.json` include PanelUI and the direct-message test script; they are coupled to the UI branch and should not move with the package contracts unless explicitly decided.
- `packages/api-client` and `packages/client-core` are the narrowest API follow-up boundary and can be moved without moving direct-message UI.

## Decision

Only the unrelated public-summary API hunk moves to the target branch. Private-message API/client-core and all UI/native files stay on the source branch; the source branch is not rewritten. No code or branch history has been changed during this inventory.

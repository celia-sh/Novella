# Implementation Plan

> Completed on 2026-10-04 after user confirmation. The original contract
> migration and separate public-summary follow-up had already finished;
> remaining private-message work is now complete on `feat/direct-messages`.
> The PRD records the real verification scope; completion does not imply every
> originally proposed automated test or device scenario was executed.

## 1. Contracts and decoders

- [x] Add current unified `GetBookInfo` wire types and strict decoder fixtures.
- [x] Preserve normalized chapter navigation fields needed by novel and comic readers.
- [x] Add `SetCommunityThreadLocked` request/result and decoder tests.
- [x] Remove `Series`/`SeriesTitle` from current comment request contracts and update tests.

## 2. Client-core

- [x] Make book and comic detail use cases consume unified detail data.
- [x] Update comic list/history mapping to retain concrete book ID.
- [x] Add validated thread lock/unlock use-case method.
- [x] Update client mocks and focused tests.

## 3. Mobile navigation and comments

- [x] Update comic detail/search/discover/history/shelf/ranking/version/reader entry points to use book ID.
- [x] Migrate comic comments to Book targets and stop forwarding series title.
- [x] Migrate notification `open_book` to type-aware unified detail navigation and remove `open_series` dependency.
- [x] Add regression tests for ID routing, comment payloads, and notification targets.

## 4. Mobile thread lock UI

- [x] Add permission-gated lock/unlock action to the thread screen.
- [x] Add confirmation, in-flight guard, server-confirmed state update, and localized feedback.
- [x] Add Simplified/Traditional Chinese localization parity.

## 5. Verification

- [x] `npm test --workspace @novella/api-client`
- [x] `npm test --workspace @novella/client-core`
- [x] Focused mobile tests for comments, notifications, comic navigation, and community thread.
- [x] Workspace type checks and boundary checks.
- [x] `git diff --check`
- [x] Review diff against `Web-Master reference snapshot [COMMIT]`.

## Risk / rollback points

- Contract decoder changes: keep fixtures for both Novel and Comic current payloads before changing mobile consumers.
- Comic ID migration: update all entry points before removing title-based helpers.
- Notification routing: ensure the route can resolve type without a novel-only API call.
- Thread lock UI: never publish a speculative lock state on failed mutation.

## Follow-up: user summary and direct messages

### 6. Contract migration

- [x] Replace the removed public-summary REST request with `GetUserSummary({ UserId })` and update its exact-call test.
- [x] Add normalized direct-message DTOs, five Hub methods, and realtime event decoders; record the actual automated coverage in the completed PRD.
- [x] Decode `UnreadDirectMessageCount` on `UserProfile`.

### 7. Shared direct-message projection

- [x] Add client-core conversation/chat snapshots, paging, ordered idempotent sends, read/block mutations, event reducers, reset, and resync.
- [x] Implement merge order, response/push deduplication, failed retry, read cursors, confirmed block state, and reconnect refresh; do not claim every reducer has a dedicated test.

### 8. Mobile presentation and events

- [x] Add global realtime subscriptions and reconnect reconciliation.
- [x] Add conversation and chat routes/screens with keyboard-aware composition, older-history loading, receipt state, and retry.
- [x] Add private-message entries to navigation and public profiles, with unread count display.
- [x] Add Simplified Chinese and Taiwan Traditional Chinese localization parity.

### 9. Follow-up verification

- [x] Run existing API/client-core/mobile suites and focused unread/refresh/scroll tests; see the PRD for evidence and coverage limits.
- [x] Workspace type checks and package-boundary checks.
- [x] `git diff --check` and review against `Web-Master reference snapshot [COMMIT]`.
- [x] Close interaction acceptance on the user's 2026-10-04 completion confirmation; do not claim agent-run device or live-network verification.

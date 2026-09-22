# Implementation Plan

## 1. Update normalized API contracts

- [x] Change comic-content default batch size to 6.
- [x] Add required profile comic-quota fields and strict current-backend decoding.
- [x] Widen shop monthly limits to nullable and decode omitted/null fields.
- [x] Require point-log `sourceLabel` and reject stale/malformed payloads.
- [x] Add `UseComicQuotaCardResult`, decoder, and Hub method.
- [x] Extend API-client tests for exact operations, nullable limits, quota fields, labels, and comic batch default.

## 2. Extend client-core shop behavior

- [x] Add the quota-card key, outcome type, and use-case method.
- [x] Serialize quota-card use with existing shop mutations.
- [x] Project server-confirmed ownership before refresh fallback.
- [x] Add tests for successful use, refresh failure after success, failure without speculative publication, and validation/loading prerequisites.

## 3. Update mobile reader and presentation

- [x] Align comic reader batch boundaries to 6 and cap directional prefetch to four pages including the immediate neighbor.
- [x] Add profile quota presentation and localized permanent/daily quota explanation.
- [x] Add nullable purchase-limit presentation and purchase-state behavior without duplicating owned quantities on product cards.
- [x] Apply continuous 22/24-point iOS-style rounding to shop surfaces with proportional image and button corners.
- [x] Add quota-card confirmation, in-flight state, success/failure handling, shop update, and profile refresh.
- [x] Display required server point-log labels directly and remove the duplicate local mapping.
- [x] Add Simplified and Taiwan Traditional Chinese localization keys with shape parity.

## 4. Add public user profiles

- [x] Add the public-summary endpoint, normalized type/decoder, author/uploader IDs, and API tests.
- [x] Add the five-minute cached/deduplicated client-core public-profile use case and tests.
- [x] Register the protected root form-sheet route and build localized sheet loading/error/content states.
- [x] Add one reusable avatar profile trigger with accessibility and nested-press isolation.
- [x] Wire all supported book/comic/comment/community/notification avatar entry points and disable invalid/deleted/system users.
- [x] Add Simplified and Taiwan Traditional `user` localization resources with parity coverage.

## 5. Verify

- [x] Run `npm test --workspace @novella/api-client`.
- [x] Run `npm test --workspace @novella/client-core`.
- [x] Run mobile reader/settings/localization tests.
- [x] Run `npm run check` and `git diff --check`.
- [x] Review the final diff against `Web-Master reference snapshot [COMMIT]` and confirm category/Markdown changes remain out of scope.
- [ ] User verifies the live iOS profile/shop/log interactions.

## 6. Comment infinite-scroll follow-up

- [x] Keep `FlatList.onEndReached` as the automatic loading trigger for book and server-announcement comments.
- [x] Track the requested next page on the client instead of using a potentially stale response `Page` value.
- [x] Merge later pages by root-comment ID, stop on a repeated/empty page, and prevent a failed load-more request from auto-retrying on every scroll/layout event.
- [x] Add mobile pagination regression tests plus API-client and client-core page-two contract coverage.
- [x] Run the full client test suite, workspace type checks, boundary checks, and `git diff --check`.
- [x] Handle sparse `Commentaries`/`Users` maps without rejecting an otherwise renderable page; keep a fixed-height loading footer and a wider render window to avoid the iOS bottom blank-frame flash.
## 7. Notification contract and realtime follow-up

- [x] Replace the legacy `Type` / `ObjectType` / `ObjectId` / `Extra` notification decoder with the current `Kind` / `SchemaVersion` / `Title` / `Body` / `Tone` / `Action` / `Data` / `ReadAt` contract.
- [x] Render server-owned notification titles and bodies, normalize unknown tones to neutral, and remove client-generated action/object labels.
- [x] Validate and route `open_book`, `open_announcement`, `open_series`, and `open_community_thread`; ignore unknown actions without guessing their targets.
- [x] Add persistent SignalR event subscriptions and install one root handler for notification-count refreshes and authoritative growth snapshots; intentionally do not surface generic `OnMessage`, `OnError`, or `OnSuccess` payloads because they may describe Web-only behavior.
- [x] Keep success feedback single-sourced for growth-changing mobile mutations: check-in, shop purchase, and makeup use rely on `OnGrowthUpdate` plus their updated UI state instead of a second success alert; quota-card use keeps a dedicated result because the current growth toast only reports experience/coin deltas.
- [ ] User verifies notification tone presentation, all four action destinations, reconnect delivery, badge refresh, and server/growth toasts on iOS.


- Keep the reader's batch-size constant aligned with API request boundaries; a partial change can make page-to-batch retry calculations repeat the wrong request.
- Do not use arithmetic directly on nullable limits in UI or tests.
- Do not optimistically increment quota; refresh `UserProfile` after the server confirms card use.
- If a post-mutation shop refresh fails, publish only the ownership projection supported by the mutation response.
- Public-profile cache entries are process-memory only; rejected requests must never enter the five-minute cache.
- Avatar navigation must use decoded positive IDs, never names, and nested avatar presses must not trigger the parent route.
- No persisted storage schema changes are planned, so rollback is a normal branch revert.

# Sync mobile with Web-Master API changes

## Goal

Keep Novella compatible with the current Web-Master/backend contracts for comic reading, comic quota items, shop purchase limits, point-log labels, and public user summaries. Surface the new quota state, quota-card action, and native public-profile sheet without changing the app's HTML content model.

## Background

- The authoritative reference is `the Web-Master reference implementation` at `fb7342b`; the comparison baseline is `5505dd4`.
- Web-Master now requests comic images in batches of 6 and limits image preloading to a small forward window.
- `GetMyInfo.Growth` now includes permanent and daily comic quota balances.
- `GetShop.Items[].MonthlyLimit` is nullable and may be omitted by MessagePack/gzip serialization when unlimited. `0` means unavailable, while `null`/missing means unlimited.
- The shop exposes a `comic_quota_50` item and `UseComicQuotaCard` operation.
- `GetPointLog` and `GetCoinLog` now provide `SourceLabel`, including correct wording for `ComicRead` charges.
- Web-Master exposes `GET /api/user/summary?id=<id>`, adds author/uploader IDs where avatar entry points need them, and opens a cached public summary from user avatars.
- Novella currently uses 12-page comic batches, strictly decodes `MonthlyLimit` as a number, ignores quota fields, cannot use quota cards, derives point-log labels locally, and has no reusable public-user destination.

## Requirements

### R1 — Comic request and prefetch policy

- Request comic content in 6-page batches in both the API default and native comic reader.
- Preserve initial-position restoration, batch retry, stable slots, double-page mode, continuous mode, and 1-based persisted progress.
- Keep decoded-image prefetch bounded to four pages in the active reading direction, in addition to the current page; do not introduce unbounded or whole-chapter preloading.

### R2 — Nullable purchase limits

- Represent `ShopItem.monthlyLimit` as `number | null`.
- Decode both explicit `null` and an omitted `MonthlyLimit` field as unlimited.
- Treat `0` as unavailable and positive values as monthly limits.
- Render unlimited, unavailable, remaining, and loading states correctly without attempting to format `null` as a number.
- Keep owned quantities in the dedicated owned-items section; product cards must not repeat the same count.

### R3 — Comic quota and quota card

- Add required `comicQuota` and `comicQuotaToday` fields to the normalized user growth model; malformed or stale payloads without them must fail decoding.
- Add the typed `UseComicQuotaCard` operation and normalize its result.
- Extend the shared shop use case with serialized quota-card consumption and a server-confirmed ownership projection when the post-mutation refresh fails, matching existing purchase and makeup-card mutations.
- Show permanent and daily quota values in the profile Growth section with a localized explanation that permanent quota never expires and today's quota is the remaining daily comic-page count.
- Show a localized Use action for owned `comic_quota_50` items, require confirmation, prevent duplicate submissions, update the shared shop snapshot, refresh the profile after success, and show localized success/failure feedback.

### R4 — Server-provided point-log labels

- Add required normalized `sourceLabel` to `PointLogItem` and display the server-provided label directly in the UI.
- Retain `source` only as the stable machine identifier; do not duplicate source translation or spend/reclaim classification in the client.

### R5 — iOS-style shop surfaces

- Use React Native's continuous corner curve for shop cards and list containers.
- Increase ordinary shop/list card radii to 22 points and the prominent balance card to 24 points while keeping controls proportional and non-pill-shaped.

### R6 — Public user profile sheet

- Add a strict normalized public-user summary contract for `GET /api/user/summary?id=<positive user id>` and retain the current backend's required fields only.
- Add required community `AuthorId` and comic-volume uploader `Id` fields at the API boundary so avatar navigation never guesses identity from a name.
- Cache a successfully loaded summary for five minutes and deduplicate concurrent requests for the same user in client-core; failures are not cached.
- Present one protected root `formSheet` with `[0.5, 1]` detents, a grabber, loading/error/retry states, identity, role, level, registration date, and four activity counts.
- Open the sheet by tapping valid avatars for book/comic uploaders, comments/replies, community feed/thread/replies/active users, and notification actors. Deleted/system/invalid users remain noninteractive, and the current user's settings avatar keeps its edit behavior.
- Use one reusable avatar trigger so nested avatar taps stop propagation instead of also opening their containing thread/notification/version route.

## Acceptance Criteria

- [x] [self-verified] `GetComicContent` defaults to `Take: 6`, and the mobile reader uses aligned 6-page batch boundaries while preserving existing restore/retry behavior.
- [x] [self-verified] Comic image prefetch covers no more than four pages in the active reading direction beyond the current page.
- [x] [self-verified] Shop payloads decode positive, zero, explicit-null, and omitted monthly limits; null/omitted limits no longer fail the whole shop response.
- [x] [self-verified] The pure purchase-state resolver and typed shop UI distinguish unlimited, unavailable, and finite monthly limits; unlimited items remain enabled in the code path.
- [x] [self-verified] Profile decoding requires permanent and daily comic quotas from the current backend; typed profile presentation and localization parity cover both values and their quota explanation.
- [x] [self-verified] `UseComicQuotaCard` sends `{}` to the current Hub operation, decodes `Key`, `Granted`, `Quota`, and `Owned`, and is covered by API-client tests.
- [x] [self-verified] Using an owned `comic_quota_50` item updates shop ownership from server-confirmed state, refreshes profile quota, and has typed confirmation/in-flight/success/failure UI in both locales.
- [x] [self-verified] Point/coin logs require and display `SourceLabel` directly without a client-owned source-label fallback.
- [x] [self-verified] Shop surfaces use continuous 22/24-point corners and proportionally rounded images/buttons without pill styling.
- [ ] Public summaries strictly decode all current fields, use the exact authenticated REST route/query, reject invalid IDs/payloads, and cache/deduplicate successful loads for five minutes.
- [ ] A localized public-profile form sheet renders all identity/activity fields and consistent loading/error/retry states.
- [ ] Every supported valid avatar opens only the profile sheet; nested parent navigation does not fire, while deleted/system/invalid identities stay inert.
- [ ] Focused API-client, client-core, mobile navigation/community/settings/localization tests, workspace type checks, boundary checks, and `git diff --check` pass.
- [ ] [user-verified] On iOS, verify the profile quota row, all three shop limit states, quota-card confirmation/use feedback, server-provided point-log labels, and public-profile sheet entry points against a live account.

## Out of Scope

- Global Markdown response or storage migration; non-editing content remains HTML.
- `GetBookCategories`/`CategoryId` category-filter UI.
- Web-only Quasar layout, dependency, and component refactors.
- DNS, Cloudflare, deployment, or external repository changes.

# Technical Design

## Boundaries

The existing dependency direction remains unchanged:

```text
Web-Master/backend contracts
  -> packages/api-client (wire operation names and response decoding)
  -> packages/client-core (serialized shop state/mutations)
  -> apps/mobile services/hooks (composition and subscription)
  -> apps/mobile screens/localization (presentation)
```

Screens consume normalized camelCase models only. No Web-Master source is copied into runtime code.

## Comic loading

Change the `ApiClient.getComicContent` default `Take` and the mobile `PAGE_BATCH` constant from 12 to 6. The reader already derives batch starts through `getComicPageBatchStart`, uses the requested batch for restoration, validates whether the response contains the requested page, and merges image metadata into stable chapter slots. Keeping one shared screen constant preserves those invariants.

The existing prefetch planner includes the current page and adjacent pages as immediate work, then adds a directional disk window starting two pages away. Reduce the farther directional count from 4 to 3 so the adjacent page plus farther pages total four pages in the active reading direction. Preserve the opposite immediate neighbor for smooth reversal and existing native virtualization behavior.

## API contracts

### Growth

Extend `UserGrowth` with:

```ts
comicQuota: number;
comicQuotaToday: number;
```

Decode `Growth.ComicQuota` and `Growth.ComicQuotaToday` as required finite numbers. The updated backend contract is the only supported shape; a stale or malformed payload must fail at the API boundary.

### Shop limits

Change `ShopItem.monthlyLimit` to `number | null` and decode through the existing nullable-number helper. Both `undefined` and `null` normalize to `null`, reflecting Web-Master's note that gzip/MessagePack can omit null fields.

Presentation derives a purchase state:

- `monthlyLimit === null`: unlimited, purchasable unless another mutation is in flight.
- `monthlyLimit === 0`: unavailable.
- positive limit: remaining is `max(0, limit - monthlyPurchased)` and zero remaining means reached this month's limit.

### Quota card

Add:

```ts
interface UseComicQuotaCardResult {
  key: string;
  granted: number;
  quota: number;
  owned: number;
}
```

`ApiClient.useComicQuotaCard()` invokes `UseComicQuotaCard` with `{}` and strictly decodes `Key`, `Granted`, `Quota`, and `Owned`.

Expose `COMIC_QUOTA_ITEM_KEY = 'comic_quota_50'` from client-core, plus a `ShopQuotaOutcome` and `ShopUseCase.useComicQuotaCard()`. It shares the existing mutation queue with purchases and makeup cards. Immediately after the operation succeeds, project `owned` into both shelf and owned-item collections; then reload the full shop snapshot. If refresh fails after the mutation succeeded, publish the projected confirmed state rather than reporting the completed mutation as failed.

The quota balance itself belongs to `UserProfile`, not `ShopSnapshot`. The screen refreshes the existing profile repository after successful use, as the makeup-card flow already does for growth state.

### Point labels

Extend `PointLogItem` with required `sourceLabel: string` and strictly decode non-empty `SourceLabel`. Keep `source` only as the stable machine identifier.

The mobile row displays `item.sourceLabel` directly. The backend owns the user-facing wording and spend/reclaim semantics, so the client must not carry a duplicate source translation table or suffix logic.

## Public user summaries

Add `PublicUserSummary` to `api-client` and fetch it through authenticated HTTP `GET /api/user/summary?id=<id>`. Decode the current Web-Master fields strictly into camelCase: `id`, `userName`, `avatarUrl`, `role`, `level`, `registeredAt`, `bookCount`, `communityThreadCount`, `communityReplyCount`, and `commentCount`. Non-empty identity/role text, finite numbers, and a valid registration date are required. Community feed/reply DTOs also require `AuthorId`; comic-series volume uploaders require `Id`.

A `PublicProfileUseCase` in client-core owns a per-user five-minute success cache and one in-flight Promise per user ID. Invalid IDs reject before HTTP, concurrent loads share one request, successful values enter the cache, and rejected requests are removed without caching. Presentation never maintains a competing cross-screen cache.

Add `/user/[id]` to the authenticated root stack as a `formSheet` with `[0.5, 1]` detents, initial half-height, a visible grabber, and no custom header. A localized screen/hook owns transient loading/error/retry state and renders the shared app theme, `ProfileAvatar`, localized date/number formatting, identity metadata, and a two-by-two activity grid.

A reusable `PublicUserAvatar`/trigger owns route creation, accessibility text, disabled-ID handling, press feedback, and `stopPropagation()` for avatars nested inside navigable cards. Wire book/comic uploader, comments, community feed/thread/reply/active-user, and notification actor identities. Deleted authors, system notifications, and nonpositive IDs render unchanged without a profile action. The settings profile avatar remains an edit-avatar control.

## Mobile presentation

- Add a static comic-quota row to the profile Growth section showing permanent and daily values.
- Add owned quota-card action support to the existing shop screen instead of introducing a new route.
- Keep all alerts and labels in `settings` localization resources with Simplified and Taiwan Traditional Chinese parity.
- Reuse `showAlert`, current per-operation loading state, `profileUseCase.load()`, and shared shop subscriptions.
- Update the shop item card's purchase label and metadata according to nullable-limit semantics.
- Match the app's modern iOS surfaces by applying React Native `borderCurve: 'continuous'`, 22-point ordinary card/list radii, and a 24-point radius for the prominent balance card. Keep buttons at 10–12 points so they remain controls rather than pills.
- Keep public-profile labels in a dedicated `user` localization namespace with Simplified/Taiwan Traditional parity.

## Compatibility and rollback

Comic quota fields and point-log `SourceLabel` intentionally require the current backend contract; Novella does not carry old-server presentation fallbacks. Nullable shop limits intentionally widen the normalized type because the current gzip/MessagePack payload may omit null fields.

The changes can be reverted as one branch. The public-summary cache is memory-only and requires no invalidation migration. No persisted-state schema change, content-format migration, external service operation, or new dependency is required.

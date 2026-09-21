# Account Invite Reset and Growth Shop Contracts

## 1. Scope / Trigger

Apply this contract when changing mobile invite-code reset, growth-shop inventory, owned items, purchases, comic quota, or point-log labels across `packages/api-client`, `packages/client-core`, and `apps/mobile`.

Mobile EPUB/CBZ download is an explicit product non-goal. Shop or coin work must not introduce download DTOs, cost/permission fields, file adapters, or download UI.

## 2. Signatures

```ts
// packages/api-client
resetInviteCode(): Promise<{ inviteCode: string }>;
getShop(): Promise<{ coin: number; items: ShopItem[] }>;
getMyShopItems(): Promise<{ items: OwnedShopItem[] }>;
getPointLog(page: number, size: number): Promise<PointLogPage>;
getCoinLog(page: number, size: number): Promise<PointLogPage>;
// PointLogItem keeps Source as `source` and requires the backend-owned
// display text as `sourceLabel: string`.
buyShopItem(input: { key: string; quantity: number }): Promise<{
  key: string;
  owned: number;
  coin: number;
  cost: number;
  monthlyPurchased: number;
}>;
useSignMakeupCard(input: { date: string }): Promise<{
  date: string;
  streak: number;
  reward: number;
  coinReward: number;
  owned: number;
}>;
useComicQuotaCard(): Promise<{
  key: string;
  granted: number;
  quota: number;
  owned: number;
}>;

// GetMyInfo.Growth includes comicQuota and comicQuotaToday.
// ShopItem.monthlyLimit is number | null.

// packages/client-core
interface ProfileUseCase {
  resetInviteCode(): Promise<ProfileResetInviteCodeOutcome>;
}

interface ShopUseCase {
  getSnapshot(): ShopSnapshot | null;
  load(): Promise<ShopSnapshot>;
  buy(key: string, quantity?: number): Promise<ShopSnapshot>;
  useSignMakeupCard(date: string): Promise<ShopMakeupOutcome>;
  useComicQuotaCard(): Promise<ShopQuotaOutcome>;
  subscribe(listener: (snapshot: ShopSnapshot) => void): () => void;
}
```

Hub mappings are exact:

- `ResetInviteCode`, `{}`
- `GetShop`, `{}`
- `GetMyItems`, `{}`
- `BuyShopItem`, `{ Key, Quantity }`
- `UseSignMakeupCard`, `{ Date }`, where `Date` is a UTC `yyyy-MM-dd` string.
- `UseComicQuotaCard`, `{}`, returning `{ Key, Granted, Quota, Owned }`.

## 3. Contracts

- `api-client` exclusively owns PascalCase payload decoding. Components and hooks consume camelCase domain types.
- Invite reset requires a non-empty `InviteCode`. The server-returned code is authoritative and is projected directly into the current profile snapshot through the serialized profile mutation queue.
- Shop item `Key` and `Name` are non-empty. `Description` and `Image` may be empty strings but must still be string-typed. Prices, balances, ownership, and monthly purchased counters must be finite numbers.
- `MonthlyLimit` is a nullable number: positive values are finite monthly limits, `0` means unavailable, and `null` or an omitted field means unlimited. MessagePack/gzip may omit the field when its server value is null; never reject the enclosing shop response for that omission.
- `ShopUseCase.load()` reads `GetShop` and `GetMyItems` in parallel and publishes one snapshot.
- Purchases require a non-empty trimmed key and a positive integer quantity and execute serially.
- `UseSignMakeupCard` requires a UTC `yyyy-MM-dd` date and executes in the same serialized shop mutation queue as purchases. The server decides whether the date is eligible and returns the new `Owned`, streak, and rewards.
- `UseComicQuotaCard` executes in that same queue. `comic_quota_50` is the current item key. The returned `Owned` value updates both shop and owned-item projections; `Granted` and `Quota` are used for success feedback while the profile repository refreshes `GetMyInfo`.
- `BuyShopItem` is already a server confirmation. Project its `Coin`, `Owned`, and `MonthlyPurchased` into the current snapshot before treating a follow-up refresh failure as an operation failure. Then reload both shop endpoints to fill the complete authoritative snapshot.
- `GetPointLog` and `GetCoinLog` both accept `{ Page, Size }` and return `{ TotalPages, Page, Data }`. The API client decodes both into the normalized `PointLogPage` shape; the UI chooses the endpoint by log kind. `SourceLabel` is required backend-owned display text and the UI renders it directly. `Source` remains only the machine identifier; do not duplicate label translation or spend/reclaim classification in the client.
- `GetMyInfo.Growth.ComicQuota` and `ComicQuotaToday` are required finite numbers that normalize to permanent and daily quota balances.
- A failed `BuyShopItem` invocation publishes nothing. A successful invocation followed by a failed refresh keeps the server-confirmed projection and resolves successfully, preventing duplicate purchases caused by false failure UI.
- Mobile profile placement is `Settings > Profile`: shop is in Growth; invite reset is the first Account row above sign out. Shop opens `/settings/shop` as a normal second-level screen.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Empty reset `InviteCode` | `ApiError(category: "server")` |
| Missing/non-string shop text | `ApiError(category: "server")`; empty description/image strings remain valid |
| Missing/non-finite required shop number | `ApiError(category: "server")` |
| `MonthlyLimit` is null or omitted | Decode as `null`; present as unlimited and keep purchase enabled |
| `MonthlyLimit` is `0` | Present as unavailable and disable purchase |
| `SourceLabel` is empty or omitted | Reject the point-log response as malformed server data |
| Either comic quota field is omitted or non-finite | Reject the profile response as malformed server data |
| Empty item key or non-positive/fractional quantity | Client-core rejects before invoking SignalR |
| Purchase invocation fails | Keep prior snapshot; surface failure |
| Purchase succeeds, reload fails | Publish the confirmed purchase projection; report success |
| Concurrent purchase taps | Serialize mutations; stale completion cannot publish over the newest generation |
| Relative item image | Resolve against `SERVICE_ENDPOINTS.apiOrigin`; reject unsupported URI schemes |
| Invalid makeup date | Client-core rejects before invoking SignalR |
| Makeup operation fails | Keep prior shop snapshot and surface the server error |
| Makeup operation succeeds, reload fails | Publish the confirmed remaining-card projection; report success |
| Quota-card operation fails | Keep the prior shop snapshot and surface the server error |
| Quota-card operation succeeds, reload fails | Publish the returned `Owned` projection and report `Granted`/`Quota` success |

## 5. Good / Base / Bad Cases

- Good: purchasing one item returns coin `80`, owned `2`, and monthly purchased `2`; the use case publishes those values even when the immediate `GetShop` refresh is temporarily unavailable.
- Base: an empty `GetMyItems.Items` array renders an owned-items empty state without rejecting the shop.
- Good: a held `sign_makeup` item lets the user choose a prior UTC date, the server consumes one card, and the shared snapshot removes the item when `Owned` reaches zero.
- Good: an omitted `MonthlyLimit` keeps an unlimited quota card purchasable; using it publishes the server-returned ownership even if the immediate shop refresh fails.
- Base: a current point-log item renders `SourceLabel` exactly as returned, including `ComicRead` charges.
- Bad: decrement coin or quota in the component before SignalR confirms, or show “purchase failed” after a mutation succeeded only because a later refresh failed.
- Bad: call `GetMyInfo` after reset and require that secondary request to succeed before publishing the new code; the old code has already been invalidated.

## 6. Tests Required

- API tests assert exact Hub method names, PascalCase arguments, gzip option, valid decoding, empty-code rejection, malformed required text rejection, missing required-number rejection, nullable/omitted/zero monthly limits, quota growth fields, quota-card results, and point/coin log labels.
- Profile use-case tests assert one published profile containing the server-returned invite code.
- Shop use-case tests assert parallel load shape, subscription publication, serialized purchase order, stale-publication suppression, failed-invocation snapshot preservation, confirmed projection when refresh fails, and quota-card ownership removal/projection.
- Point-log use-case tests assert endpoint selection and page validation.
- Mobile tests assert relative/absolute shop image URL resolution and unsupported-scheme rejection.
- Pure mobile tests assert nullable-limit purchase states. API tests assert missing quota fields and missing/empty `SourceLabel` fail decoding. Mobile/UI acceptance asserts that re-entry uses an existing snapshot and that held `sign_makeup` and `comic_quota_50` items expose their actions.
- Run `npm run check`, `npm run test:client`, mobile localization parity tests, and an iOS Expo export.

## 7. Wrong vs Correct

### Wrong

```ts
await api.buyShopItem({ key, quantity: 1 });
const snapshot = await reloadShop(); // throws after the user was charged
throw new Error('Purchase failed');
```

### Correct

```ts
const result = await api.buyShopItem({ key, quantity: 1 });
const confirmed = projectServerPurchase(snapshot, result);
try {
  return publish(await reloadShop());
} catch {
  return publish(confirmed);
}
```

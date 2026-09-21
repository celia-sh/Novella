# Technical Design

## Architecture

The feature follows the existing package boundaries:

```text
Web-Master SignalR
  -> packages/api-client (wire DTOs, invoke names, strict decoders)
  -> packages/client-core (profile mutation and shop state/use cases)
  -> apps/mobile/src/services/client.ts (composition)
  -> apps/mobile/src/hooks (external-store subscription where needed)
  -> apps/mobile/src/screens + Expo Router (presentation)
```

The mobile screen will never read PascalCase response fields or invoke SignalR directly.

## API client contracts

Add domain types in `packages/api-client/src/index.ts`:

- `ResetInviteCodeResult { inviteCode: string }`, decoded from required `InviteCode`.
- `ShopItem { key, name, description, image, price, owned, monthlyLimit, monthlyPurchased }`.
- `OwnedShopItem { key, name, description, image, quantity }`.
- `ShopSnapshot { coin, items, ownedItems }` as the app-facing result of two reads.
- `BuyShopItemResult { key, owned, coin, cost, monthlyPurchased }`.
- `PointLogPage { page, totalPages, items }` is shared by `GetPointLog` and `GetCoinLog`, with normalized source, amount, balance, reference id, and occurrence time fields.

Add methods:

- `resetInviteCode()` invokes `ResetInviteCode` with `{}`.
- `getShop()` invokes `GetShop` with `{}`.
- `getMyItems()` invokes `GetMyItems` with `{}`.
- `buyShopItem({ key, quantity })` invokes `BuyShopItem` with `{ Key, Quantity }`.

Required strings/numbers use the existing strict helpers. Optional image/description fields follow the Web payload's display semantics and normalize missing values to empty strings only where the existing API decoder convention allows it. Shop images are not book covers and should not be passed through `BookCoverImage`.

## Client-core state

Extend `ProfileUseCase` with `resetInviteCode(): Promise<ProfileResetInviteCodeOutcome>`, reusing `enqueueMutation` so reset cannot race avatar/check-in mutations. The returned server code is projected directly into the current profile snapshot, matching Web-Master and avoiding a false failure if a redundant `GetMyInfo` refresh would fail after the code was already reset.

Add a separate `ShopUseCase`:

```ts
interface ShopSnapshot {
  coin: number;
  items: ShopItem[];
  ownedItems: OwnedShopItem[];
}

interface PointLogUseCase {
  loadPage(kind: 'experience' | 'coin', page: number, size?: number): Promise<PointLogPage>;
}

interface ShopUseCase {
  getSnapshot(): ShopSnapshot | null;
  load(): Promise<ShopSnapshot>;
  buy(key: string, quantity?: number): Promise<ShopSnapshot>;
  subscribe(listener: (snapshot: ShopSnapshot) => void): () => void;
}
```

`load()` reads `GetShop` and `GetMyItems` in parallel and publishes one combined snapshot. `buy()` validates a non-empty key and positive integer quantity and serializes purchase operations. The `BuyShopItem` result first provides a server-confirmed projection of coin, ownership, and quota; both read endpoints are then reloaded to complete the snapshot. If that refresh fails, keep the confirmed purchase projection instead of reporting an already-charged purchase as failed. A failed purchase invocation must not publish speculative state.

`useSignMakeupCard(date)` validates a UTC `yyyy-MM-dd` date and serializes with purchases. The server result supplies the new remaining card count, streak, and reward; the use case updates the shared item snapshot and refreshes the profile use case from the mobile screen after success. The date picker is bounded to the previous 30 UTC days and excludes today.

## Mobile composition and navigation

- Export `shop` from `apps/mobile/src/services/client.ts` using `createShopUseCase(api)`.
- Add `apps/mobile/src/app/settings/shop.tsx` and a `ShopSettingsScreen` under `apps/mobile/src/screens/`.
- Register `shop` in `apps/mobile/src/app/settings/_layout.tsx` with a normal second-level title, matching `avatar`.
- Add a growth row in `ProfileScreen` with `onPress={() => router.push('/settings/shop')}` and a disclosure accessory.
- Add a reset row before the existing sign-out row. The reset row is not mixed into the personal section and does not replace the copy-only invite code row.

- Add a native point-log form sheet route. The profile's experience and coin rows open the same sheet with an explicit `experience` or `coin` kind. The sheet calls the client-core paged use case, renders localized sources and signed amounts, and requests the next page when the list reaches the bottom.
- Keep source-label mapping and time formatting in the presentation layer over normalized camelCase log entries; the screen never reads PascalCase response fields.

## Shop presentation

Use `NativeGroupedList` for the screen shell and native grouped rows for the balance/empty/error states. Merchandise needs richer repeated content than a single native row, so use a plain `ScrollView` with compact item panels/cards inside the screen, keeping the page itself unframed. Use `expo-image` for item images with a stable square frame and a simple fallback when the URL is empty or fails; item images are not BlurHash cover assets.

The screen subscribes to the `ShopUseCase` external store through a small `useShop` hook. On first mount it loads only when no shared snapshot exists; returning to an already loaded screen does not force a network refresh. Pull-to-refresh explicitly reloads the snapshot. On a failed load it renders retry. Purchase and makeup confirmations use `showAlert`; only the selected item is disabled while the operation is in flight. On success, the use case publishes the authoritative snapshot and the screen shows a success alert. All user-facing text uses `settings` translations in both Chinese locales.

Relative image URLs are resolved in a small mobile helper:

```ts
function resolveShopImageUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';
  return normalized.startsWith('http')
    ? normalized
    : new URL(normalized, `${SERVICE_ENDPOINTS.apiOrigin}/`).toString();
}
```

The helper is pure and can be tested independently. It must not accept arbitrary unsupported protocols as a network image source.

## Error and compatibility behavior

- SignalR auth retry remains owned by `ApiClient`.
- API decoder errors remain server errors; the UI maps known states to localized copy and may display an unclassified external error message according to localization guidelines.
- Balance, quota, ownership, and purchase result always come from Web-Master responses. Local profile coin display is only a link-page summary and is not used to authorize purchases.
- No download DTOs, file adapters, or download UI are added.
- Authentication cleanup failures after credentials are committed do not revoke
  the session; this is separately covered in the auth credential contract.

## Build compatibility version

`apps/mobile/app.config.ts` resolves the app's default compatibility version from the newest semver release tag reachable from the local Git `HEAD`. This makes local `expo run:ios` and local Expo exports follow the same version as the current release without a per-build edit. If Git metadata is unavailable, it falls back to `apps/mobile/package.json` and then the pinned known-compatible version.

`.github/workflows/build_ios_ipa.yml` uses the same reachable-tag rule for PR, main, and manual branch artifacts. A release tag explicitly sets `APP_VERSION` to the tag version and requires the mobile package version to match; `APP_VERSION` remains an escape hatch for intentional preview builds. Build channel, label, and build number distinguish non-release artifacts from the release while the compatibility version stays backend-accepted.

Add focused API and client-core tests before UI checks. If the shop contract is unavailable in a test backend, the typed API tests use the existing fake SignalR transport and exact method/argument assertions. The feature can be rolled back as one branch without affecting reader or community code. Manual iOS acceptance remains necessary for native navigation, grouped rows, image loading, and alert presentation.

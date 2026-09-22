# Mobile account reset and growth shop

## Goal

Align the mobile profile experience with the latest Web-Master account and shop capabilities while keeping the requested mobile information architecture:

- Put invite-code reset in `Settings > Profile > Account` as the first row, immediately above sign out.
- Put the shop entry in `Settings > Profile > Growth` and open it as a dedicated second-level screen, following the avatar settings route pattern.
- Do not add book or comic download support. Download remains intentionally out of scope.
- Keep local and untagged CI builds backend-compatible without requiring a manual
  version edit for every build: resolve the newest reachable stable release tag
  and use it as the app compatibility version.

## Confirmed facts

- The mobile profile screen is `apps/mobile/src/screens/profile-screen.tsx`.
- The existing profile use case owns authenticated profile mutations and publishes a refreshed profile after each mutation (`packages/client-core/src/index.ts`).
- `ApiClient` already owns `GetMyInfo`, `SetAvatar`, and `SignIn` contracts (`packages/api-client/src/index.ts`).
- Web-Master `[COMMIT]` exposes `ResetInviteCode`, `GetShop`, `GetMyItems`, `BuyShopItem`, `GetPointLog`, and `GetCoinLog`; shop item images may be absolute URLs or paths relative to the API origin.
- Mobile supports Simplified Chinese and Taiwan Traditional Chinese and requires parity for every added translation key.

## Requirements

### Account

- Add a typed `ResetInviteCode` SignalR contract and expose it through `ApiClient`.
- Add `ProfileUseCase.resetInviteCode()` using the existing serialized profile mutation queue. Publish the new code returned by the server directly so a secondary profile-refresh failure cannot misreport an already-completed reset.
- Add an account row titled with a localized invite-reset action as the first row in the account section, directly before the sign-out row.
- Require a destructive confirmation before invoking the reset. Show loading/disabled state while the request is in flight, show a localized success message with the new code, and show a localized failure message on errors.
- Preserve the existing copyable invite-code display in the personal section.

### Growth logs

- Make the experience and coin values in the profile Growth section tappable.
- Open a native form sheet from either value: experience uses `GetPointLog`, and coin uses `GetCoinLog`.
- The sheet loads newest records first, supports empty/error/retry states, and loads additional pages when scrolled to the bottom.
- Show localized source, relative time, signed amount, and resulting balance. The sheet must not expose PascalCase payload fields to the UI.

### Growth shop

- Add typed contracts for `GetShop`, `GetMyItems`, and `BuyShopItem` in `api-client` with strict response decoding for required fields.
- Add a `ShopUseCase` in `client-core` that owns the loaded shop snapshot, supports subscription, loading, and serialized purchase operations, and exposes the latest server-confirmed balance/items.
- Add a localized shop row to the profile growth section. It must navigate to `/settings/shop` and show a disclosure accessory.
- Add the `/settings/shop` route and stack metadata.
- Implement a native second-level shop screen with:
  - server balance at the top;
  - purchasable items with image, name, description, price, owned quantity, monthly remaining quota, and purchase action;
  - owned-items section and an explicit empty state;
  - loading, refresh/retry, purchase confirmation, disabled quota state, in-flight state, and error handling;
  - server response as the source of truth after purchase.
- Resolve relative item image paths against `SERVICE_ENDPOINTS.apiOrigin`; do not parse raw API responses in the screen.
- Keep the screen usable for long names/descriptions and both supported locales.

## Out of scope

- EPUB/CBZ download, download permissions/costs, progress, or file adapters.
- Sign-in calendar browsing remains out of scope for this screen. The `sign_makeup` item usage flow is in scope: choose a recent UTC date and call the server's `UseSignMakeupCard` operation.
- Community protocol migration, community authoring, or other Web-Master follow-ups.

## Acceptance criteria

- [x] The new branch and Trellis child task are active and task artifacts describe the scope.
- [x] `ResetInviteCode` sends the current Web-Master operation, decodes its new code, publishes it to the profile snapshot, and has contract/use-case tests.
- [x] Profile account order is reset-invite first and sign-out second; reset confirmation, loading, success, failure, and localization are covered.
- [x] Shop DTOs and decoders reject malformed required data and decode valid Web-Master payloads; API operation mapping is tested.
- [x] Shop use-case state is shared, purchase operations are serialized, and a successful purchase publishes server-confirmed shop data even if the subsequent refresh fails; use-case tests cover load, buy, failure, and subscription behavior.
- [x] The Growth section links to a dedicated `/settings/shop` screen and the route is registered in the settings stack.
- [x] The shop screen presents balance, merchandise, quotas, owned items, empty/loading/error states, and a confirmed purchase flow in both locale resources.
- [x] A held `sign_makeup` item exposes a bounded UTC date picker and consumes one card through `UseSignMakeupCard`, updating the owned-item state and profile growth snapshot.
- [x] Experience and coin values open localized native point-log sheets backed by `GetPointLog` and `GetCoinLog`, including pagination, empty, retry, source, amount, time, and balance states.
- [x] Shop entry only loads when no shared snapshot exists; subsequent refreshes are user-triggered pull-to-refresh actions.
- [x] Downloads are absent from the implementation and task scope.
- [x] Local builds resolve the latest reachable stable tag automatically;
      untagged CI builds use the same compatibility version, release tags are
      validated against `apps/mobile/package.json`, and explicit
      `APP_VERSION` overrides remain available.
- [x] `npm run check`, `npm run test:client`, localization/resource tests, and an iOS Expo export pass.
- [ ] [user-verified] On iOS, confirm Account row order, invite reset alerts, Growth-to-Shop navigation, item images, quota states, and a real purchase flow.
- [ ] [user-verified] Confirm a local/dev or untagged CI build no longer receives
      the backend's client-version-too-low response during sign-in/session startup.

## Evidence references

- Web shop types: `the Web-Master reference implementation`
- Web shop behavior: `the Web-Master reference implementation`
- Web invite reset: `the Web-Master reference implementation`
- Existing profile UI: `apps/mobile/src/screens/profile-screen.tsx`
- Existing second-level screen pattern: `apps/mobile/src/screens/avatar-settings-screen.tsx`

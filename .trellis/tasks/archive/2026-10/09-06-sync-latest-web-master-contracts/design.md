# Technical Design

> Completed on 2026-10-04. The remaining direct-message work was delivered on
> `feat/direct-messages`, renamed from `feat/sync-web-master-direct-messages`.
> The current executable contract is
> `.trellis/spec/backend/direct-message-contracts.md`.

## Boundaries

- `packages/api-client`: wire contracts, normalized types, decoders, and Hub method.
- `packages/client-core`: use-case contracts and validation; mobile consumes these through the existing client singleton.
- `apps/mobile`: detail/list/navigation/comment target/community thread UI and localization.
- `the Web-Master reference implementation`: read-only source of truth; no changes.

## Unified Detail Flow

Keep the public normalized `BookDetail` shape as the mobile detail boundary. Extend its chapter representation only as needed to preserve real comic `sortNum`, page count, and download cost. Decode the current `GetBookInfo` envelope once, branch on normalized `type`, and remove the parallel comic-info conversion from critical paths.

Comic list/search/history data should retain both:

- a display identity (series title and cover/count), and
- a concrete `bookId` used for detail, comments, and reading.

Do not encode a series title into a route when a positive ID is available.

## Comment Flow

Make the API request type match Web-Master exactly. The mobile comment target resolver should map comic detail comments to `{ type: 'Book', id: bookId }`. Existing routes may accept legacy parameters only during a controlled compatibility transition, but they must not forward `SeriesTitle` to the current API.

## Notification Flow

Resolve `open_book` as an ID-only target. Open through a route/screen that can load the unified detail and determine `Book.Type`; do not issue a speculative novel-only request. Keep strict positive integer validation and no fallback from unknown action data.

## Thread Lock Flow

Add a typed API result and client-core method beside existing thread delete/like/favorite methods. The mobile hook owns the in-flight state and updates the loaded thread only from the server result. Use the existing `canEdit` permission and localized error/confirmation patterns.

## Compatibility and Rollback

The current backend may temporarily retain old methods, but the implementation targets the current Web-Master contract and tests current payloads. No persisted storage schema changes are required. Rollback is a normal branch revert; legacy route parameters should not be reintroduced as the primary contract.

## Direct-message Follow-up Design

### Data flow

```text
Web-Master Hub DTO / MessagePack event
  → api-client strict decoder and ISO-time normalization
  → client-core direct-message projection
  → mobile external-store hooks
  → conversation list / chat screens
```

`api-client` owns the five Hub methods and all untyped event decoding. `client-core` owns conversation/message merge, pagination cursors, optimistic pending messages, per-peer serialized sends, read cursors, confirmed block state, reset, and reconnect resynchronization. Mobile owns UUID creation, event subscription, lifecycle presentation, routes, keyboard behavior, alerts, and localization.

### Projection rules

- Conversations are keyed by `peer.id` and sorted by descending `lastMessage.id`.
- Stored messages are keyed first by server `id` and second by `clientMessageId`, then sorted ascending by server ID.
- A pending send uses normalized plain text plus one stable UUID. Success or matching realtime delivery removes it; failure retains it as `failed` for idempotent retry.
- Each peer has one promise queue so rapid sends cannot arrive out of user order.
- Read and peer-read cursors only increase. Block and `canSend` values are replaced only by server responses/events.
- A reconnect reloads the latest conversation page and each already-loaded chat. Older-history pagination cursors are not replaced when the chat already contains earlier pages.
- Sign-out resets all private-message state.

### Mobile presentation

Use a root `messages` stack: a native large-title conversation list and a pushed peer chat. The conversation `FlatList` is the screen's native scroll owner; do not wrap it in a native `View` or create empty scroll range with `flexGrow` for short lists.

The chat uses `Animated.ScrollView` and `useDirectMessageScroll`, with a root `KeyboardProvider`. `NativeDirectMessageComposer` uses UIKit keyboard layout and reports its occupied height. The hook owns one bottom inset: composer height plus the larger of keyboard height and resting safe area. On iOS, inset and absolute bottom offset change together at keyboard-animation start; presentation frames drive visual updates. Initial positioning waits for content, viewport, and composer measurements before revealing the transcript. Input growth follows the same animated height without forcing the viewport while reading history.

Tapping the transcript invokes the native composer's `blur()`; scrolling retains interactive keyboard dismissal. Message bodies remain selectable plain text. Outgoing pending and confirmed rows share the client-message key, bubbles size independently from their receipt footer, and entering animation uses opacity/translation rather than scale. The public-user sheet supplies a direct-message action only for users other than the signed-in user, using the mail icon.

### Unread state and notifications

`GetMyInfo.UnreadDirectMessageCount` supplies the private-message count. The community ellipsis menu keeps the private-message entry and badge, the bell shows notification unread count, and the Community tab sums both counts. Zero hides a badge and values above 99 display `99+`.

`ProfileUseCase.refresh()` waits for an older in-flight query before requesting a fresh snapshot. Incoming messages update the transcript immediately and trigger coalesced profile/conversation refresh; own read receipts refresh counts too. Session recovery and the transport's `onreconnected` callback both trigger full direct-message resynchronization.

Notification "mark all read" invokes `MarkNotifications({ All: true })`, including unread pages that have not been loaded. Its action remains available while either the profile count or loaded items indicate unread notifications.

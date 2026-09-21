# Technical Design

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

Use a root `messages` stack: a native large-title conversation list and a pushed peer chat. The chat uses `KeyboardChatScrollView` plus `KeyboardStickyView`; do not add a custom responder or React Native `KeyboardAvoidingView`. Message bodies render as selectable plain text. The public-user sheet supplies a direct-message action only for users other than the signed-in user.

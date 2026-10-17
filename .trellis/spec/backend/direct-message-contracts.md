# Direct Message and Notification Contracts

## 1. Scope / Trigger

Read this contract for private-message API/projection changes, notification
read mutations, unread badges, realtime recovery, and chat keyboard/layout work
across `packages/api-client`, `packages/client-core`, and `apps/mobile`.
It describes the implementation completed on 2026-10-04, including work from
the former `feat/sync-web-master-direct-messages` branch.

## 2. Signatures

| API client method | Hub method | Exact request fields |
| --- | --- | --- |
| `getDirectConversations(request)` | `GetDirectConversations` | `{ BeforeMessageId, Size }` |
| `getDirectMessages(request)` | `GetDirectMessages` | `{ PeerUserId, BeforeMessageId, Size }` |
| `sendDirectMessage(request)` | `SendDirectMessage` | `{ RecipientUserId, ClientMessageId, Content }` |
| `markDirectMessagesRead(request)` | `MarkDirectMessagesRead` | `{ PeerUserId, ThroughMessageId }` |
| `setDirectMessageBlock(request)` | `SetDirectMessageBlock` | `{ UserId, IsBlocked }` |
| `markNotifications(ids)` | `MarkNotifications` | `{ Ids }` |
| `markAllNotifications()` | `MarkNotifications` | `{ All: true }` |

These use the existing gzip Hub invocation path with `{ UseGzip: true }`.
Mobile code consumes the camelCase request/result types exported by API client.

```ts
// Shared application services
interface ProfileUseCase {
  load(): Promise<UserProfile>;
  refresh(): Promise<UserProfile>;
}
interface NotificationsUseCase {
  markAll(): Promise<void>;
}
interface DirectMessagesUseCase {
  loadConversations(): Promise<DirectMessagesSnapshot>;
  resync(): Promise<void>;
}

// Mobile refresh coordination
declare function createDirectMessageRefresh(
  profile: Pick<ProfileUseCase, 'refresh'>,
  directMessages: Pick<DirectMessagesUseCase, 'loadConversations' | 'resync'>,
): (resync?: boolean) => Promise<void>;
```

Realtime subscriptions are `OnDirectMessage`, `OnDirectMessageRead`, and
`OnDirectMessageBlockChanged`. The native transport also exposes
`subscribeReconnected(listener)`; registration returns an unsubscribe function.

## 3. Contracts

### Messages and projection

- API client owns PascalCase decoding and timestamp normalization. Message IDs
  and sender IDs are positive integers; cursors/counts are nonnegative;
  `HasMore`, `IsBlockedByMe`, and `CanSend` are booleans.
- Conversation pages contain `Items`, `HasMore`, and `NextBeforeMessageId`.
  Message pages additionally contain `Peer`, both read cursors, unread count,
  and block/send state. Decode these before publishing to mobile.
- Client-core owns per-peer send queues, pending/failed messages, stable client
  IDs for retries, message deduplication, monotonic read cursors, and confirmed
  block state. Sending normalizes line endings, trims whitespace, requires a
  nonempty body/client ID and valid creation date, and limits content to 2,000
  Unicode code points. Bodies render as plain text.
- Reset clears private state at sign-out. Resync reloads conversations and
  already-loaded chats; UI components must not create competing repositories.

### Authoritative unread state

- `GetMyInfo.UnreadDirectMessageCount` maps to
  `UserProfile.unreadDirectMessageCount`; omitted/null values default to zero,
  and negative values clamp to zero for compatibility.
- Keep notification and private-message counts separate. The bell shows
  notifications; the existing ellipsis menu and its private-message item show
  private messages; the Community tab sums both counts. Hide zero badges and
  display `99+` above 99.
- Incoming messages update the private-message projection immediately, then
  request profile/conversation reconciliation. Own read events and successful
  read mutations refresh the profile too. Do not increment the global badge
  locally in addition to fetching the server count.
- `load()` deduplicates a current query. `refresh()` waits for that query and
  then requests newer state, so an event or read mutation is not represented by
  a request that started before it.
- Refresh requests coalesce; an event arriving during a refresh schedules a
  trailing pass. A resync request remains pending until a full resync occurs.
  Profile and conversation failures are independent and do not block a later
  retry.
- Session recovery and automatic SignalR `onreconnected` both trigger resync.
  Session status alone does not report every automatic transport reconnect.
  Disposed subscribers and callbacks after transport closure are ignored.

### Notifications and native layout

- Marking all notifications read uses `{ All: true }`, not the IDs in the
  currently loaded page. Availability considers the profile unread count and
  loaded unread items; submission uses an in-flight guard and then reconciles
  notifications/profile with the server.
- Chat scroll ownership is `Animated.ScrollView` +
  `useDirectMessageScroll`, with a root `KeyboardProvider`. The composer is
  `NativeDirectMessageComposer`, backed by UIKit; do not restore the obsolete
  `KeyboardChatScrollView` / `KeyboardStickyView` composition.
- One owner computes `bottomInset = composerHeight + max(keyboardHeight,
  safeAreaBottom)`. UIKit automatic inset adjustments are disabled on the
  transcript. At the bottom, the offset is
  `max(0, contentHeight - viewportHeight + bottomInset)`.
- iOS inset/offset targets update at keyboard-animation start. Presentation
  frames drive visual updates; input-height animation drives the same scroll
  inset. Reading history must not force scrolling to the bottom.
- Reveal the initial transcript only after viewport, content, and composer
  measurement and initial positioning. Pending/confirmed outgoing rows share
  their client key; bubble width is independent of receipt-footer width.
- Transcript taps call the native composer's `blur()`; interactive scroll
  dismissal remains available and composer taps do not trigger dismissal.

## 4. Validation / Error Matrix

| Condition | Behavior |
| --- | --- |
| Invalid message identity/cursor/boolean/timestamp | API decoding rejects malformed server data |
| Empty/oversized body, invalid peer/client ID/date | Client-core rejects before sending |
| Send fails | Retain failed pending message and reuse its client ID on retry |
| Read/block request fails | Do not publish unconfirmed read/block state |
| Old profile query already in flight | Wait, then query again for fresh counts |
| Event arrives during reconciliation | Perform a trailing refresh without parallel request bursts |
| Reconnect arrives during ordinary refresh | Preserve the full-resync requirement |
| Current page read, global notification count positive | Keep mark-all action available; send `{ All: true }` |
| Keyboard opens or input grows while at bottom | Update inset and bottom offset together |
| User reads older messages | Preserve reading position rather than forcing the bottom |

## 5. Good / Base / Bad Cases

- Good: 30 unread notifications remain outside the loaded page; mark-all clears
  them with one `MarkNotifications({ All: true })` operation.
- Base: an older profile response omits the private-message count; notification
  unread state remains valid and the private-message badge is hidden.
- Bad: subscribe only to session status for reconnect recovery; SignalR can
  automatically reconnect while that status stays unchanged.
- Bad: reserve safe-area space in both the native composer height and scroll
  adjustment; the transcript starts short of the real bottom or jumps later.

## 6. Tests / Evidence

Current tests cover profile unread decoding/defaults, all-page notification
marking, refresh ordering/failures, burst coalescing/reconnect requests, badge
aggregation, keyboard targets, bottom-inset calculations, and locale parity:

- `packages/api-client/src/index.test.mjs`
- `packages/client-core/src/index.test.mjs`
- `apps/mobile/src/services/community-utils.test.mjs`
- `apps/mobile/src/services/direct-message-refresh.test.mjs`
- `apps/mobile/src/services/unread-counts.test.mjs`
- `apps/mobile/src/services/direct-message-utils.test.mjs`
- `apps/mobile/src/localization/resources.test.mjs`

These passing suites are not evidence that every private-message Hub method or
projection reducer has a dedicated test. When changing those contracts, add
exact request/response and merge/retry/read/block assertions for the affected
behavior. Native visual and live-network acceptance follow the frontend
quality policy; type checks, JS export, and Swift parsing do not replace them.

## 7. Wrong vs Correct

```ts
// Wrong: clears only notifications already loaded into the UI.
await notifications.mark(items.filter(item => !item.isRead).map(item => item.id));

// Correct: clears every unread notification at the server.
await notifications.markAll();
await profile.refresh();
```

Use `profile.refresh()` after an event/read mutation instead of relying on
`profile.load()` to reuse an older query. Preserve both session recovery and
transport reconnection subscriptions when refactoring realtime handling.

# Reader Progress and Session Contract

## Reference Findings

### Flutter

The archived scroll and paged readers own chapter transitions inside one reader
state object. `_targetSortNum` changes and `_loadChapter()` replaces the active
chapter without pushing a new route. `_loadVersion` invalidates stale content,
font, and post-frame restore work. A transition snapshots the old chapter
before loading the new one, resets visible-position state, restores exactly
once, then saves the new chapter boundary even if the user does not scroll.
Lifecycle pause/inactive also snapshots progress.

Relevant source:

- `the archived Flutter implementation`
  (`_saveCurrentPosition`, `_restoreScrollPosition`, `_loadChapter`, `_onPrev`,
  `_onNext`, `didChangeAppLifecycleState`)
- `the archived Flutter implementation`
- `the archived Flutter implementation`

Flutter's local Gist synchronization and metadata envelope remain excluded from
RN. Its useful contracts are internal chapter replacement, request generations,
local-first durability, lifecycle snapshots, and one-time restore.

### Web-Master

Web-Master uses `router.replace()` for previous/next, so the Vue Read component
is reused for a changed route rather than adding browser-history entries. It
restores the server `ReadPosition` when it belongs to the returned chapter and
uses an IntersectionObserver plus debounce to save local and server positions.

Relevant source:

- `the Web-Master reference implementation`
- `the Web-Master reference implementation`

RN must not copy two Web weaknesses: content requests have no explicit
last-request-wins generation in `Read.vue`, and each chapter creates another
IntersectionObserver without an obvious disconnect path.

## Corrective Root-Cause Analysis

The first RN queue implementation fixed server write ordering but still failed
the visible resume loop for three independent reasons:

1. `useBookDetail` loaded only on mount. The detail route remained mounted under
   the reader, so returning displayed its old immutable `BookDetail` snapshot.
2. A debounced queue staged local state only when its Promise tail ran. Reader
   blur and detail focus can happen before that microtask, allowing immediate
   re-entry to observe the previous cache value.
3. A successful SignalR acknowledgement changed local state to `synced`, after
   which any unversioned `GetBookInfo`/chapter response was treated as newer.
   A stale server echo could therefore roll back the just-confirmed canonical
   position.
4. RN used `itemVisiblePercentThreshold: 20`. Unlike Flutter's any-visible top
   item rule, a tall HTML block could never be 20% visible, so scrolling never
   produced a new locator. Restore also required exact XPath equality and could
   not map a Web inline-child XPath back to its rendered block ancestor.
5. Scroll restore called `FlatList.scrollToIndex()` before far-away cells were
   measured, then treated the request as complete immediately. Near-end targets
   could therefore remain visually at the chapter start even when the correct
   XPath had already been saved.

The correction separates synchronous publication of the canonical checkpoint
from asynchronous persistence. Every visible checkpoint first updates an
observable in-memory mirror. Detail screens subscribe and refresh on focus.
Disk and SignalR consume serialized copies of that same checkpoint afterward.
There is no time lease and no second position coordinate: pending or
current-process progress wins only until the server echoes the exact chapter
and locator/page, which clears the local barrier immediately.

## RN Invariants

1. **One reader route per reading session.** Previous, next, and catalog
   selection update the existing reader route's params through its bound
   navigation object. A catalog sheet publishes intent to that exact route key
   and dismisses itself. It never replaces the sheet with another reader route.
2. **Last request wins.** Chapter content, fonts, image batches, restore work,
   and view callbacks from an old chapter cannot publish into the active
   chapter.
3. **Snapshot before transition.** A chapter transition captures the last
   visible locator/page synchronously, queues it, clears the active-chapter
   guard, then updates chapter params. UI transition does not wait for network.
4. **Ordered writes per book.** Debounced motion coalesces to the latest
   position. Chapter-boundary writes are committed immediately and all server
   writes are serialized, including writes from overlapping screen instances.
5. **Local first, acknowledged second.** A cache record is written with
   `syncState: pending` before SignalR. The exact record is marked `synced` only
   after server acknowledgement; an older acknowledgement cannot mark a newer
   record synced.
6. **Restore precedence.** Explicit `start`/`end` intent wins. For `saved`, a
   pending or current-process canonical checkpoint wins over a stale
   unversioned server echo. No timer is involved: the barrier clears as soon as
   the server echoes that exact chapter and locator/page.
7. **Mode changes preserve session position.** Switching scroll/paged uses the
   current visible block/page, not the chapter's original restore position.
8. **Lifecycle is retryable.** Blur/background commits the current snapshot.
   Background drain may time out, but local pending state is already durable.
   Foreground commits again, retrying an unacknowledged identical position.
9. **Initial chapter boundary is progress.** Once restore is resolved, the
   initial visible block/page is committed so selecting a chapter without
   scrolling still synchronizes that chapter.
10. **Display and restore share one projection.** Book detail subscribes to
   staged checkpoints and refreshes on focus. Reader restore consumes the same
   server-compatible locator/page; no private offset-based progress is stored.

## Timing Matrix

| Situation | Required result |
| --- | --- |
| Rapid scroll events | Only latest scheduled position persists |
| Scroll then immediately next chapter | Old visible position is queued before new chapter boundary |
| Rapid A → B → C requests | B completion is ignored; C owns UI and progress |
| Old viewability callback after transition | Active chapter guard rejects it |
| Old comic image batch after transition | Request generation and chapter id reject it |
| Switch scroll ↔ paged | Current session index becomes the new mode's initial index |
| Select from chapter sheet | Sheet dismisses; existing reader route key updates; one Back exits reader |
| Background during debounce | Pending timer is flushed; local cache is durable before network |
| Background network timeout | Cache remains pending and foreground retries |
| Old server save acknowledges late | Per-book serialization and expected-record check prevent regression |
| Local pending vs stale server echo | Pending local wins for that chapter |
| Return to still-mounted detail | Subscription updates Continue immediately; focus refresh cannot roll it back |
| Immediate reader re-entry | Current-session checkpoint wins even after server acknowledgement |
| Server cache lag after acknowledgement | Current-process canonical checkpoint wins until an equal server echo |
| Server echoes saved checkpoint | Local barrier clears immediately; no timeout |
| Cold process start with synced cache | Server wins unless the durable record is still pending |
| Manual chapter intent vs server chapter | Manual target is not redirected by server progress |

## Implementation Ownership

- `packages/reader-engine`: pure restore policy and serialized/coalescing write
  queue with race regression tests.
- `apps/mobile/src/services/reader-position-cache.ts`: durable pending/synced
  cache and guarded acknowledgement.
- `apps/mobile/src/services/reader-progress-sync.ts`: process-wide per-book
  serialization across screen instances.
- `apps/mobile/src/hooks/use-reader-position-saver.ts`: React lifetime adapter
  around the shared write queue.
- `apps/mobile/src/hooks/use-reader-chapter.ts`: request generation and restore
  resolution.
- `apps/mobile/src/services/reader-chapter-selection.ts`: route-key-targeted
  catalog intent.
- Novel/comic reader screens: current visible snapshot, active-chapter guard,
  bound param updates, mode continuity, and presentation only.

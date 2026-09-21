# Request Scheduling

## Shared Window

- HTTP and SignalR physical attempts share `RateLimitRequestScheduler` in
  `packages/api-client` and the Web-Master-compatible limit of 9 starts per
  5.5 seconds. Retries consume another slot.
- The scheduler owns queue priority. Transports only own physical HTTP,
  WebSocket, authentication-header, and lifecycle behavior; do not create a
  second queue in `ExpoSignalRTransport`.

## Priority Contract

- Requests are either `interactive` (default) or `preload`. Authentication,
  visible screen data, progress saves, and user actions must remain
  interactive.
- When multiple requests are waiting for a rate-limit slot, interactive FIFO
  work starts before preload FIFO work. Priority cannot interrupt a Hub
  invocation that has already started.
- Background producers must submit at most one preload request at a time. Never
  enqueue a whole book: even a priority queue cannot remove bandwidth already
  consumed by started work.

## Cancellation

- Optional `AbortSignal` cancellation removes a request only while it is still
  in the scheduler. The scheduler rejects it with `RequestCancelledError` and
  it must never reach the transport.
- SignalR invocation and `expo-image` prefetch APIs do not support transport
  abortion in the current stack. Generation-scoped callers therefore ignore
  an obsolete in-flight result and submit no next item.
- Chapter changes, reader exit, disabled preloading, and app background must
  abort the active preload generation. Completed cache entries may remain
  available within the same reader session; pending work may not.

## Reader Preloading

- The device-local reader setting is an integer lookahead from 0 through 3;
  zero disables preloading and the default is one chapter.
- Start only after the active chapter is visibly ready. Preload all configured
  chapter payloads first, then their images one-by-one into the disk cache.
- Prefetched chapter responses are session-scoped and bounded. They may satisfy
  a start/end boundary chapter transition, but must not carry an old
  `readPosition` into restoration. Saved-position opens remain interactive and
  resolve the canonical progress path normally.

## Required Tests

- An interactive request queued behind a preload starts first when a slot opens.
- Aborting a queued preload prevents its operation from running.
- A reader preload use-case call forwards both `priority: 'preload'` and its
  `AbortSignal` to `ApiClient`.
- Existing request-window and authenticated physical-retry tests remain green.

## Scenario: Comic page batches and image lookahead

### 1. Scope / Trigger

Apply this contract when changing `GetComicContent`, comic page-to-batch calculations, or native comic image prefetch. Comic page metadata may consume reading quota, so request and image lookahead must remain bounded and aligned.

### 2. Signatures

```ts
// packages/api-client
export const COMIC_CONTENT_BATCH_SIZE = 6;
getComicContent(request: {
  chapterId: number;
  skip?: number;
  take?: number;
}): Promise<ComicContent>;

// apps/mobile
createComicPrefetchPlan(
  index: number,
  total: number,
  direction: -1 | 1,
  directionalCount: number,
): { immediate: number[]; directional: number[] };
```

### 3. Contracts

- `ApiClient.getComicContent` defaults to `{ Skip: 0, Take: COMIC_CONTENT_BATCH_SIZE }`; the current batch size is 6.
- The mobile comic reader imports that shared constant for every restore, retry, containment, merge, and failed-batch calculation. Do not duplicate the numeric value in the screen.
- Initial restoration requests the batch containing the requested logical page. A stale total may require one corrected request after the first response supplies the authoritative total.
- The immediate image tier includes the current and adjacent logical pages. The farther disk tier uses 3 pages in the active reading direction; together with the directional adjacent page this bounds forward/backward lookahead to 4 logical pages.
- Metadata loading may request the immediate batches and the directional edge batch. It must not enqueue the whole chapter, and stale request generations must not publish.
- Logical progress remains a 1-based page string; batch-size changes never alter persisted positions.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Requested page lies outside chapter bounds | Clamp before deriving the batch start |
| Response batch does not contain the requested page | Surface the existing comic-page unavailable state |
| Batch request fails | Mark only that batch failed and expose retry |
| Reader direction changes | Recompute the bounded directional tier; do not retain an unbounded old queue |
| Chapter/request generation changes | Ignore stale completion and clear in-flight/failed batch state |
| Six-page batch boundary | Starts are multiples of 6 and merge by the server-returned `Skip` |

### 5. Good / Base / Bad Cases

- Good: opening logical page 9 requests `Skip: 6, Take: 6`, merges returned images at that offset, and persists position `"9"`.
- Base: at page 1, unavailable negative lookbehind entries are omitted and only in-range lookahead is prefetched.
- Bad: request 12 pages while calculating retries on 12-page boundaries after the service has moved to six-page batches; pages 7–12 can repeatedly request the wrong batch.
- Bad: prefetch all remaining image URLs because they are present in chapter metadata; that defeats quota and bandwidth limits.

### 6. Tests Required

- API-client tests assert the default Hub call uses `Take: 6`.
- Comic layout tests assert six-page batch starts and containment behavior.
- Prefetch tests assert one immediate directional neighbor plus three farther pages, chapter-bound clamping, and backward direction.
- Existing restore, retry, double-page, segmented-image, and 1-based progress tests remain green.

### 7. Wrong vs Correct

#### Wrong

```ts
const PAGE_BATCH = 12; // drifts from the protocol boundary
await api.getComicContent({ chapterId, skip: batch * PAGE_BATCH, take: PAGE_BATCH });
```

#### Correct

```ts
const PAGE_BATCH = COMIC_CONTENT_BATCH_SIZE;
const batchStart = getComicPageBatchStart(pageIndex, total, PAGE_BATCH);
await api.getComicContent({ chapterId, skip: batchStart, take: PAGE_BATCH });
```

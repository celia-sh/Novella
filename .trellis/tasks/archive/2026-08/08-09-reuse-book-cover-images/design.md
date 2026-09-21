# Cover URL repair and reuse design

## Evidence

Metro recorded a list URL failing with HTTP 401 because its raw BlurHash contained `#`:

```text
https://img.lightnovel.life/..._md.jpg?placeholder=J8RyW#-=9sR:_NIq&t=...
```

The URL repair belongs at the API boundary: replace raw `#` inside `placeholder` with `%23` while preserving every other byte and the trailing signature.

The archived Flutter client establishes the reuse behavior:

- List navigation passes `initialCoverUrl: book.cover` to detail.
- Detail explicitly chooses `initialCoverUrl` before `book.cover`, with the comment “复用封面 URL 利用缓存”.
- Both list and detail use `BookCoverImage` with the same URL.
- Flutter's widget also specifies a decode width, but that memory optimization is outside this task and is deliberately not copied because it would change the existing RN image decode/layout behavior.

The list `_md.jpg` and detail `.jpg` are distinct resources. Reuse therefore requires retaining the list URL in detail; switching to the detail URL necessarily loads twice.

## Design

### URL normalization

At the API decoding boundary:

1. Locate the raw `placeholder=` value by string offsets, stopping at the next `&` rather than `#`.
2. Replace only raw `#` bytes with `%23`.
3. Preserve existing percent escapes and signed parameters byte-for-byte.
4. Validate a separately decoded copy as BlurHash.
5. Normalize all book/comic cover contracts.

### Native pixel reuse

`BookCoverImage` owns a module-local lease cache:

- Cache identity is the normalized image path plus all non-placeholder query parameters (especially the signed `t`). The BlurHash `placeholder` parameter is excluded because Expo Router may decode its percent escapes, producing different strings for the same image resource.
- `Image.loadAsync` loads the original image without width or height constraints; this task changes reuse only.
- Concurrent and later consumers share one Promise and one native `ImageRef`; reveal state uses the same identity so a route encoding change cannot trigger an extra fade.
- The detail screen keeps `initialCoverUrl` when present; routes without a hint use detail data.
- Mounted consumers hold leases. Released entries enter an LRU capped at 16 inactive covers.
- Retry evicts the shared entry before requesting again.
- Image-cache clearing marks active entries for release and immediately releases inactive entries.

Existing BlurHash, fade, loading, retry, and accessibility behavior remains owned by `BookCoverImage`.

## Scope

- `packages/api-client/src/index.ts`
- `packages/api-client/src/index.test.mjs`
- `apps/mobile/src/components/book-cover-image.tsx`
- `apps/mobile/src/screens/book-detail-screen.tsx`

# 技术设计：详情页快速搜索

## Scope and boundaries

本任务只修改 RN/Expo mobile presentation 与其 device-local settings/纯函数；不修改 `packages/api-client` 或 `packages/client-core` 的搜索协议。现有 `BookDetail` 和搜索路由已经携带本功能所需的数据和参数。

- **数据来源**：`BookDetail.classification.seriesName/seriesNameCn`、`BookDetail.category.name/shortName`、`title`、`authorName`、`classification.tags`。
- **纯业务解析**：`apps/mobile/src/services/book-quick-search.ts`，负责系列名优先级、日文原版分类识别、空白/回退和搜索目标模式。
- **持久化偏好**：`apps/mobile/src/services/settings.ts`，沿用 `AppSettings` 快照、`decodeSettings` 校验和 `updateAppSettings` 串行写入。
- **详情呈现**：`apps/mobile/src/screens/book-detail-screen.tsx`，Hero 的标题/作者传入 press handler；同一 `BookHeroContent` 被 iOS 内嵌 Hero 和 Android 折叠 Hero 复用。
- **标签呈现**：`apps/mobile/src/screens/book-info-sheet-screen.tsx`，标签行关闭当前 sheet 并替换到搜索路由。
- **搜索导航**：复用 `/(tabs)/(search)/search`，通过 `query`、`mode`、`format` 参数进入既有 `BookSearchScreen`。

## Domain contract

```text
SeriesSearchMode = system | original | display

resolveSeriesSearchKeyword(classification, category, mode): string | null

original: original series name → display series name
 display: display series name → original series name
 system:  Japanese-original category + original name → original series name
          otherwise display series name → original series name
```

A value is considered present only after `trim()`. Japanese-original category matches the Flutter constants:

- `category.name === '日文原版'`
- `category.shortName ∈ {'日文', '日原', '日文原版'}`

The title target resolves as:

```text
series keyword exists → { query: keyword, mode: 'name' }
otherwise title exists → { query: title, mode: 'fuzzy' }
otherwise null
```

The author target is `{ query: trimmed author, mode: 'author' }` when non-empty. A tag target is `{ query: trimmed tag, mode: 'tags' }`.

## Data flow

```text
API response
  → api-client.decodeBookDetail (typed BookDetail)
  → BookDetailScreen / BookInfoSheetScreen
  → book-quick-search pure resolver
  → existing Expo Router search params { query, mode, format }
  → SearchRoute whitelist + BookSearchScreen initial submit
  → useBookSearch / existing API contract
```

Settings flow:

```text
NativePickerRow
  → updateAppSettings({ seriesSearchMode })
  → decodeSettings validation + local storage
  → useSyncExternalStore subscribers
  → BookDetailContent re-render
  → next title tap uses the new resolver mode
```

## Navigation decisions

- Title/author in the detail Hero use `router.push` so the search screen sits above detail and back returns to detail.
- Tag selection happens inside a modal/form-sheet route. Use `router.replace` with the search route so the sheet is removed and the search screen is the new top route; back then returns to the detail screen rather than reopening the tag sheet.
- Search format is derived from `book.type` with the screen's requested `bookType` as fallback, defaulting to `Novel`. This preserves novel/comic parity in the shared RN detail screen while retaining the Flutter mode mapping.
- Route params remain strings, as required by Expo Router; `mode` is one of the existing six `BookSearchMode` literals.

## Android interaction caveat

`CollapsibleBookAppBar` currently sets its overlay to `pointerEvents="none"` because it is a visual copy over the scroll content. That would make the newly interactive title/author unreachable because Android renders a spacer instead of an inline hero. Change the overlay and flexible background to `pointerEvents="box-none"`, set the full-size `BookHeroContent` surface and hero text container to `box-none`, and mark visual gradient/cover layers as non-hit-testable; only the title/author Pressables consume touches while non-target areas continue to pass through to the scroll view. The existing opacity/collapse animation remains unchanged.

## Settings contract

Add to `AppSettings`:

```ts
seriesSearchMode: SeriesSearchMode;
```

- default: `'system'`
- decoder accepts only the three literals and otherwise keeps the default
- content settings row uses the existing `NativePickerRow` and `NativeGroupedList`
- no cloud synchronization or API field is introduced

## Search route and first-frame timing

Quick search uses a root-stack route (`/quick-search`) rather than pushing the Search tab route (`/(tabs)/(search)/search`) from a detail screen. The latter can make Expo Router mount a second NativeTabs tree, then initialize the Android Compose top bar/search controls before the search page appears. The normal Search tab keeps its existing route; both routes share one route adapter and one screen implementation.

The detail screen already has the decoded classification and resolves the target before navigation. The search screen must not wait for that data again. RN previously awaited `addSearchHistory()` (including local storage) before calling `run()`, while the routed screen initially had `idle` state and rendered its empty component. This produced a false empty/no-result frame followed by loading skeletons.

Match Flutter's timing contract:

1. Treat a route query as `initialSearchPending` while the hook has not committed it.
2. Render the same loading/skeleton state during that pending frame.
3. Project the new history item synchronously and persist it fire-and-forget.
4. Start `run()` immediately; only a completed response may produce the no-results state.
5. Merge asynchronously loaded old history with the optimistic initial item instead of replacing it.

The change is presentation/request scheduling only; it does not prefetch search results or add a detail refetch. A network request is still required to obtain the result list.

## Testing strategy

- Add a React-Native-free `book-quick-search.test.mjs` covering all resolver branches, category aliases, trim/empty handling, and mode outputs.
- Add `search-history-utils.test.mjs` covering synchronous newest-first projection, deduplication, blank removal, and the 20-item limit.
- Typecheck catches settings option inference, route params, and platform component props.
- Export iOS and Android bundles to catch route/platform import failures; existing client/search tests remain unchanged because the API/search contract is not changed.
- Manual device acceptance is still required for actual iOS/Android touch routing, native sheet replacement, back-stack behavior, and confirming the first visible frame is loading rather than empty.

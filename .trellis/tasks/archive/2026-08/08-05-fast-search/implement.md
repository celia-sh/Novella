# 执行计划：详情页快速搜索

## Before implementation

- [x] 阅读 Flutter 详情页与内容设置实现。
- [x] 阅读 RN 搜索路由、详情 Hero、标签 sheet、设置存储和 native grouped-list 约定。
- [x] 确认完整范围：标题、作者、标签；小说/漫画按详情类型进入对应搜索。
- [x] 记录纯函数和 Android pointer-events 的边界设计。

## Ordered checklist

1. **Add the pure search-target contract**
   - Create `apps/mobile/src/services/book-quick-search.ts`.
   - Export the series-mode type/guard, option data if useful, Japanese-category resolver, series keyword resolver, and title/author/tag target resolver.
   - Create `apps/mobile/src/services/book-quick-search.test.mjs` with table-driven edge cases.
2. **Extend local settings**
   - Add `SeriesSearchMode` and default/decoder handling to `apps/mobile/src/services/settings.ts`.
   - Add a Content settings `NativePickerRow` for System/Original/Displayed series search.
3. **Wire detail Hero title and author**
   - Add a single navigation callback at `BookDetailContent` that calls the pure resolver and pushes the existing search route.
   - Thread it through both `CollapsibleBookAppBar` and `InlineBookHero` into `BookHeroContent`.
   - Convert only title/author text to accessible pressed targets; keep typography, line limits, layout, and empty behavior.
   - Make the Android visual overlay `box-none` so the targets are reachable without making the whole overlay intercept scrolling.
4. **Wire tag quick search**
   - Make tag rows in `BookInfoSheetScreen` pressable.
   - Resolve/trim the tag, replace the sheet route with search params, and preserve the current novel/comic format.
5. **Keep quick-search navigation off the tab subtree**
   - Add a root-stack `/quick-search` route and share its parameter adapter with the existing Search tab route.
   - Point title, author, and tag quick-search navigation at the root route so Expo Router does not mount a second NativeTabs tree.
   - Preserve `push` for title/author and `replace` for the tag sheet so Back returns to detail without reopening the tag sheet.
6. **Fix initial-search timing and false empty states**
   - Make search history projection synchronous and local-storage persistence fire-and-forget.
   - Merge history loaded after the route query instead of replacing the optimistic query.
   - Treat a non-empty initial route query as loading until the search hook commits it; keep the empty component hidden while loading.
   - Add pure search-history utility coverage for ordering, deduplication, blanks, and limit behavior.
7. **Audit and verify**
   - Search for all `SeriesSearchMode`, quick-search route, and tag rendering references to ensure one source of truth and no stale static path.
   - Run the pure service test, mobile typecheck, workspace typecheck, boundary check, and relevant existing tests.
   - Inspect the diff against the PRD and record manual iOS/Android acceptance steps.

## Validation commands

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test apps/mobile/src/services/book-quick-search.test.mjs
npm run typecheck --workspace @novella/mobile
npm run check:boundaries
npm run typecheck
npm run test:shelf --workspace @novella/mobile
npm run test:client
```

## Risk / rollback points

- **Search timing risk**: local history writes must stay fire-and-forget; if storage fails, the search request still proceeds and only history persistence is lost.
- **Settings decode risk**: keep the new field defaulted and reject unknown values; reverting the field/row restores prior settings behavior without affecting API data.
- **Android touch risk**: `pointerEvents` changes only the visual app-bar overlay; if device smoke testing shows scroll interception, revert the overlay setting and use a dedicated hit target inside the underlying spacer as a follow-up rather than altering collapse geometry.
- **Modal navigation risk**: `router.replace` is isolated to tag selection; reverting that handler restores the existing static sheet behavior and does not affect title/author push navigation.
- **Route compatibility**: use only the already-whitelisted modes and params; no search hook/API changes are required.

## Verification

- [x] `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test apps/mobile/src/services/book-quick-search.test.mjs apps/mobile/src/services/search-history-utils.test.mjs` — 9 passed.
- [x] `npm run check` — boundary check and all workspace TypeScript checks passed.
- [x] `npm run test:client` — client-core (25), api-client (17), reader-engine (17), mobile shelf (12), and community (8) tests passed.
- [x] `cd apps/mobile && npx expo export --platform ios --output-dir $TMPDIR/novella-fast-search-export` — iOS bundle exported successfully.
- [x] `cd apps/mobile && npx expo export --platform android --output-dir $TMPDIR/novella-fast-search-export-android` — Android bundle exported successfully.
- [ ] Device smoke acceptance remains user-owned: iOS/Android title, author, tag touch routing, settings change while detail is mounted, and back-stack behavior.

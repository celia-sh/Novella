# Flutter complete-book system reference

## Scope and migration stance

This is a source-backed interaction contract for the mobile migration. It audits only the requested Flutter book surfaces, the directly imported shelf helpers, `BookService`, and `BookMarkService`. Calls into unaudited services are described only by the call sites; their internal storage/network semantics are not inferred.

**Parity rule:** reproduce the user-visible book, shelf, discovery, search, ranking, history, and detail behavior below, except for the explicit **EXCLUDE** ledger. Do not infer extra comic behavior, drag targets, offline guarantees, or haptics that the audited Flutter code does not implement.

## 1. Shelf information model

### Root shelf

- The root is an ordered mixed list of direct books and folders, obtained with an empty parent path. A second flattened list contains every shelf book in display order and is used only by legacy mark filters. (`shelf_page.dart:315-355`)
- Folder identity is a string; book identity is an integer. A folder card reports its direct child count and previews up to four direct child book covers. Empty preview slots remain visible in the 2×2 preview. (`shelf_page.dart:407-428`; `shelf_grid_item.dart:182-218`)
- Invalid/missing book IDs remain represented as an “invalid book” tile rather than silently disappearing. Initial details are collected from at most the first 12 visible items, including folder-preview IDs. (`shelf_book_detail_merge.dart:29-54`; `shelf_grid_item.dart:51-58,76-98`)
- Visible-item prefetch spans three items behind and nine ahead. Requests are frame-batched, deduplicated, and fetched in groups of 24. (`shelf_page.dart:28-29,433-461`; `shelf_book_detail_queue.dart:29-45,79-128`)

### Nested shelf

- Opening a folder pushes another `ShelfFolderPage` with `folderPath = [...parents, folderId]`; each level therefore owns a stable full path. (`shelf_page.dart:682-700`; `shelf_folder_page.dart:511-528`)
- A nested page reads only items whose parent path equals that full path, refreshes the displayed folder title from current shelf state, and shows a slash-separated breadcrumb when depth is greater than one. (`shelf_folder_page.dart:185-246,722-791`)
- Nested folders can be opened recursively in browse mode. In edit mode, nested folder taps do nothing; only direct books can be selected. (`shelf_folder_page.dart:511-523,535-558`)
- Both root and nested pages listen for shelf changes, but suppress refresh while a sort drag is active. (`shelf_page.dart:99-105,255-259`; `shelf_folder_page.dart:84-105`)

## 2. Shelf commands and state transitions

### Add and remove

- The only audited “add” entry is the detail-page shelf button. It calls `addToShelf(bookId)` and therefore adds to the service’s default/root location; there is no audited add-directly-to-folder UI. (`book_detail_page.dart:1447-1467`)
- Tapping the same detail action while already in shelf calls `removeFromShelf(bookId)`. The 56×56 control becomes a loading indicator while the mutation runs and reports success/failure with a snackbar. (`book_detail_page.dart:1447-1480,2238-2276`)
- Root multi-delete accepts selected books and selected folders. Its confirmation explicitly says contained books are also deleted, and success copy reports impacted book and folder counts. (`shelf_page.dart:806-898`; `shelf_edit_sheets.dart:174-244`)
- Nested multi-delete removes selected books from the shelf globally; it is not merely “remove from this folder.” (`shelf_folder_page.dart:628-696`)

### Create and rename

- Folder creation exists only on the root shelf, only while edit mode is active, and is disabled when selection exists or sort mode is active. (`shelf_page.dart:984-1016,1067-1080`)
- Create/rename are keyboard-aware modal bottom sheets with autofocus, selected initial text for rename, trimmed non-empty validation, Cancel and filled confirm actions, and submit-from-keyboard support. (`shelf_edit_sheets.dart:344-488`)
- Duplicate/invalid names are rejected by the called service and surfaced as “文件夹名称无效或已存在.” Root rename is enabled only when exactly one folder and no books are selected. (`shelf_page.dart:71-73,927-981`)
- Nested pages provide no folder create or rename command. (`shelf_folder_page.dart:892-939`)

### Move

- Root move is book-only. Selecting any folder disables Move; folder trees themselves are never moved by this UI. Destinations enumerate every folder and display ancestor titles as `A / B`. (`shelf_page.dart:780-836`)
- Nested move is also book-only. Destinations include “书架顶层” and all folders except the currently open folder; the chosen destination is represented by its complete parent path. (`shelf_folder_page.dart:599-626`)
- Move selection uses a draggable modal sheet sized 30–60% (initially 60%), with a scrollable destination list. Choosing a row commits immediately; no second confirmation is shown. (`shelf_edit_sheets.dart:251-338`)
- Successful move clears selection and all edit/sort state, shows a floating snackbar, and silently refreshes the current shelf surface. (`shelf_page.dart:902-924`; `shelf_folder_page.dart:699-719`)

## 3. Browse, edit, selection, and sort modes

| Mode | Root behavior | Nested behavior |
|---|---|---|
| Browse | Book opens detail; folder pushes child folder. | Same. |
| Edit, no selection | Root may create a folder or enter sort. | May enter sort. |
| Edit, selection | Book/folder taps toggle independent sets. Confirm opens action sheet. | Book taps toggle; folder taps are inert. |
| Sort | All card taps are inert; Hero/preview disabled; drag overlay shown. | Same. |

Evidence: root routing and selection (`shelf_page.dart:682-766`), nested routing and selection (`shelf_folder_page.dart:511-595`), visual selected/sort overlays (`shelf_grid_item.dart:227-259`).

Additional rules:

- Root title changes among “书架”, “编辑书架”, “已选 N 本”, and “拖拽排序”; folder count is converted to its contained-book impact for the selected count. (`shelf_page.dart:75-83,1050-1101`)
- Nested title changes among folder title, “编辑文件夹”, “已选 N 本”, and “拖拽排序”. (`shelf_folder_page.dart:889-927`)
- Sort cannot start with a selection. Cancel is disabled while sort mode is active; Confirm is enabled only with selection and outside sort. (`shelf_page.dart:745-766,1079-1101`; `shelf_folder_page.dart:567-595,904-927`)
- Selection is pruned after refresh if an item is no longer visible. Root folder selection exists only in the default root view. (`shelf_page.dart:365-381`; `shelf_folder_page.dart:230-246`)
- Book preview behavior is enabled only outside edit mode. Sort mode removes elevation/shadow and covers each card with a dark drag-handle overlay; selection uses a primary-tint check overlay. (`shelf_page.dart:546-567`; `shelf_grid_item.dart:76-98,227-259`)

## 4. Drag, reorder, and drop contract

- Reordering is explicitly gated behind Sort mode and uses `flutter_reorderable_grid_view`’s `ReorderableBuilder`. Drag starts after a 180 ms long press; feedback scale is 1 and no custom drag decoration is supplied. (`shelf_page.dart:5,1244-1285`; `shelf_folder_page.dart:5,808-870`)
- The drag start and end indices are captured. On completion the list is optimistically reordered, then persisted with `reorderItemsInParents`: empty parents at root, current `folderPath` when nested. (`shelf_page.dart:597-641`; `shelf_folder_page.dart:469-507`)
- Reorder scope is sibling-only. Books and folders can change order within the current container because both are in the mixed item list.
- **No drop-into-folder gesture exists. No cross-folder drag exists.** Moving books across containers is sheet-driven, and folders cannot be moved.
- A scroll controller is passed to the reorder package, so package-owned edge scrolling may occur, but the audited app supplies no auto-scroll threshold, speed, or callback. Treat exact auto-scroll behavior as unspecified rather than a parity requirement. (`shelf_page.dart:1250-1258`; `shelf_folder_page.dart:834-842`)
- **No explicit haptic API is called anywhere in the audited files.** Do not add vibration/haptics as claimed Flutter parity.

## 5. Motion, feedback, menus, dialogs, and sheets

### Motion and navigation

- Every book grid source generates a source-specific cover Hero tag and passes the identical tag into detail: root shelf, nested shelf, home modules, recently updated, ranking, search, and history. (`shelf_page.dart:546-567,708-730`; `shelf_folder_page.dart:435-456,535-558`; `home_page.dart:1190-1224`; `recently_updated_page.dart:240-261`; `ranking_page.dart:239-260`; `search_page.dart:738-759`; `history_page.dart:656-681`)
- Shelf Hero is disabled in sort mode. Detail falls back to `cover_<bookId>` only when no source tag is supplied. (`shelf_page.dart:546-565`; `shelf_folder_page.dart:435-454`; `book_detail_page.dart:1753-1757`)
- Continue Reading provides a custom push flight shuttle that preserves the source cover during flight; pop uses the destination child. (`home_page.dart:818-841`)
- Search mode options enter/exit with a 180 ms size + fade animation. (`search_page.dart:483-503`)
- Detail loading shimmer repeats every 1500 ms, and dynamic cover-derived theme transitions use 600 ms ease-in-out cubic unless restored from cache. (`book_detail_page.dart:97-101,1694-1717`)
- Grid titles request their own `animated` behavior for shelf books, but its imported implementation was outside audit scope; no duration/effect should be inferred. (`shelf_grid_item.dart:70`)

### Menus/dialogs/sheets

- Shelf operations are bottom sheets, not context menus: action chooser, non-dismissible delete confirmation, draggable move destination, and keyboard-aware create/rename. (`shelf_edit_sheets.dart:33-167,174-244,251-338,344-488`)
- Search clear-history is the only audited `AlertDialog`, with Cancel/Clear actions. A history chip enters a pending-delete state on long press and requires a subsequent tap to delete; tapping elsewhere cancels pending deletion. (`search_page.dart:215-236,378-398,591-670`)
- Reading-history clear uses a non-dismissible bottom sheet with explicit destructive and cancel rows. (`history_page.dart:398-454`)
- Detail uses bottom sheets for sync warning, legacy local marks, tags, uploader information, and an expandable introduction; introduction is a 40–90% draggable sheet. (`book_detail_page.dart:1364-1439,1498-1587,2563-2648`)
- Detail top-bar sharing is a hidden three-tap gesture: three taps each within 500 ms invoke the platform share sheet; failures show a snackbar. (`book_detail_page.dart:443,1230-1310`)
- No audited shelf/book card context menu, swipe action, or hover menu exists.

## 6. Loading, error, empty, refresh, and offline behavior

### Shelf

- First load shows a centered indicator. Initial visible details may gate display for at most 900 ms; detail errors release the gate instead of trapping the screen. (`shelf_page.dart:152-190,1318-1331`; `shelf_folder_page.dart:108-142,940-944`)
- Pull-to-refresh and toolbar refresh force shelf reload. A silent refresh retains already loaded content; a non-silent root failure shows “加载书架失败,” while folder failure shows “加载文件夹失败.” (`shelf_page.dart:271-313,1208-1216`; `shelf_folder_page.dart:185-270,722-731`)
- Root empty copy is “书架空空如也.” Nested empty copy is “当前文件夹为空.” Both remain pull-refreshable. (`shelf_page.dart:1162-1201`; `shelf_folder_page.dart:729-762`)

### Discovery, search, ranking, history, detail

- Home refreshes enabled ranking/latest/continue-reading modules concurrently. Module failures are logged and end loading; only the rank-type-change path explicitly shows “加载失败.” Empty module copy is “暂无更新” or “暂无数据.” (`home_page.dart:270-294,477-568,578-612,982-1010,1095-1123`)
- Recently Updated uses 24-item frontend pages, repeatedly fetching backend pages until enough post-filter books exist. It supports pull refresh, explicit previous/next buttons, loading, “暂无数据,” and failure snackbar. (`recently_updated_page.dart:34-116,119-226`)
- Ranking caches per tab plus filter settings, displays 24 initially, and reveals 24 more when scrolling within 200 px of the end after a synthetic 100 ms delay. It has daily/weekly/monthly tabs, pull refresh, loading tiles, empty state, and failure snackbar. (`ranking_page.dart:35-43,74-147,151-228`)
- Search displays loading, history-before-first-search, or results. It fetches backend pages until a 24-item post-filter frontend page is filled; failure preserves the surface and shows “搜索失败.” (`search_page.dart:242-329,420-437,681-730`)
- Reading History supports silent force refresh, cached/local cover-title hints while details load, a 900 ms detail gate, explicit error+Retry, pull refresh, and “暂无阅读记录.” Missing book details are pruned. (`history_page.dart:107-190,227-252,258-389,547-651`)
- Detail prefers enabled in-memory cache, refreshes reading progress, then performs silent background revalidation. Without usable cache it shows a source-cover/title preview plus synchronized skeleton; hard failure shows Retry. (`book_detail_page.dart:750-896,950-1136,1640-1689,1792-1991`)

### Offline contract

- None of the audited pages checks connectivity or exposes a dedicated offline banner/state.
- Detail and Continue Reading can render some cached/local metadata and covers, and detail background refresh failure is intentionally ignored when cache exists. (`book_detail_page.dart:750-779,1132-1136`; `home_page.dart:298-368,1276-1321`)
- Shelf/history silent refresh preserves existing data on failure, but a cold request can still fail. Search, ranking, and recently updated require service results and have no audited persisted offline result store.
- Therefore migration parity is **best-effort stale/cached rendering, not offline-complete support**. Never promise offline search, ranking, shelf mutations, or book-detail freshness from this reference.

## 7. Discovery contract

### Home

- Header title is “发现,” with announcement and Search actions. Modules are ordered and enabled by settings: Continue Reading, reading stats, Recently Updated, and Ranking. Pull refresh reloads enabled data. (`home_page.dart:649-734`)
- Continue Reading appears only when both the last book and position exist. It shows local/network cover, title, chapter title (or numeric fallback), opens detail—not reader—and refreshes stats/progress on return. (`home_page.dart:760-866`)
- Recently Updated requests 12 latest books to survive filtering but renders at most six; “更多” pushes the full recently-updated page. (`home_page.dart:525-568,944-1035`)
- Ranking renders at most six, labels the active daily/weekly/monthly period, shows medal colors for top three, and “更多” opens the matching ranking tab. (`home_page.dart:477-523,1039-1141`)
- Content filtering applies ignore-Japanese, ignore-AI, and local level-6 filtering to home, full ranking, recently updated, and search results. (`home_page.dart:490-510,545-557`; `ranking_page.dart:108-116`; `recently_updated_page.dart:82-88`; `search_page.dart:294-300`)

### Service request mapping

- Latest list: `GetBookList` with page/size/order and Japanese/AI flags. (`book_service.dart:57-95`)
- Bulk shelf/history details: `GetBookListByIds`, chunks of 24, positional `null` for missing entries. (`book_service.dart:101-143`)
- Detail: `GetBookInfo(Id)`. Ranking: `GetRank(Days)` where 1/7/31 map to day/week/month. (`book_service.dart:149-201`)
- Search chooses the hub method and request keyword through `BookSearchMode`, then sends page/size/keyword and Japanese/AI flags. (`book_service.dart:206-246`)

## 8. Search contract

- Empty launch waits until the route transition completes before focusing the field. An initial keyword searches after history loads. (`search_page.dart:109-137,152-177`)
- Default is fuzzy. Explicit options are exact, title, author, series name, and tags; quoted fuzzy input is promoted to exact. Selecting an already active option toggles back to fuzzy. (`search_page.dart:43-76,242-267,398-416`)
- Search history is local `SharedPreferences`, newest-first, deduplicated, capped at 20. Clear-all requires the dialog; chip long press changes it to “删除?” and the next tap deletes. (`search_page.dart:179-236,378-398,591-670`)
- Results are paged in groups of 24 with previous/next controls and mode-specific empty text. Page change jumps to top. (`search_page.dart:270-376,418-428,681-730`)
- Book detail quick search routes title/series, author, and selected tags back into Search with the appropriate mode. (`book_detail_page.dart:1312-1362,2115-2149,2579-2601`)

## 9. Ranking and reading-history contract

- Ranking tab order is 日榜/周榜/月榜. Cache identity includes period and all three content-filter flags, preventing filtered datasets from being reused incorrectly. (`ranking_page.dart:35-43,89-116`)
- Rank numbering is global within the currently displayed filtered list. Top-three medal overlays are gold, blue-tinted silver, and bronze. (`ranking_page.dart:214-225,262-292`)
- Reading History gets ordered IDs from the user service, enriches them in visibility-prioritized batches, and opens detail with a History-specific Hero and telemetry source. (`history_page.dart:258-338,656-685`)
- Clear History is all-or-nothing and reports success with “已清空历史记录.” There is no per-book history deletion in the audited page. (`history_page.dart:398-482`)

## 10. Book-detail contract

- Header is a pinned, stretchable 280 px sliver with cover-derived optional gradient, cover Hero/preview, title, and author. Title/series and author are tappable searches. (`book_detail_page.dart:1994-2151`)
- Visible metadata: favorite count, views, chapter count, and legacy mark chip (excluded below). Main actions are shelf toggle and Start/Continue Reading. (`book_detail_page.dart:2190-2328`)
- Introduction shows a four-line HTML preview and opens a draggable full sheet. Ruby is custom-rendered; script/style/images are removed only from preview flattening. (`book_detail_page.dart:2354-2371,2604-2859`)
- Latest-update row uses relative time and the final chapter title. Chapters are a numbered list; current chapter is highlighted and labeled “当前.” Tapping a chapter starts that exact chapter without server override. (`book_detail_page.dart:2374-2540`; `book_detail_page.dart:1139-1174`)
- Continue Reading warns only when the legacy Gist sync manager reports active syncing; otherwise it opens the current chapter (or chapter 1) and allows one server override. (`book_detail_page.dart:1216-1226,1364-1439`)
- Tags open a sheet and launch tag search. Other top-bar actions open comments and uploader information. (`book_detail_page.dart:2153-2183,2563-2601`)
- Shelf mutation success uses a floating snackbar; mutation errors expose the exception text. Marking requires shelf membership in the Flutter implementation, but the entire mark flow is excluded. (`book_detail_page.dart:1447-1510`)

## 11. Explicit EXCLUDE ledger: Gist and local marks

Do **not** migrate these as part of the complete-book mobile contract:

1. `BookMarkStatus.none/toRead/reading/finished`, display names, and icons. (`book_mark_service.dart:7-41`)
2. `SharedPreferences` keys named `book_mark_<bookId>` and all mark read/write/list APIs. (`book_mark_service.dart:48-155`)
3. Immediate `SyncManager.triggerSync()` after a mark change and the optional GitHub Gist transport for those local marks. (`book_mark_service.dart:43-47,58-80`)
4. Root shelf filter tabs “待读 / 在读 / 已读,” their marked-ID queries, mark-filter empty copy, and the instruction to long-press detail. Keep only the default shelf view. (`shelf_page.dart:261-269,580-594,1020-1047,1117-1201`)
5. Detail `_currentMark`, mark metadata chip/icon, long-press shelf-button gesture, mark sheet, and mark snackbars. The shelf button remains tap-to-add/remove only. (`book_detail_page.dart:455,1484-1629,2222-2227,2250-2274`)
6. The Gist-sync-in-progress gate/sheet before Continue Reading. Continue Reading should proceed without this legacy warning. (`book_detail_page.dart:1216-1226,1364-1439`)
7. Home’s special “backfill metadata without triggering Gist sync” compatibility concern; it is tied to the excluded sync system, not a new mobile interaction. (`home_page.dart:416-436`)

This exclusion does **not** remove normal server-backed shelf membership, reading progress/history, search history, local cover caching, or ordinary cached detail rendering.

## 12. Flutter comic limitations

- No audited file contains a comic/manga model, comic detail route, comic reader route, page/image list, reading direction, spread mode, or comic-specific gesture.
- `BookInfo` models a textual book with a flat `List<ChapterInfo>` containing only chapter ID/title, and detail always launches `ReaderPage`. (`book_detail_page.dart:204-246,397-409,1139-1174`)
- `BookService` exposes only book list, bulk book, book detail, rank, and book search calls. (`book_service.dart:8-247`)
- Category/level/badges may visually classify a book, but the audited navigation never dispatches based on type; every cover opens `BookDetailPage`, and every chapter opens `ReaderPage`.
- Consequently, Flutter parity provides **no comic-system contract** beyond showing a comic-like record as a generic book if the backend happens to return one. Native comic detail/reader behavior must be specified from another source and must not be attributed to this Flutter reference.

## 13. Audited dependency/behavior inventory

| Dependency or primitive | Audited role | Migration implication |
|---|---|---|
| `flutter_reorderable_grid_view` | Sort-mode long-press grid reorder | Match sibling reorder and 180 ms activation; do not invent folder drops. |
| `visibility_detector` | Shelf/history visible-window detail prefetch | Preserve demand-driven batching or an equivalent mobile strategy. |
| Riverpod settings | Content filters, module order, badges, color extraction | Settings changes must invalidate the corresponding view/cache. |
| `M3ERefreshIndicator` / `M3ELoadingIndicator` | Pull refresh and loading states | Preserve refreshability of empty states where audited. |
| `SharedPreferences` | Search history and excluded local marks | Keep search history only; omit mark keys/API. |
| `BookCoverHero` / Flutter `Hero` | Cover continuity into detail | Use stable source-specific transition identity; disable during reorder. |
| `flutter_widget_from_html` + `html` | Introduction preview/full rendering, ruby handling | Preserve sanitized HTML/ruby behavior or document any deliberate downgrade. |
| `share_plus` | Hidden triple-tap platform sharing | Preserve only if product wants exact parity; it is source behavior, not a visible affordance. |
| Explicit haptics | None | No Flutter-parity haptic requirement. |
| Explicit offline framework | None | Cached fallback only; no offline-complete guarantee. |

# Web-Master Complete Book System Reference

## Purpose and audit boundary

This is a historical read-only audit of `the Web-Master reference implementation` for planning the complete
React Native book system. The audited checkout was `[REFERENCE_REPOSITORY]` commit
`[COMMIT]` (`master`). The current refreshed
checkout and incremental changes are recorded in
[`web-master-latest-delta.md`](web-master-latest-delta.md). The scope is the
reader-facing novel and comic system; novels and comics are treated as equal
product priorities even where Web-Master itself has asymmetric coverage.
Publishing, editing, image upload, and collaborator/admin work are inventoried
only enough to identify the boundary and are explicitly deferred.

All citations are repository-relative and refer to the audited checkout.
“Observed shape” means the TypeScript declaration is incomplete but the page
reads those fields at runtime. Absence claims are based on a repository-wide
read/`rg` audit of `the Web-Master reference implementation`.

## Executive conclusions for RN planning

1. **The product has separate novel-volume and comic-series discovery models.**
   Novel flat lists can switch to a classifier-backed series grouping; comics
   are already returned as series cards and drill into one or more uploaded
   comic books/volumes. The route split is explicit
   (`BookList`/`BookSeries`/`BookSeriesBooks` versus
   `MangaDiscover`/`MangaDetail`) routes.ts:30-51 (the Web-Master reference implementation)
   routes.ts:72-90 (the Web-Master reference implementation).
2. **Search and history explicitly give both formats enabled tabs, but home,
   ranking, and shelf are not equally complete.** Search offers enabled Novel
   and Comic tabs Search.vue:267-282 (the Web-Master reference implementation),
   and history does likewise History.vue:87-101 (the Web-Master reference implementation).
   Home’s “latest” card calls only `GetLatestBookList`
   Home.vue:185-210 (the Web-Master reference implementation),
   and periodic ranking is novel-card-only BookRank.vue:64-73 (the Web-Master reference implementation).
3. **Shelf mutations are local document edits followed by whole-document
   synchronization, not individual add/remove/move/reorder RPCs.** The only
   shelf RPCs are `GetBookShelf` and `SaveBookShelf`; add, remove, move, folder,
   and reorder operations alter the local shelf tree and eventually save
   `{data, ver}` user/index.ts:91-120 (the Web-Master reference implementation)
   shelf.ts:288-375 (the Web-Master reference implementation)
   shelf.ts:520-525 (the Web-Master reference implementation).
4. **Comics demonstrably share the physical SignalR method
   `GetBookListByIds`, but comic shelf participation is not proven.** Novel
   hydration invokes `GetBookListByIds` with `{Ids}`; comic history invokes the
   same method with `{Ids, Type:'Comic'}` and expects a series-aggregated
   `ComicListResponse` book/index.ts:59-79 (the Web-Master reference implementation).
   Shelf records have no media discriminator and shelf hydration calls only the
   `{Ids}` variant shelf.ts:16-40 (the Web-Master reference implementation)
   bookListData.ts:102-133 (the Web-Master reference implementation).
   See **Shelf/comic evidence** below; RN must not assume comic shelf parity
   without a backend fixture or server confirmation.
5. **Novel and comic progress use one server operation.** Both save
   `SaveReadPosition({Bid,Cid,XPath})`; novels put a DOM XPath in `XPath`, while
   comics put a decimal page string there book/types.ts:112-116 (the Web-Master reference implementation)
   history.ts:42-55 (the Web-Master reference implementation)
   Manga/Reader.vue:527-538 (the Web-Master reference implementation).
6. **Transport behavior is part of the contract.** Hub calls use MessagePack,
   target `/hub/api`, may decode gzip-compressed `Uint8Array` response bodies,
   unwrap `{Success,Response,Status,Msg}`, and physically invoke each method
   with both the business payload and `{UseGzip:true}`
   signalr/index.ts:33-63 (the Web-Master reference implementation)
   signalr/index.ts:163-210 (the Web-Master reference implementation)
   signalr/index.ts:214-223 (the Web-Master reference implementation).

## Route and feature inventory

### Reader-facing routes

| Area | Route name/path | Behavior and RN planning implication | Source |
| --- | --- | --- | --- |
| Home/latest | `Home`, `/home` | Public home. Its book module is novel latest only; comic latest needs an equal-priority RN entry point rather than being hidden as a later add-on. | routes.ts:11-15 (the Web-Master reference implementation), Home.vue:7-27 (the Web-Master reference implementation) |
| Novel discovery | `BookList`, `/book/list/:order/:page?` | Flat, page-numbered volume list. | routes.ts:30-34 (the Web-Master reference implementation) |
| Novel series | `BookSeries`, `/book/series/:order/:page?` | Page-numbered grouped series grid. | routes.ts:36-40 (the Web-Master reference implementation) |
| Series volumes | `BookSeriesBooks`, `/book/series-books/:name/:order/:page?` | Exact series drill-in; page/order changes use history replacement so back returns to the series grid. | routes.ts:42-46 (the Web-Master reference implementation), BookSeriesBooks.vue:76-101 (the Web-Master reference implementation) |
| Novel detail | `BookInfo`, `/book/info/:bid` | Detail, chapter list, resume/start, shelf toggle, book comments. | routes.ts:48-52 (the Web-Master reference implementation), BookInfo.vue:74-132 (the Web-Master reference implementation) |
| Novel rank | `BookRank`, `/book/rank/:type` | Daily/weekly/monthly rank. | routes.ts:66-70 (the Web-Master reference implementation), BookRank.vue:38-70 (the Web-Master reference implementation) |
| Novel reader | `Read`, `/read/:bid/:sortNum` | Chapter-by-sort-number HTML reader. | routes.ts:93-97 (the Web-Master reference implementation) |
| Comic discovery | `MangaDiscover`, `/manga/list/:order/:page?` | Public page-numbered comic-series list. | routes.ts:72-77 (the Web-Master reference implementation) |
| Comic series detail | `MangaDetail`, `/manga/:seriesTitle` | Public series metadata, volumes/uploaders, chapter groups, resume/start, series comments. | routes.ts:79-84 (the Web-Master reference implementation), Manga/Detail.vue:54-98 (the Web-Master reference implementation) |
| Comic reader | `MangaReader`, `/manga/:mangaId/read/:chapterId` | Public immersive reader keyed by uploaded book ID plus chapter ID. | routes.ts:86-90 (the Web-Master reference implementation) |
| Search | `Search`, `/search/result` | Novel/comic tabs; URL state is `keywords`, `mode`, `tab`. | routes.ts:176-181 (the Web-Master reference implementation), Search.vue:115-133 (the Web-Master reference implementation) |
| Shelf | `MyShelf`, `/my-shelf/:folderID*` | Authenticated nested-folder library with draft editing. | routes.ts:158-163 (the Web-Master reference implementation) |
| History | `History`, `/history` | Authenticated novel/comic read history and clear-all. | routes.ts:165-168 (the Web-Master reference implementation) |

`BookCard` is format-aware: when a `BookInList` has `Type === 'Comic'`, it
routes to `MangaDetail` using `SeriesTitle || Title`; otherwise it routes to
`BookInfo` BookCard.vue:59-69 (the Web-Master reference implementation).
RN should preserve this dispatch at a typed shared boundary rather than make a
screen infer media type from an ID.

### Deferred routes and operations

The following are deliberately **not** first-baseline reader functionality:

- `EditBook` and `EditChapter` routes
  routes.ts:54-64 (the Web-Master reference implementation).
- `UserPublish` and `UserBookEditor`
  routes.ts:116-125 (the Web-Master reference implementation).
- Collaborator administration at `/collaborator`
  routes.ts:99-103 (the Web-Master reference implementation).
- Book mutation operations `UpdateBook`, `GetBookEditInfo`, and `DeleteBook`
  book/index.ts:91-104 (the Web-Master reference implementation).
- Novel/comic create/update/delete/reorder chapter operations
  chapter/index.ts:10-40 (the Web-Master reference implementation),
  comic image map `{Title, Images}` and chapter reorder payload
  `{BookId,OldSortNum,NewSortNum}`
  chapter/types.ts:36-60 (the Web-Master reference implementation).
- `QuickCreateNovel`, `QuickCreateComic`, and `UploadImage`
  user/index.ts:137-150 (the Web-Master reference implementation),
  including binary `{FileName, ImageData: Uint8Array}` upload and
  `{Url,MediumUrl}` response user/type.ts:49-81 (the Web-Master reference implementation).

The browser comic editor supports multi-image selection, up to three concurrent
uploads, page deletion, clear, preview, and drag reorder
ComicChapterImages.vue:14-51 (the Web-Master reference implementation)
ComicChapterImages.vue:132-183 (the Web-Master reference implementation).
That is concrete authoring functionality, not evidence that the RN reader must
ship upload/admin UI now.

## Services, operations, and exact wire shapes

### SignalR transport contract

- Origin defaults to `[API_ORIGIN]` (alternate external deployment provider
  origin exists), and the Hub URL is `${origin}/hub/api`
  apiServer.ts:4-12 (the Web-Master reference implementation)
  signalr/index.ts:33-39 (the Web-Master reference implementation).
- Authentication is supplied by `accessTokenFactory`; it uses the session token
  or exchanges the long-term token before connecting
  signalr/index.ts:36-59 (the Web-Master reference implementation).
- Protocol is SignalR MessagePack with automatic reconnect
  signalr/index.ts:60-63 (the Web-Master reference implementation).
- Service wrappers appear to call `requestWithSignalr(method, payload)`, but the
  rate-limited adapter physically invokes
  `hub.invoke(method, payload, {UseGzip:true})`
  signalr/index.ts:168-174 (the Web-Master reference implementation)
  signalr/index.ts:214-223 (the Web-Master reference implementation).
- Successful envelopes are `{Success:true, Response, Status, Msg}`; `Response`
  may be gzip JSON bytes. Failed envelopes become `ServerError(Msg, Status)`
  signalr/index.ts:163-210 (the Web-Master reference implementation).
- Hub and HTTP calls share one conservative queue: 9 requests per 5.5 seconds
  createRequestQueue.ts:3-15 (the Web-Master reference implementation).
- Read operations may be served from IndexedDB when disconnected, keyed by the
  exact method plus argument list. Mutation operations—including shelf,
  progress, comments, history clearing, and deferred authoring—are explicitly
  not cacheable cache.ts:8-42 (the Web-Master reference implementation)
  cache.ts:44-73 (the Web-Master reference implementation).

RN contract tests should therefore distinguish the **business payload** below
from the extra physical Hub options argument.

### Discovery, search, series, and ranking operations

All list responses use `{TotalPages:number, Page:number, Data:T[]}`
services/types.ts:18-23 (the Web-Master reference implementation).

| Hub method | Business request payload | Response used by Web-Master | Source |
| --- | --- | --- | --- |
| `GetLatestBookList` | `GetBookListRequest`: optional `Page`, `Size`, `KeyWords`, `Order:'new'|'view'|'latest'`, `IgnoreJapanese`, `IgnoreAI`; home sends only the two ignore flags. | `ListResult<BookInList>` | book/index.ts:81-84 (the Web-Master reference implementation), book/types.ts:92-99 (the Web-Master reference implementation) |
| `GetBookList` | Same request. Fuzzy sends raw `KeyWords`; exact sends the keyword wrapped in quotes. Discovery sends page, size 24, order, and filters. | `ListResult<BookInList>` | book/index.ts:9-12 (the Web-Master reference implementation), Search.vue:148-179 (the Web-Master reference implementation), BookList.vue:123-135 (the Web-Master reference implementation) |
| `GetBookListByTitle` | `GetBookListRequest` with `KeyWords`. | `ListResult<BookInList>` | book/index.ts:14-17 (the Web-Master reference implementation) |
| `GetBookListByAuthor` | Same. | `ListResult<BookInList>` | book/index.ts:19-22 (the Web-Master reference implementation) |
| `GetBookListByName` | Same; classifier-backed work/series-name search. | `ListResult<BookInList>` | book/index.ts:24-27 (the Web-Master reference implementation) |
| `GetBookListByTags` | Same; comma-separated tags are documented as AND matching. | `ListResult<BookInList>` | book/index.ts:29-32 (the Web-Master reference implementation) |
| `GetSeriesList` | Optional `{Type:number,Page,Size,Order,IgnoreJapanese,IgnoreAI}`. | `ListResult<SeriesInList>` where item is `{Name,Cover,Count,LastUpdatedAt}`. | book/index.ts:34-37 (the Web-Master reference implementation), book/types.ts:23-44 (the Web-Master reference implementation) |
| `GetBooksBySeries` | Above plus required `{SeriesName:string}`. | `ListResult<BookInList>` | book/index.ts:39-42 (the Web-Master reference implementation), book/types.ts:46-48 (the Web-Master reference implementation) |
| `GetRank` | `{Days:number}`; UI maps daily→1, weekly→7, monthly→31. | `BookInList[]` (not a paginated envelope). | book/index.ts:86-89 (the Web-Master reference implementation), BookRank.vue:38-70 (the Web-Master reference implementation) |
| `GetComicList` | Optional `{Page,Size,Order:'latest'|'new'|'view'}`. UI sends page, size 24, order. | `ComicListResponse`. | manga/index.ts:7-9 (the Web-Master reference implementation), manga/types.ts:3-9 (the Web-Master reference implementation), Manga/Discover.vue:122-131 (the Web-Master reference implementation) |
| `SearchComicSeries` | `{KeyWords:string, Mode?:string, Page?, Size?, IgnoreJapanese?, IgnoreAI?}`. UI passes the same six search modes as novels. | `ComicListResponse`, already aggregated as series cards. | manga/index.ts:11-14 (the Web-Master reference implementation), manga/types.ts:11-20 (the Web-Master reference implementation), Search.vue:189-204 (the Web-Master reference implementation) |

`BookInList` is `{Id, Type?, SeriesTitle?, Cover, LastUpdatedAt, UserName,
Title, Level?, InteriorLevel?, Category?{ShortName,Name,Color}}`
book/types.ts:3-19 (the Web-Master reference implementation).
`ComicListItem` is `{Id,Title,OriginalTitle?,Cover,Count,LastUpdatedAt}`;
Web-Master deliberately maps `id` to `Title`, not numeric `Id`, for the
series-title route manga/types.ts:22-31 (the Web-Master reference implementation)
Manga/data.ts:27-35 (the Web-Master reference implementation).

#### Search modes

The authoritative six novel modes are `fuzzy | exact | title | author | name |
tags`. They map respectively to `GetBookList(raw)`, `GetBookList(quoted)`,
`GetBookListByTitle`, `GetBookListByAuthor`, `GetBookListByName`, and
`GetBookListByTags` book/types.ts:101-110 (the Web-Master reference implementation)
Search.vue:137-179 (the Web-Master reference implementation).
Comic search forwards the mode string unchanged to `SearchComicSeries`; the
comic type currently declares `Mode?: string`, so RN should narrow it to the
shared six-mode union only after confirming backend rejection/default behavior
for other strings manga/types.ts:11-20 (the Web-Master reference implementation).
URL state is restored across activation/update and supports legacy `exact`
query compatibility Search.vue:250-287 (the Web-Master reference implementation).

#### Series and order semantics

Novel flat, novel grouped series, series drill-in, and comic discovery all
expose the same labels: latest update (`latest`), listing time (`new`),
and total views (`view`) BookList.vue:75-92 (the Web-Master reference implementation)
BookSeries.vue:81-89 (the Web-Master reference implementation)
Manga/Discover.vue:101-105 (the Web-Master reference implementation).
A comic series may contain multiple uploaded `Books`, each with uploader,
cover, timestamps, optional read position, and its own chapters
manga/types.ts:56-88 (the Web-Master reference implementation).

There is no comic equivalent of `GetRank({Days})` in the audited services.
`GetComicList({Order:'view'})` is an all-time/order view, not evidence of
periodic daily/weekly/monthly ranking. Equal-priority RN planning must either
show format-specific capabilities honestly or obtain a backend comic-ranking
contract; it must not silently populate a “comic rank” using a semantically
different operation.

### Detail operations and DTOs

| Hub method | Request | Response | Source |
| --- | --- | --- | --- |
| `GetBookInfo` | `{Id:number}` | `{Book,ReadPosition}`. `Book` includes title/cover/introduction, `Arthur`, nullable `Author`, category, chapters `{Title,Id}[]`, classification metadata, dates, favorite/views, `CanEdit`, and uploader user. `ReadPosition` is declared `any`. | book/index.ts:44-47 (the Web-Master reference implementation), book/types.ts:50-90 (the Web-Master reference implementation) |
| `GetComicSeriesInfo` | `{SeriesTitle:string, Order:'latest'|'new'|'view'}` | `ComicSeriesInfoResponse`: series metadata plus `Books[]`, each containing uploader, chapters, and optional per-book `ReadPosition`. | manga/index.ts:20-25 (the Web-Master reference implementation), manga/types.ts:56-88 (the Web-Master reference implementation) |
| `GetComicInfo` | `{Id:number}` (uploaded comic book/volume ID, not series-title ID) | `{ReadPosition?, Book{Id,Cover,Title,Author?,Views,Introduction,CreatedAt,LastUpdatedChapter,LastUpdatedAt,Favorite,User,Extra?,Chapters[]}}`. | manga/index.ts:16-18 (the Web-Master reference implementation), manga/types.ts:90-117 (the Web-Master reference implementation) |

Novel detail resolves resume by taking `ReadPosition.ChapterId` and
`ReadPosition.Position`, caching them as `{cid,xPath}`, then converting chapter
ID back to one-based `sortNum` for the route
BookInfo.vue:176-206 (the Web-Master reference implementation).
Comic series detail merges local and remote per-book positions by timestamp,
chooses the most recently read volume/chapter, and falls back to the first
volume/chapter Manga/Detail.vue:166-205 (the Web-Master reference implementation).

Both details expose metadata, tags linking into search, sanitized introduction,
chapter order toggles, and resume/start. Novel comments are keyed by
`CommentType.Book` plus numeric book ID
BookInfo.vue:37-82 (the Web-Master reference implementation)
BookInfo.vue:104-132 (the Web-Master reference implementation).
Comic comments are keyed by `CommentType.Series` plus the series title
Manga/Detail.vue:60-98 (the Web-Master reference implementation).
This distinction must be retained; comments on an uploaded comic volume are not
modeled as `Book` comments in this page.

### Reader content and progress operations

#### Novel

`GetNovelContent` takes:

```ts
{ Bid: number; SortNum: number; Convert?: 't2s' | 's2t' | null }
```

chapter/types.ts:1-5 (the Web-Master reference implementation).
The response is untyped in the service
chapter/index.ts:5-8 (the Web-Master reference implementation),
but the reader observes:

```ts
{
  Chapter: {
    Id: number
    BookId: number
    SortNum: number
    Title: string
    Content: string
    Chapters: string[]
    CanEdit?: boolean
    Font?: string
  }
  ReadPosition?: { ChapterId: number; Position: string }
}
```

Evidence: identity/loading and HTML content use `BookId`, `SortNum`, and
`Content` Book/Read/Read.vue:168-180 (the Web-Master reference implementation);
the fetch reads `Chapter`, title, and server position
Book/Read/Read.vue:182-202 (the Web-Master reference implementation);
catalog/navigation use `Chapters` and `CanEdit`
Book/Read/Read.vue:81-108 (the Web-Master reference implementation);
and dynamic reading font uses `Font`
Book/Read/Read.vue:373-385 (the Web-Master reference implementation).
The exact nullability and any additional chapter fields remain unresolved.

The novel reader sanitizes server HTML, supports catalog/previous/next,
keyboard arrows, tap-to-scroll, image preview, internal/external links, Duokan
footnotes, reader width/font size/justification/background, dark mode, and an
optional server font Book/Read/Read.vue:11-40 (the Web-Master reference implementation)
HtmlReader.vue:35-77 (the Web-Master reference implementation)
HtmlReader.vue:96-104 (the Web-Master reference implementation)
Book/Read/Read.vue:311-385 (the Web-Master reference implementation).
At first/last chapter it reports a notice instead of navigating beyond bounds
Book/Read/Read.vue:253-277 (the Web-Master reference implementation).

#### Comic

`GetComicContent` takes `{Cid:number, Skip:number, Take:number}`. The wrapper
defaults to `Skip=0`, `Take=12`, documents a server clamp to 12, and says only
the first batch returns read position
manga/index.ts:27-30 (the Web-Master reference implementation).
The response is:

```ts
{
  Chapter: {
    Id: number
    BookId: number
    BookName: string
    Title: string
    SortNum: number
    Total: number
    Skip: number
    Images: Array<{
      Url: string
      Placeholder: string
      Width: number
      Height: number
    }>
  }
  ReadPosition?: { ChapterId: number; Position: string } | null
}
```

manga/types.ts:119-143 (the Web-Master reference implementation).

The reader concurrently loads `GetComicInfo(bookId)` and the first 12-page
batch, rejects non-integer IDs, validates `content.Chapter.BookId === bookId`,
preallocates `Total` placeholders, and restores page from first-batch server
position/local state Manga/Reader.vue:384-423 (the Web-Master reference implementation).
Later batches are loaded in 12-page windows with stale-request version guards
Manga/Reader.vue:447-494 (the Web-Master reference implementation).

Reader modes are horizontal and vertical; horizontal supports single/double
page and LTR/RTL, with mobile forcing single page
Manga/Reader.vue:141-187 (the Web-Master reference implementation).
Wide or extremely tall images also force single-page mode
Manga/Reader.vue:331-344 (the Web-Master reference implementation).
The render window keeps current ±2 pages mounted and image preheating extends
another two pages outside it Manga/Reader.vue:345-367 (the Web-Master reference implementation)
Manga/Reader.vue:496-518 (the Web-Master reference implementation).
Navigation includes tap zones, swipe respecting RTL, wheel, keyboard, slider,
chapter catalog, chapter-boundary transitions, and toolbar/panel hiding
Manga/Reader.vue:24-89 (the Web-Master reference implementation)
Manga/Reader.vue:541-602 (the Web-Master reference implementation).

#### Shared progress operation

`SaveReadPosition` takes exactly:

```ts
{ Bid: number; Cid: number; XPath: string }
```

book/types.ts:112-116 (the Web-Master reference implementation).
Novel progress derives a DOM XPath, persists local `{cid,xPath,top}`, and sends
that XPath history.ts:13-35 (the Web-Master reference implementation)
history.ts:42-55 (the Web-Master reference implementation).
An `IntersectionObserver` picks the upper visible text-containing element and
debounces writes by 300 ms history.ts:70-137 (the Web-Master reference implementation).
Comic progress stores local `{chapterId,page,updatedAt}` and debounces the same
RPC by 400 ms, putting `String(page)` in `XPath`
Manga/useMangaLibrary.ts:3-7 (the Web-Master reference implementation)
Manga/Reader.vue:527-538 (the Web-Master reference implementation).

`GetReadPosition({Id})` exists but has no declared response and no reader-page
caller in the audited system book/index.ts:54-57 (the Web-Master reference implementation).
Reader restoration instead arrives embedded in detail/content responses.

### Comment operations

Comment target types are `Book`, `Announcement`, and `Series`
comment/types.ts:1-5 (the Web-Master reference implementation).

| Hub method | Payload / response | Source |
| --- | --- | --- |
| `GetComments` | Request `{Type,Id,SeriesTitle?,Page}`. Response `{Id,SeriesTitle?,Type,Page,TotalPages,Users:Record,Commentaries:Record,Data:{Id,Reply:number[]}[]}`. | comment/index.ts:17-20 (the Web-Master reference implementation), comment/types.ts:18-35 (the Web-Master reference implementation) |
| `PostComment` | `{Type,Id,SeriesTitle?,Content,ReplyId?,ParentId?}`; top-level page sends the first four relevant fields. | comment/index.ts:7-10 (the Web-Master reference implementation), comment/types.ts:7-16 (the Web-Master reference implementation), Comment.vue:255-279 (the Web-Master reference implementation) |
| `ReplyComment` | Same shape, with required-in-practice `ParentId` and optional nested `ReplyId`. | comment/index.ts:12-15 (the Web-Master reference implementation), Comment.vue:283-314 (the Web-Master reference implementation) |
| `DeleteComment` | `{Id:number}`. | comment/index.ts:22-25 (the Web-Master reference implementation) |

The UI is authenticated (`v-if="user"`), lazy-loads when intersecting, renders
nested replies from normalized `Users`/`Commentaries` maps, permits deletion
only when `CanEdit`, and paginates by `TotalPages`
Comment.vue:1-42 (the Web-Master reference implementation)
Comment.vue:43-137 (the Web-Master reference implementation)
Comment.vue:139-157 (the Web-Master reference implementation).
The maps are typed as `any`; exact commentary/user record DTOs must be captured
from fixtures before RN decoder implementation.

### HTTP operations

There are **no active reader-facing book discovery/detail/reader/shelf/history
HTTP calls** in this checkout; those operations all go through SignalR. The
HTTP layer defaults to POST JSON, turns GET payloads into query parameters,
adds `Accept: application/json` and `x-id`, optionally adds bearer auth, and
unwraps the same `{Success,Response,Status,Msg}` envelope
fetch.ts:15-64 (the Web-Master reference implementation)
fetch.ts:75-99 (the Web-Master reference implementation).

The path table defines `/api/user/upload_book`, but no audited caller uses it
path/index.ts:22-45 (the Web-Master reference implementation).
Image upload for deferred comic authoring is SignalR `UploadImage`, not that
HTTP path user/index.ts:147-150 (the Web-Master reference implementation).
Authentication HTTP endpoints exist outside this document’s book-system focus;
they must not be mistaken for book-content transport.

## Shelf/library folders, mutations, and comic evidence

### Data model and persistence

The shelf is a versioned flat array representing a tree:

```ts
type ShelfItem =
  | {
      type: 'BOOK'
      id: number
      index: number
      parents: string[]
      updateAt: string
    }
  | {
      type: 'FOLDER'
      id: string
      title: string
      index: number
      parents: string[]
      updateAt: string
    }
```

The only schema version is `20220211`
shelf.ts:1-40 (the Web-Master reference implementation).
Items are selected by exact `parents` path, and `index` orders siblings
shelf.ts:99-123 (the Web-Master reference implementation).
The store has `main` and `draft` branches so edit mode can cancel or save as one
unit stores/shelf.ts:14-40 (the Web-Master reference implementation)
stores/shelf.ts:188-203 (the Web-Master reference implementation).

- `GetBookShelf` has no business payload and returns
  `{data:(ShelfItem|legacyItem)[], ver?:'20220211'}`
  user/index.ts:113-120 (the Web-Master reference implementation).
- `SaveBookShelf` takes `{data:ShelfItem[], ver:'20220211'}`
  user/index.ts:91-94 (the Web-Master reference implementation).
- Startup loads local IndexedDB first, then remote, migrates legacy schema when
  needed, normalizes indices, and writes back only if normalization changed
  stores/shelf.ts:206-243 (the Web-Master reference implementation)
  stores/shelf.ts:532-561 (the Web-Master reference implementation).

### Add/remove/folders/move/reorder

- **Add:** `addToShelf({id})` creates a root `BOOK` at index 0 and immediately
  saves locally/remotely stores/shelf.ts:288-313 (the Web-Master reference implementation).
- **Remove:** `removeFromShelf({books,push})` deletes selected IDs and compacts
  indices; detail removal pushes immediately, while edit-mode removal waits for
  save stores/shelf.ts:314-329 (the Web-Master reference implementation)
  MyShelf/List.vue:373-385 (the Web-Master reference implementation).
- **Create folder:** name cannot equal the reserved root name or duplicate any
  existing folder name. New folder is inserted at root/index 0
  stores/shelf.ts:413-465 (the Web-Master reference implementation).
- **Rename folder:** edits title by folder ID
  stores/shelf.ts:467-479 (the Web-Master reference implementation).
- **Delete folder:** contained books are moved to root/end; the folder is then
  removed. UI confirms if non-empty and offers deletion of a folder made empty
  by book removal stores/shelf.ts:480-519 (the Web-Master reference implementation)
  MyShelf/List.vue:387-443 (the Web-Master reference implementation).
- **Move:** UI allows one or multiple selected books to move to an existing
  folder, a newly created folder, or root. The store rewrites `parents` and
  inserts moved items at the beginning of the destination
  MyShelf/List.vue:445-487 (the Web-Master reference implementation)
  stores/shelf.ts:390-412 (the Web-Master reference implementation).
- **Reorder/drag:** edit mode uses SortableJS with a drag handle and 400 ms
  animation. It corrects indices for the parent-navigation tile, updates only
  siblings in the current `parents` path, and saves only when the user confirms
  MyShelf/List.vue:566-610 (the Web-Master reference implementation)
  stores/shelf.ts:343-375 (the Web-Master reference implementation).
- **Cancel/save:** leaving the page cancels the draft; Save merges draft to main
  and persists the whole document MyShelf/List.vue:489-503 (the Web-Master reference implementation)
  MyShelf/List.vue:577-580 (the Web-Master reference implementation)
  MyShelf/List.vue:650-658 (the Web-Master reference implementation).

Nested paths are supported by the route/data model, but the folder selector
passes only `[folderID]` rather than an arbitrarily deep parent chain when
moving MyShelf/List.vue:471-484 (the Web-Master reference implementation).
RN should preserve existing server documents without assuming the current UI
can create every representable nesting arrangement.

### Shelf/comic evidence: exact answer

**Do comics share `GetBookListByIds`? Yes, at the Hub method level.**

- Novel/general batch hydration:
  `GetBookListByIds({Ids:number[]}) -> BookInList[]`, maximum 24 IDs
  book/index.ts:59-70 (the Web-Master reference implementation).
- Comic-series history hydration:
  `GetBookListByIds({Ids:number[], Type:'Comic'}) -> ComicListResponse`, also
  maximum 24 IDs book/index.ts:72-79 (the Web-Master reference implementation).
- History receives `{Novel:number[], Comic:number[]}`, pages each list by 24,
  uses the first payload for novels and the second for comics, and de-duplicates
  series cards across comic pages user/index.ts:53-56 (the Web-Master reference implementation)
  History.vue:167-185 (the Web-Master reference implementation).

**Do comics demonstrably share the shelf? Not conclusively in this checkout.**

Evidence supporting possible compatibility:

- `BookInList` has optional `Type:'Novel'|'Comic'` and `SeriesTitle`
  book/types.ts:3-7 (the Web-Master reference implementation).
- The shared `BookCard` routes comic list DTOs to comic detail
  BookCard.vue:64-69 (the Web-Master reference implementation).
- Shelf `BOOK` records are format-neutral numeric IDs
  types/shelf.ts:29-32 (the Web-Master reference implementation).

Evidence against claiming completed comic shelf behavior:

- Shelf hydration always calls `getBookListByIds(ids)`, i.e. `{Ids}` with no
  `Type:'Comic'`, and expects `BookInList[]`
  bookListData.ts:102-133 (the Web-Master reference implementation).
- The only rendered `AddToShelf` integration is novel `BookInfo`; it toggles a
  numeric ID through the format-neutral store
  BookInfo.vue:80-84 (the Web-Master reference implementation)
  AddToShelf.vue:25-60 (the Web-Master reference implementation).
- Comic detail’s action row contains only resume/start reading, not a shelf
  action Manga/Detail.vue:49-56 (the Web-Master reference implementation).
- Comic “following” is a separate browser-local prototype (`localStorage`) with
  seeded demo IDs; it is not `GetBookShelf`/`SaveBookShelf`, and the audited
  detail does not expose its `toggleFollow`
  Manga/useMangaLibrary.ts:9-29 (the Web-Master reference implementation)
  Manga/useMangaLibrary.ts:32-50 (the Web-Master reference implementation).

**Planning decision:** RN’s equal-priority library requirement needs an explicit
backend contract test before implementation. Test (1) saving a comic volume ID
inside `ShelfItem`, (2) reading it back through `GetBookShelf`, (3) hydrating it
through both `{Ids}` and `{Ids,Type:'Comic'}`, (4) whether shelf identity should
be comic volume ID or series title/ID, and (5) mixed novel/comic folders. Until
then, reuse the physical Hub operation but keep distinct typed overloads and do
not present browser-local “following” as synchronized shelf state.

## History and progress

`GetReadHistory()` takes no business payload and returns exactly
`{Novel:number[]; Comic:number[]}`; `ClearReadHistory()` takes no payload
user/index.ts:53-56 (the Web-Master reference implementation)
user/index.ts:122-125 (the Web-Master reference implementation).
The page displays separate enabled format tabs, uses infinite scroll with 24 IDs
per page, and clears both result arrays after server clear
History.vue:87-125 (the Web-Master reference implementation)
History.vue:127-135 (the Web-Master reference implementation).
Comic history is aggregated to series cards and de-duplicated by mapped series
title; therefore one history ID is a comic book/volume ID, not a stable series
card ID History.vue:174-185 (the Web-Master reference implementation)
Manga/data.ts:27-35 (the Web-Master reference implementation).

History membership and current reader position are separate contracts:
`GetReadHistory`/`ClearReadHistory` manage the former;
`SaveReadPosition` plus embedded `ReadPosition` manage the latter. Shelf is a
third independent contract. RN should not derive one from another.

## Stores and client-side state ownership

| Store/module | Owned state and behavior | Migration note | Source |
| --- | --- | --- | --- |
| `stores/shelf.ts` | Versioned shelf document, main/draft branches, selection, folders, ordering, local DB and remote sync. | Business logic belongs in platform-neutral client core; IndexedDB becomes a storage port. | stores/shelf.ts:14-40 (the Web-Master reference implementation), stores/shelf.ts:160-247 (the Web-Master reference implementation) |
| `stores/bookListData.ts` | Lazy batch hydration cache by numeric book ID; pending/querying sets; 24-ID grouping; invalid placeholders. | Needs media-aware typed hydration if comic shelf is supported. Also note `querying` is never visibly cleared in this file, an implementation quirk not to copy blindly. | bookListData.ts:8-24 (the Web-Master reference implementation), bookListData.ts:71-136 (the Web-Master reference implementation) |
| `Manga/useMangaLibrary.ts` | Browser-local following and progress maps plus reader settings in a separate localStorage key. | Treat following/demo seeds as prototype-only. Reader settings are device-local; progress must use shared server protocol plus local cache, not seeded demo data. | Manga/useMangaLibrary.ts:9-30 (the Web-Master reference implementation), Manga/Reader.vue:285-296 (the Web-Master reference implementation) |
| Novel `history.ts` | Local position cache and server save based on DOM XPath/intersection. | RN needs a native locator, but must preserve server field semantics and local/server separation. | history.ts:38-55 (the Web-Master reference implementation), history.ts:70-137 (the Web-Master reference implementation) |
| Search page state | URL-backed keyword/mode/tab, separate novel/comic arrays, infinite-scroll state. | Server state should move to feature hooks/use cases; route state stays serializable. | Search.vue:115-133 (the Web-Master reference implementation), Search.vue:216-248 (the Web-Master reference implementation) |

## Loading, error, empty, and pagination audit

Web-Master is the business-behavior source, but its UI-state handling is
inconsistent. RN acceptance must cover the gaps rather than reproduce them.

| Surface | Loading | Error | Empty | Pagination / stale-request behavior | Evidence and implication |
| --- | --- | --- | --- | --- | --- |
| Home latest | Fixed-height spinner shared with other home calls. | No local catch; `Promise.all` fails as a unit. | No explicit empty latest state. | Fixed latest set; no pagination. | Home.vue:18-27 (the Web-Master reference implementation), Home.vue:201-214 (the Web-Master reference implementation). RN should isolate novel/comic modules and expose retry/empty independently. |
| Novel list/series/rank | Controls disabled and global loading bar. | Route request rejection is swallowed with `NOOP`; no inline error/retry. | Empty grid with no message. | Page-number pagination for flat/series/drill-in; rank unpaginated. | BookList.vue:3-49 (the Web-Master reference implementation), BookList.vue:138-151 (the Web-Master reference implementation), BookSeries.vue:42-56 (the Web-Master reference implementation), BookRank.vue:68-88 (the Web-Master reference implementation). |
| Comic discovery | Loading bar, sort disabled. | Captures message in `loadError`. | Shared empty/error region says error or “暂无漫画”. | Page-number pagination shown only when there are cards; resets to page 1 on order change. | Manga/Discover.vue:51-73 (the Web-Master reference implementation), Manga/Discover.vue:113-131 (the Web-Master reference implementation). RN should separate error from valid empty and offer retry. |
| Search | Infinite-scroll spinner; `loading` guards empty message. | No catch in either request path; `finally` only clears loading. | Explicit format-specific empty messages. | Size 24, append pages, stop at `TotalPages===index` or zero; switching query/tab clears both arrays and resets/polls. No request generation guard is visible. | Search.vue:25-75 (the Web-Master reference implementation), Search.vue:148-207 (the Web-Master reference implementation), Search.vue:232-248 (the Web-Master reference implementation). RN must reject stale responses after rapid mode/tab/query changes. |
| Novel detail | Cover/body skeletons while DTO ID is not active. | Toast only. Because failed request leaves inactive DTO, skeleton can remain indefinitely. | Chapter list may be empty but has no explicit state; start route falls back to sort 1. | No pagination; all chapter summaries in detail DTO. | BookInfo.vue:26-29 (the Web-Master reference implementation), BookInfo.vue:86-100 (the Web-Master reference implementation), BookInfo.vue:180-211 (the Web-Master reference implementation). RN requires full-screen error/retry and no-chapters state. |
| Comic detail | Skeleton card until active. | Explicit inline error text. | A series with no book/chapter produces an undefined reader route, but the button has no explicit disabled/empty copy. | Entire series/volumes/chapters returned at once. `useTimeoutFn` cancels only scheduled calls, not an already-started transport request. | Manga/Detail.vue:99-127 (the Web-Master reference implementation), Manga/Detail.vue:193-220 (the Web-Master reference implementation), useTimeoutFn.ts:87-130 (the Web-Master reference implementation). |
| Novel reader | Skeleton based on chapter identity. | Toast only; stale/failed chapter can leave skeleton. | No explicit missing/empty-content state. | Route watch reloads chapter; no request version/abort guard. Prev/next replace route and report bounds. | Book/Read/Read.vue:2-11 (the Web-Master reference implementation), Book/Read/Read.vue:179-209 (the Web-Master reference implementation), Book/Read/Read.vue:302-309 (the Web-Master reference implementation). RN must guard stale content and have retry/unavailable/empty-content states. |
| Comic reader | Full-page spinner. | Inline message. | “漫画分卷不存在” when not loading and no explicit error. | First and later batches use `requestVersion`; 12-page batching, placeholders, windowed loading. Later batch failure has no per-page error UI and the rejected promise can be retried only by another trigger. | Manga/Reader.vue:245-248 (the Web-Master reference implementation), Manga/Reader.vue:384-435 (the Web-Master reference implementation), Manga/Reader.vue:463-478 (the Web-Master reference implementation). RN needs page-level retry/failure and batch cancellation/generation checks. |
| Comments | Lazy spinner while response identity/page is inactive; posting button loader. | Post/reply show toast; initial get and delete are not locally caught. | Explicit “暂无评论”. | Server `TotalPages`; changing page refetches. | Comment.vue:24-42 (the Web-Master reference implementation), Comment.vue:139-157 (the Web-Master reference implementation), Comment.vue:233-253 (the Web-Master reference implementation). RN needs fetch/delete error and retry states. |
| Shelf | Initialization suppresses premature empty; label switches between “读取中...” and “空空如也”. Connected-state requirement disables add button. | Mutation errors toast at detail; startup chain has no visible local catch in store. | Explicit initialized empty. | No server pagination; lazy card hydration batches up to 24 and folder covers query at most four books. | MyShelf/List.vue:130-138 (the Web-Master reference implementation), AddToShelf.vue:33-64 (the Web-Master reference implementation), ShelfFolder.vue:34-54 (the Web-Master reference implementation). RN needs offline/read-only and sync-conflict behavior, not a permanent connection gate. |
| History | Infinite-scroll spinner. | `GetReadHistory`, page loads, and clear errors are swallowed with `noop`. | No explicit empty copy. | Client pages ID arrays in chunks of 24; switching tabs resets arrays/scroll. | History.vue:1-62 (the Web-Master reference implementation), History.vue:127-149 (the Web-Master reference implementation), History.vue:151-190 (the Web-Master reference implementation). RN needs empty/error/retry and clear failure feedback. |

The shared delayed-request helper waits 200 ms, cancels scheduled work on
deactivation/unmount, and guarantees that only the latest promise controls its
loading flag, but it does not abort a transport operation once started
useTimeoutFn.ts:37-55 (the Web-Master reference implementation)
useFnLoading.ts:10-47 (the Web-Master reference implementation).
RN should use transport cancellation/request generations where state can change
while a request is in flight.

## Equal-priority RN capability matrix

| Capability | Novel Web-Master contract | Comic Web-Master contract | RN planning requirement |
| --- | --- | --- | --- |
| Latest/discovery | Home latest plus flat/series discovery. | Dedicated comic discovery ordered by latest/new/view. | Give both formats top-level discovery placement; do not interpret novel-only home as product priority. |
| Search | Six modes, volume cards. | Same forwarded modes, series cards. | Shared search controls and filters, format-specific typed results. |
| Series | Grouped novel series then volumes. | Series is primary list entity and contains uploaded books/volumes. | Normalize navigation concepts without flattening away uploader/book IDs needed by comic reader/progress. |
| Ranking | Daily/weekly/monthly `GetRank`. | No periodic rank contract; only view ordering. | Surface capability gap or add backend contract before a comic ranking UI. |
| Detail | Book/volume metadata, chapters, shelf, Book comments. | Series metadata, volumes/uploaders, grouped chapters, Series comments. | Equal quality but distinct detail DTOs and comment targets. |
| Reader | HTML chapter, settings, footnotes, local+server XPath. | Batched image pages, vertical/horizontal, LTR/RTL, single/double, local+server page string. | Shared chrome/progress orchestration; specialized native renderers and locators. |
| Shelf/library | Fully implemented for numeric `BOOK` IDs. | Physical batch method can return comics, but add/hydrate/sync UX is unproven. | Backend fixture first; then mixed-format folders/add/remove/move/reorder parity. |
| History | Novel ID list hydrated as volumes. | Comic ID list hydrated and aggregated as series. | Equal tabs, format-specific hydration, explicit empty/error/clear behavior. |

## Unresolved ambiguities and required validation

1. **Comic shelf identity and server support (highest priority).** Is a shelf
   comic item a numeric uploaded book ID, series ID, or some other ID? Does
   `GetBookListByIds({Ids})` include comic DTOs in mixed input, or is
   `Type:'Comic'` mandatory? Can `SaveBookShelf` safely persist comic items?
   Current source proves only shared method naming, not the full shelf round
   trip.
2. **`GetBookListByIds` overload semantics.** The same Hub operation returns
   raw `BookInList[]` for `{Ids}` but paginated/series-aggregated
   `ComicListResponse` for `{Ids,Type:'Comic'}`
   book/index.ts:59-79 (the Web-Master reference implementation).
   Capture MessagePack fixtures for both and mixed/empty/invalid ID cases.
3. **Novel content DTO is undeclared.** The observed `GetNovelContent` response
   fields need a real decoder contract, including nullability, `Font`, chapter
   catalog shape, HTML empty-string semantics, and whether `ReadPosition` is
   omitted, null, or malformed.
4. **Read-position polymorphism.** `SaveReadPosition.XPath` means DOM XPath for
   novels and decimal page string for comics. Confirm server validation,
   one-based page convention, first-page value, and whether future locator
   formats need a media discriminator/version.
5. **Comic `ReadPosition` authority.** `GetComicSeriesInfo` includes optional
   `ReadAt`, `GetComicInfo` omits it, and first-batch `GetComicContent` also
   returns position manga/types.ts:50-54 (the Web-Master reference implementation)
   manga/types.ts:90-94 (the Web-Master reference implementation)
   manga/types.ts:139-142 (the Web-Master reference implementation).
   Define precedence and stale-echo behavior with fixtures.
6. **History ordering and clear granularity.** The response is ID arrays only;
   source does not declare ordering semantics, timestamps, pagination cursor,
   or format-specific clear. `ClearReadHistory` appears all-or-nothing.
7. **Comic search `Mode` typing.** Service type says arbitrary string while UI
   forwards the six novel modes. Confirm defaults and invalid-mode errors before
   narrowing the API decoder.
8. **Comic ranking.** No daily/weekly/monthly comic method exists. Product must
   decide whether equal priority means a visibly unavailable capability or a
   new backend operation; `Order:'view'` is not equivalent evidence.
9. **Home latest comic endpoint.** `GetLatestBookList` is typed as
   `BookInList`, while comic discovery has `GetComicList`. Confirm whether
   `GetLatestBookList({Type:'Comic'})` is supported (the request type currently
   has no `Type`) or use `GetComicList({Order:'latest'})` for the comic module.
10. **Comments DTO.** `Users` and `Commentaries` are `any` maps. Capture exact
    user/commentary fields, missing-map behavior, page size, reply depth,
    posting response, and auth failure shapes.
11. **Shelf conflict semantics.** `SaveBookShelf` replaces the whole document,
    with no visible revision/ETag/merge token. Test concurrent devices, stale
    writes, remote deletion, offline edits, and migration failure before RN
    offers optimistic folder/reorder changes.
12. **Shelf nesting.** Data supports a full parent path but move UI writes only
    zero or one parent ID. Preserve old deeper documents and decide whether RN
    exposes only one folder level or true nesting.
13. **Pagination boundaries.** Search stops only when `TotalPages === index` or
    zero, not when index exceeds total; history computes pages from local ID
    counts. Test zero, exact final page, server page clamping, duplicates, and
    deleted IDs.
14. **Date representation.** `BookInList.LastUpdatedAt` is declared `Date` but a
    comment says MessagePack/binary decoding can leave an ISO string
    book/types.ts:7-10 (the Web-Master reference implementation).
    RN decoders must normalize this at the API boundary.
15. **Comic local prototype data.** `useMangaLibrary` contains seeded demo IDs.
    None of that state should migrate as user data; only validated reader
    settings/progress behavior should inform RN.
16. **`GetReadPosition` response.** The operation exists but is untyped and
    unused by these pages. Do not invent its response shape.
17. **HTTP upload path.** `/api/user/upload_book` exists without a caller.
    Authoring is deferred, so do not build it into the reader-facing API client
    until a current flow and payload are proven.
18. **Public/auth behavior.** Comic discovery/detail/reader explicitly mark
    themselves public; the novel routes do not set the same explicit metadata
    in this route file. Confirm actual router guard defaults and anonymous
    behavior rather than inferring parity solely from missing metadata.

## Planning checklist derived from the audit

- Define separate decoded DTO families for novel volume lists/details/content,
  novel series, comic series/details/content, comments, shelf documents, and
  history.
- Expose exact typed Hub operations with business payload plus transport-owned
  gzip options; keep HTTP and Hub transport details out of screens.
- Build one shared search-mode model but two result projections.
- Model comic `seriesTitle`, uploaded `bookId`, and `chapterId` separately.
- Implement novel and comic detail/read/history concurrently in the product
  plan; do not make comics a post-novel phase.
- Gate synchronized comic shelf UI on the shelf round-trip fixture. Once proven,
  require mixed-format folders and all add/remove/move/reorder/drag flows.
- Keep shelf, history membership, reader position, and local reader settings as
  four separate state domains.
- Add explicit loading, retryable error, valid empty, offline/cache, auth-expired,
  pagination-end, and stale-request states for every surface in the audit table.
- Preserve the whole-document shelf save behavior unless the backend adds
  granular operations/revisions; do not fabricate `AddToShelf` or `MoveBook`
  server RPC names.
- Keep every authoring/admin operation above deferred from the first RN mobile
  baseline.

# 移动端公告中心设计

## 1. Architecture

```text
Community Home “查看更多”
        ↓
/announcements
        ↓
useAnnouncements
  ├─ AppAnnouncementService (public HTTPS manifest + Markdown)
  └─ AnnouncementsUseCase (SignalR list/detail)
        ↓ merge + date sort
Announcement list (HeroUI cards/skeletons)
        ↓
/announcement/:source/:id
  ├─ app: Markdown → HTML → BookHtmlContent (no comments)
  └─ server: GetAnnouncementDetail → BookHtmlContent
                                  + useComments({ type: 'Announcement', id })
                                  + shared CommentThread rows/composer
```

The mobile application owns source aggregation. Shared packages own the authenticated SignalR contract; the public app-manifest HTTP adapter stays under `apps/mobile` because its URL and Markdown presentation are application-specific.

## 2. Domain Contracts

### API Client

Add `AnnouncementDetail`:

```ts
interface AnnouncementDetail extends AnnouncementItem {
  contentHtml: string;
}
```

`AnnouncementItem` also retains list `contentHtml` when supplied so the list can derive a preview without another request. Add:

```ts
getAnnouncementDetail(id: number): Promise<AnnouncementDetail>;
```

The invocation is exactly `GetAnnouncementDetail` with `{ Id: id }`.

### Client Core

Create `AnnouncementsUseCase` instead of overloading Community:

```ts
interface AnnouncementsUseCase {
  loadPage(page: number, size?: number): Promise<AnnouncementPage>;
  loadDetail(id: number): Promise<AnnouncementDetail>;
}
```

It validates positive ids/pages/sizes and delegates to `ApiClient`. Existing `DiscoveryUseCase.loadAnnouncements()` remains for the discovery home snapshot.

### App Announcements

`apps/mobile/src/services/app-announcements.ts` owns:

```ts
interface AppAnnouncement {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  contentUrl: string;
}

loadAppAnnouncements(signal?): Promise<AppAnnouncement[]>;
loadAppAnnouncementMarkdown(id, signal?): Promise<{ announcement; markdown }>;
```

Only `id/title/path/publishedAt/summary` are retained. Manifest `required`, countdown and completion fields are intentionally ignored. URLs must resolve to HTTPS; relative paths resolve from the manifest origin root, matching the archived behavior. Fetch checks `response.ok`; detail strips one leading YAML front-matter block.

### Combined List Item

Use a discriminated union:

```ts
type AnnouncementListEntry =
  | { source: 'app'; id: string; title; summary; publishedAt }
  | { source: 'server'; id: string; serverId: number; title; summary; publishedAt };
```

The service/hook sorts by parsed timestamp descending. Server preview uses `htmlparser2` text extraction and a bounded 80-character preview.

## 3. Loading And Partial Failure

`useAnnouncements()` has separate source errors and one visible merged list:

- initial load requests app manifest and server page 1 concurrently;
- if one fails, publish the successful source and show a compact source warning;
- if both fail and no items exist, show the full retry state;
- refresh reloads both sources and replaces server pagination;
- load-more only advances the server page and merges by stable `source:id` key;
- all requests use `AbortController`; stale/unmounted generations cannot publish.

No speculative cache or offline persistence is added. Discovery home already has its own five-item server announcement state; the center owns its request lifecycle.

## 4. Navigation

Add root routes:

- `/announcements` → combined center;
- `/announcement/[source]/[id]` → source-specific detail;
- `/announcement/comment-compose` → form-sheet composer with typed query params.

The Community card is no longer a `TouchableRipple` that opens `AnnouncementLink`. It becomes a static card with a dedicated “查看更多 + IconChevronRight” press target. `announcementLink` may remain decoded for protocol compatibility but is no longer used by mobile presentation.

The list passes `initialTitle` to detail for immediate navigation title. Detail validates `source` and id before requesting.

## 5. Rendering

### List

- `NativeScreenScaffold` + `FlatList`, retaining direct native scroll ownership.
- HeroUI Native `Card` for rows and `Skeleton` for first load/pagination.
- Tabler `IconDeviceMobile` for app source, `IconWorld` for site source, `IconChevronRight` trailing.
- Title, two-line summary, formatted date and localized source label.

### Detail

- App Markdown is converted with `marked` (pure parser) to HTML, then rendered by `BookHtmlContent`.
- Server `contentHtml` is rendered directly by `BookHtmlContent`.
- Content width comes from `useWindowDimensions()` minus bounded horizontal padding.
- Detail skeleton is a HeroUI card/text skeleton composition.

No reference-project names or copied source enter production files.

## 6. Shared Comments

Generalize existing hooks from `bookId` to:

```ts
interface CommentTarget {
  type: 'Book' | 'Announcement';
  id: number;
}
```

- `useComments(target)` sends the selected target for load/post/reply/delete.
- `useCommentSubmission(target, replyTarget)` does the same.
- Cross-screen comment-change events become keyed by `type:id` so a book composer cannot trigger an announcement refresh.
- Extract the current comment/reply item renderer and HeroUI comment skeleton into reusable components. Book Comments and Announcement Detail both consume them.
- Extract the existing comment compose sheet UI into a target-neutral component. Existing book and new announcement routes provide target and palette adapters.

Only server announcement detail mounts comments and compose/reply/delete actions. App detail never constructs the comment hook or routes to composer.

## 7. Localization

Add announcement UI keys to the Community namespace in both `zh-CN` and Taiwan `zh-TW`:

- center/detail titles;
- 查看更多, source labels;
- loading/empty/partial/full errors and retry;
- comment section and accessibility labels.

Manifest/server announcement fields and comments are displayed unchanged.

## 8. Compatibility And Rollback

- No server migration.
- No native dependency or prebuild required; `marked` is JS-only.
- Existing discovery announcement section remains intact.
- Existing Community payload decoding retains `announcementLink` for compatibility even though the card no longer opens it.
- Rollback removes the three routes, app-announcement service, announcement use case and generic comment adapters; the Community card can remain static or restore its old link independently.

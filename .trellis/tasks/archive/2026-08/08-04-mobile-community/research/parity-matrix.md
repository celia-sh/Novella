# Community source-derived parity matrix

## Reference boundaries

- Flutter mobile reference: `the archived Flutter implementation`, `the archived Flutter implementation`, `the archived Flutter implementation`.
- Web reference: `the Web-Master reference implementation`, `the Web-Master reference implementation`, `the Web-Master reference implementation`.
- Current React Native target: `apps/mobile/src/app/(tabs)/(community)/**`, `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/src/theme/stack-preset.ts`.

## Capability matrix

| Capability | Flutter evidence | Web evidence | Planned React Native behavior |
|---|---|---|---|
| Community tab | `features/main_page.dart:21-316` defines the Community tab, refresh-on-reselect, request scope, and unread badge. | Global side/header navigation points to Forum and notifications (`components/app/Side.vue:124-125`, `components/app/Header.vue:42-44,260-283`). | Keep `NativeTabs`; add unread badge through `NativeTabs.Trigger.Badge`. Root Community stays a nested native stack. |
| Native navigation | Flutter Community home owns an in-content title/actions while detail, compose, and notifications use pushed pages with `AppBar` (`community_page.dart:392-417`; `community_thread_page.dart:703-729`; `community_compose_page.dart:789-824`; `community_notification_page.dart:209-213`). | Web uses application chrome, breadcrumbs, dialogs, and routes. | Move page titles/actions into the same native navbar conventions as the current RN app. HeroUI never replaces stack headers. Home uses iOS native large title / Android native top app bar; child screens use native stack back/title/actions. |
| Home summary | `community_page.dart:420-523` renders title/subtitle, today threads, online count, and selected-board heat. | `Forum/List/index.vue:15-42` renders hero title/subtitle and stats. | HeroUI `Card`/`Surface` summary below the navbar; compact, single-column mobile layout. |
| Announcement | `community_page.dart:525-596` renders an announcement card. | `Forum/List/index.vue:44-52` renders announcement text and link. | HeroUI alert/card. Only open a validated HTTPS link; absence of a supported target must not break the page. |
| Board navigation | `community_page.dart:598-662` uses horizontally scrollable board chips/cards. | `CommunityBoardRail.vue:1-47` uses a persistent board rail with counts, description, icon, and heat. | Horizontal HeroUI chips/cards. Preserve title, description, icon, today count, selected state, and board accent. No side rail on phones. |
| Feed filtering | Flutter exposes latest/hot/featured plus all/today/week and optional subcategories (`community_page.dart:664-739`). | Web exposes reply/latest/hot/featured plus all/today/week and subcategories (`CommunityFeedList.vue:1-62,169-179`). | Default to `reply` per product decision; expose all four order values, all three time scopes, and board-dependent subcategories. Use HeroUI Tabs/Chip/ScrollShadow; filter changes reset pagination. |
| Feed list | Flutter auto-preloads within two remaining items, supports pull-to-refresh, full/inline error, empty, and end states (`community_page.dart:157-358,768-899,966-1056`). | Web uses skeletons, full/inline errors, empty state, and explicit load more (`CommunityFeedList.vue:66-116`). | Virtualized `FlatList` with pull-to-refresh, Flutter-style near-end pagination, HeroUI skeletons/cards/buttons, inline retry, empty state, and stable existing items during load-more failures. |
| Thread card | Flutter card contains board/category flags, title/excerpt, avatar/deleted-author marker, time, reply/view/like counts, tags (`community_page.dart:1342-1517`). | Same information in `CommunityThreadCard.vue:1-64`. | Shared HeroUI-based `CommunityThreadCard` used by Home and My Community. Keep pinned/featured/locked states and accessibility labels. |
| Hot discussions / active users | Flutter appends compact secondary modules after the feed (`community_page.dart:902-963`). | Web uses the right rail (`CommunityRightRail.vue:1-76`). | Append two HeroUI sections after the main feed; hot threads navigate to details, active users remain informational until a user-profile route exists. |
| Thread detail | `community_thread_page.dart:703-821,862-1080` renders main post, metrics, like/favorite actions, HTML body, replies, related threads, and locked state. | `Forum/Thread.vue:11-369` provides equivalent main post, replies, composer, related/recent threads. | Native stack route `thread/[id]`; HeroUI cards/chips/buttons plus an app-owned safe HTML renderer. Header title becomes board name after load. Related-thread navigation replaces the current detail route to avoid unbounded stacks. |
| Reply pagination | Flutter loads top-level pages of 5 and child pages of 3 (`community_service.dart:79-123,257-280`; `community_thread_page.dart:120-377,579-616,756-797`). | Web mirrors top-level and child pagination (`Forum/Thread.vue:615-699,759-916`). | Preserve page sizes and separate pagination state. Use a HeroUI reply sheet, server reconciliation after posting, and per-reply mutation locks. |
| Notification reply focus | Flutter accepts `replyId` and `parentReplyId`, loads missing pages/children, scrolls, and highlights for 1.2s (`community_thread_page.dart:19-36,196-383`). | Web uses route query params and focus/scroll logic (`Forum/Thread.vue:457-476,650-756`). | Preserve both query params. Route must progressively load the target, scroll into view, and highlight without tracking another thread view. |
| Like / favorite | Flutter supports thread like/favorite and reply like (`community_service.dart:182-255`; `community_thread_page.dart:386-483,547-577`). | Web supports the same (`Forum/Thread.vue:802-850`). | Keep server-returned counts as truth, prevent duplicate taps, and preserve content during mutation errors. |
| Compose | Flutter pushes a dedicated page with native AppBar Publish action, board/subcategory pickers, 6-character title, 20-character body, and Quill HTML (`community_compose_page.dart:12-259,471-847`). | Web opens a full-screen dialog on small screens with an HTML editor and the same validation (`CommunityComposer.vue:1-255`). | Native stack `compose` route. HeroUI title/select/surface/error controls with `react-native-enriched-html` as the gated native editor exception. Publish remains a native navbar action. |
| Posting notice | Flutter requires a one-time persisted usage notice before compose (`community_post_notice_sheet.dart:6-70,73-236`). | No equivalent dedicated gate in the inspected Web composer. | Preserve Flutter behavior with a HeroUI BottomSheet and local key `community_post_notice_accepted_v1`. |
| Client moderation | Flutter fetches a manifest/rules file, validates schema/revision/size/SHA-256/cache, normalizes speech, fails closed when rules are unavailable, and permanently disables community speech after a match (`moderation/community_moderation_rules.dart:1-371`; `moderation/community_speech_guard.dart:1-390`; `data/services/community_service.dart:125-180,306-328`). | Current site publishes the assets under `apps/site/public/assets/community-moderation/**`; the Web composer does not run this client guard. | Port as a tested cross-layer contract. Apply before thread/reply mutations. UI disables compose/reply and returns to Community root when speech is disabled. |
| Notifications | Flutter uses a dedicated pushed notification page with page size 20, read-on-open, refresh, load more, and deep links (`community_notification_page.dart:18-330`; `data/services/notification_service.dart:6-60`). | Web additionally supports mark-all-read and Series targets (`Notification/Index.vue:1-268`). | Native stack `notifications` route, HeroUI cards/skeletons, read-on-open, mark-all-read navbar action, page size 20, CommunityThread focus links, Book links, and safe fallback for target routes not yet present. Refresh profile to update unread badge. |
| My Community | Flutter has models/service only (`data/models/community.dart:647-712`; `data/services/community_service.dart:282-304`). | Full page with Published Threads, Participated Replies, and Favorites tabs (`Forum/Mine.vue:1-139`). | Include in phase 1 as `mine`; HeroUI Tabs and shared thread cards/reply rows, native navbar title/back. |
| Authentication | Current Web routes require auth (`router/routes.ts:169-201`). Current RN places all tabs inside `Stack.Protected` (`apps/mobile/src/app/_layout.tsx:84-267`). | — | No duplicate Community-only login state. If the global session expires, existing protected-route behavior owns the redirect. Mutations still surface sanitized auth errors. |
| Theme / responsive | Flutter uses adaptive Material surfaces and compact/large panes; Web has responsive rails and dark variables. | See `community_page.dart` and Forum scoped styles. | Single-column phone-first layout, light/dark/OLED colors from `useAppTheme`, compact and large phone widths, dynamic type, and reduced-motion-friendly state changes. |

## Data and method contract

### SignalR methods

Derived from `the archived Flutter implementation:29-304`, `the archived Flutter implementation:10-58`, and `the Web-Master reference implementation:16-101`:

- `GetCommunityHome`
- `GetCommunityFeed`
- `GetCommunityThread`
- `CreateCommunityThread`
- `CreateCommunityReply`
- `ToggleCommunityThreadLike`
- `ToggleCommunityThreadFavorite`
- `ToggleCommunityReplyLike`
- `GetCommunityReplyChildren`
- `GetMyCommunityOverview`
- `GetNotifications`
- `MarkNotifications`

All requests use the existing SignalR gzip envelope. Read methods must support cancellation; mutations are interactive priority.

### Core query defaults

- Board: `all`
- Subcategory: empty string
- Order: `reply` (explicit product decision; Web parity)
- Scope: `all`
- Feed page size: 6
- Thread top-level reply page size: 5
- Child reply page size: 3
- Notification page size: 20

## Deliberate mobile adaptations

1. Web left/right rails become horizontal/stacked mobile sections.
2. Flutter's in-content Community title/actions move into the native navbar.
3. Web's inline/fullscreen-small composer becomes a native pushed route, not a HeroUI dialog that replaces navigation.
4. Reply input and the one-time posting notice remain HeroUI bottom sheets because they are transient tasks, not navigation destinations.
5. `react-native-enriched-html` is a deliberate native-control exception inside an otherwise HeroUI-composed screen.
6. Unsupported notification destinations remain readable and markable without crashing; adding unrelated Announcement/Series detail routes is not silently folded into this task.

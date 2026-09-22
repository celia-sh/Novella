# Mobile Community technical design

## 1. Summary

Build the first complete React Native Community experience from the Flutter mobile and Web-Master references:

- Community Home
- thread detail and nested replies
- rich-text thread creation
- notification center
- My Community

The content layer uses HeroUI Native wherever it provides an appropriate primitive. Navigation chrome remains owned by Expo Router/native platform navigation, matching the rest of `apps/mobile`.

The source parity matrix is in `research/parity-matrix.md`. The rich-text dependency assessment is in `research/community-editor-evaluation.md`.

## 2. Design principles

1. **Native navigation owns hierarchy** — HeroUI does not render custom page headers, back buttons, or fake navbars.
2. **Reference behavior before visual imitation** — preserve data contracts, pagination, moderation, deep links, and states before decorative parity.
3. **HeroUI for Community surfaces** — cards, chips, tabs, buttons, inputs, sheets, selects, skeletons, avatars, separators, alerts, and loading indicators should come from `heroui-native` where suitable.
4. **Explicit exceptions** — `FlatList`/`ScrollView` remain React Native primitives for virtualization and refresh; `react-native-enriched-html` is the rich-text editor; `react-native-render-html` remains the server-HTML display base.
5. **Shared packages own contracts** — API decoding and use cases must not be redefined in screens.
6. **Server reconciliation beats optimistic invention** — mutation responses or reloads are authoritative; void SignalR mutations are reconciled instead of trusted blindly.

## 3. Route and navbar architecture

### 3.1 Expo Router files

```text
apps/mobile/src/app/(tabs)/(community)/
  _layout.tsx
  community.tsx
  compose.tsx
  mine.tsx
  notifications.tsx
  thread/
    [id].tsx
```

### 3.2 Stack behavior

| Route | Presentation | Native navbar |
|---|---|---|
| `community` | Community tab root | iOS native large title; Android `NativeScreenScaffold` large top app bar. Right actions: compose and notifications; My Community is exposed through a native overflow/profile action. |
| `thread/[id]` | Native stack push | Back; title uses the initial thread title while loading, then board name. No HeroUI header. |
| `compose` | Native stack push | Back; title `New post`; native right-side `Publish` action bound to editor validity/submission. |
| `notifications` | Native stack push | Back; title `Notifications`; native `Mark all read` action when unread items exist. |
| `mine` | Native stack push | Back; title `My Community`. |

The Community tab stays a nested stack under `NativeTabs`. `apps/mobile/src/app/(tabs)/_layout.tsx` adds `NativeTabs.Trigger.Badge` using the shared profile snapshot's unread count.

### 3.3 Route params

`thread/[id]` accepts:

```text
id: required positive integer
initialTitle: optional display hint
replyId: optional notification target
parentReplyId: optional top-level parent target
trackView: internal-only behavior derived by the hook, not a public route param
```

Related-thread navigation replaces the current thread route rather than continually pushing another detail route.

### 3.4 Transient overlays

These remain HeroUI sheets because they are transient tasks rather than navigation destinations:

- one-time Community posting notice;
- reply composer;
- board/subcategory pickers when a compact Select is not adequate;
- link insertion for the rich-text editor, if included after the POC.

## 4. UI composition

### 4.1 Community Home

Phone-first render order:

1. native navbar
2. HeroUI summary card (title/subtitle/today/online/selected-board heat)
3. announcement alert/card
4. horizontally scrollable board cards/chips
5. sticky filter area:
   - order: Reply / Latest / Hot / Featured
   - scope: All / Today / This week
   - board-dependent subcategories
6. virtualized thread feed
7. pagination/error/end footer
8. Hot Discussions
9. Active Members

HeroUI mapping:

- `Card` or `Surface`: summary, announcement, feed items, secondary modules
- `Chip` / `TagGroup`: board, status, tags, subcategories, metrics
- `Tabs`: compact order/scope controls where accessible scrolling remains usable
- `Avatar`: authors and active members
- `Skeleton` / `SkeletonGroup`: first load and list placeholders
- `Button`: retry/load/action controls
- `Alert`: full and inline error surfaces where suitable
- `ScrollShadow`: horizontal board/filter strips

`FlatList` owns refresh, virtualization, near-end preload, and the existing-items-plus-inline-error state.

### 4.2 Thread detail

Render order:

1. main-post HeroUI card
   - title
   - board/category/status chips
   - author/avatar/deleted marker/time
   - reply/view/like/favorite/heat metrics
   - like/favorite actions
   - safe HTML body
2. Replies section
   - total count
   - empty state or reply cards
   - nested child-reply surface
   - per-reply like and reply actions
   - top-level and child pagination
3. Related Discussions section
4. reply action anchored above bottom safe area or exposed as a navbar/bottom action; it opens a HeroUI reply sheet

Locked threads disable like/favorite/reply mutations exactly as the references do.

### 4.3 Compose

The native page contains:

- HeroUI context card with selected board description and validation hints;
- HeroUI `TextField`/`Input` for title, max 60, minimum trimmed length 6;
- HeroUI `Select` or BottomSheet selectors for board and required subcategory;
- HeroUI formatting toolbar wrapped around `react-native-enriched-html`;
- character count derived from plain text, minimum non-whitespace body length 20;
- inline loading/catalog/error states;
- native navbar Publish action.

Initial safe toolbar subset:

- bold
- italic
- underline
- strikethrough
- blockquote
- ordered list
- unordered list
- link, only if the POC proves an accessible mobile interaction

Initially omit custom tags/features that are not proven cross-client safe:

- code blocks (`<codeblock>`)
- mentions (`<mention>`)
- checkbox lists
- inline images

Use `onChangeText` for body-length validation and `onChangeState` for toolbar state. Do not subscribe to continuous `onChangeHtml`; call `editorRef.getHTML()` only when publishing.

### 4.4 Notifications

- page size 20;
- pull refresh and near-end pagination;
- actor avatar/name, semantic action label, target title, preview, time, read state;
- read-on-open;
- mark all read;
- unread count reconciliation through `profile.load()`;
- CommunityThread opens `thread/[id]` with reply focus params;
- Book opens `/book/[id]`;
- Announcement/Series targets remain visible and markable. If their target routes do not exist, show a sanitized unavailable message instead of silently adding unrelated feature routes or crashing.

### 4.5 My Community

HeroUI `Tabs`:

- Published — shared `CommunityThreadCard`
- Participated — compact reply rows linking to the thread
- Favorites — shared `CommunityThreadCard`

Each tab has independent empty copy but shares one initial overview request and one error/retry state, matching Web-Master's payload.

## 5. Shared data contracts

### 5.1 `packages/api-client`

Add normalized TypeScript contracts and decoders for:

- `CommunityFeedOrder = 'reply' | 'latest' | 'hot' | 'featured'`
- `CommunityFeedScope = 'all' | 'today' | 'week'`
- catalog boards/subcategories
- board/subcategory summaries
- feed items
- pagination
- hot threads and active users
- thread details and nested replies
- My Community overview
- like/favorite toggle results
- notification actor/item/extra/page, including Web's `Series` object type

Add `ApiClient` methods for all methods listed in `research/parity-matrix.md`.

Read methods accept `RequestScheduleOptions` so hooks can abort obsolete requests. Mutations use interactive priority. Decoders own PascalCase/snake_case normalization, null semantics, enum validation, date strings, deleted-author markers, and default boolean/list values.

### 5.2 `packages/client-core`

Add:

- `CommunityUseCase`
- `NotificationsUseCase`
- `createCommunityUseCase(api)`
- `createNotificationsUseCase(api)`
- client-side moderation contracts and guard

The Community use case validates positive IDs, page/size bounds, required board/title/body values, and delegates typed calls to `ApiClient`.

The notification use case provides load, mark, and mark-all operations. Because `MarkNotifications` is a void SignalR mutation and may exhibit the same empty-MessagePack acknowledgement behavior already documented for `DeleteComment`, an invoke error alone is not proof that marking failed. The mobile hook must reconcile with a list/profile reload.

### 5.3 `packages/platform-contracts`

Generalize the existing SHA-256 capability without breaking authentication:

```text
Sha256Hasher.sha256(value)
PasswordHasher extends Sha256Hasher
```

The moderation guard receives platform-neutral dependencies:

- `HttpTransport`
- `KeyValueStore`
- `Sha256Hasher`
- `Clock`
- `Logger`

### 5.4 `apps/mobile/src/services/client.ts`

Instantiate and export:

- `community`
- `notifications`
- `communitySpeechGuard`
- shared non-secret key-value storage used by moderation and posting-notice acceptance

Do not construct independent API/SignalR clients inside screens.

## 6. State ownership and hooks

Proposed hooks:

```text
use-community-home.ts
use-community-thread.ts
use-community-compose.ts
use-community-notifications.ts
use-my-community.ts
use-community-speech.ts
```

### 6.1 Home state

State includes:

- stable home payload modules;
- query `{ boardKey, subCategoryKey, order, scope }`;
- feed items and pagination;
- `loading | refreshing | loadingMore | ready | error` state;
- load-more error separate from full-page error;
- request epoch/AbortController.

Rules:

- initial query defaults to `all / '' / reply / all`;
- filter changes reset to page 1 and fetch only the feed when the home payload already exists;
- refresh fetches the complete home payload;
- obsolete requests cannot overwrite a newer query;
- load-more failure preserves prior items and exposes inline retry;
- on blur/unmount, abort pending read requests.

### 6.2 Thread state

- initial page tracks a view once;
- refresh and appended pages use `trackView: false`;
- top-level replies append by page;
- child replies update only their parent branch;
- notification focus progressively loads missing top-level/child pages, scrolls, then highlights;
- post reply reloads page 1 from server truth;
- mutation locks are per action/reply;
- related-thread replacement resets local state and tracks the new view once.

### 6.3 Notification state

- first-page and load-more errors are distinct;
- marking locally updates perceived responsiveness, then reconciles;
- profile refresh owns the tab badge count;
- failed marking never blocks navigation to the target;
- unsupported target navigation never discards the notification list.

## 7. Moderation and posting policy

Preserve the Flutter contract and current static assets:

- manifest: `[SITE_DOMAIN]/assets/community-moderation/manifest.json`
- schema version 1
- normalization `compact-v1`
- UTF-8 byte-size validation
- lowercase SHA-256 validation
- strictly matching revision
- bounded cache max age 60–86400 seconds
- stable cache with no `expiresAt` semantics

Persistent keys preserve reference compatibility:

- `community_speech_disabled_v1`
- `community_speech_disabled_metadata_v1`
- `community_moderation_rules_cache_v1`
- `community_post_notice_accepted_v1`

Behavior:

1. If speech is already disabled, no compose/reply entry is enabled.
2. Before `CreateCommunityThread`, evaluate title and body plain text.
3. Before `CreateCommunityReply`, evaluate reply text.
4. If rules are unavailable and no valid cache exists, fail closed with retryable UI.
5. If a rule matches, persist disabled state before returning the blocked result.
6. A blocked composer/reply route returns to Community root and remains read-only thereafter.

The rule ID and matched user content are not displayed or logged.

## 8. HTML boundary

### 8.1 Input

- The editor emits HTML but the app exposes only the proven shared-safe toolbar subset.
- Plain text used by moderation and minimum-length validation comes from the native editor's text event, not ad-hoc regex over HTML.
- Publish obtains HTML once with `getHTML()`.
- Empty or visually empty HTML is rejected.
- POC fixtures must open the resulting thread in RN, Web-Master, and Flutter/reference-compatible rendering before enabling the dependency.

### 8.2 Display

Create an app-owned Community HTML renderer contract using `react-native-render-html`:

- ignore script/style and unsupported elements;
- allow safe text/list/heading/blockquote/link/image presentation needed by existing server posts;
- validate outbound link schemes;
- cap remote image width and avoid navigation-script behavior;
- use Community typography rather than reader-specific first-line indentation/footnotes.

Do not pass raw HTML into a WebView.

## 9. Rich-text POC gate

The first execution step is a bounded spike with `react-native-enriched-html@1.1.0`.

Required pass conditions:

- clean Expo prebuild;
- iOS and Android development-client compile;
- Chinese/Japanese/Latin IME composition;
- selection and all enabled formatting controls;
- predictive text on Android;
- keyboard avoidance and nested scrolling;
- dark/light/OLED styling;
- dynamic type and screen-reader labels for toolbar controls;
- app background/foreground and native push/pop;
- `getHTML()` cross-client round trip;
- no use of unsupported custom tags in enabled toolbar output.

Failure switches Compose to the documented HeroUI `TextArea` fallback and does not block Home, Thread, Notifications, or My Community.

## 10. Accessibility and theme

- Every icon-only native navbar and HeroUI action has an accessibility label.
- Chips/tabs expose selected state.
- Cards that navigate use button/link semantics and one full-card hit target.
- Deleted/banned author state is included in accessible text, not color alone.
- Loading more does not steal focus.
- Highlight animation for notification targets respects reduced motion; reduced-motion mode uses a static accent state.
- Colors derive from `useAppTheme`; do not hard-code Web blue/Slate tokens as the app theme.
- Verify compact and large phone widths, dynamic type, light, dark, and OLED dark.

## 11. Recommended Trellis task split

The current task remains the planning/integration parent. Create implementation children only after plan approval:

1. **Community contracts and moderation** — API client, client-core, platform hash contract, tests.
2. **Community editor POC** — dependency/build/IME/HTML gate and fallback decision.
3. **Community home and native navigation** — tab badge, root navbar, filters/feed/secondary modules.
4. **Community thread and replies** — detail, mutations, pagination, focus deep links, reply sheet.
5. **Community compose** — notice, catalog, rich editor, publish.
6. **Community notifications and My Community** — read flows, deep links, tabs, final integration.

Ordering:

```text
contracts/moderation ─┬─> home/navigation
                      ├─> thread/replies
                      ├─> notifications/mine
editor POC ───────────┴─> compose
thread route ───────────> notification deep-link acceptance
all children ───────────> parent integration review
```

## 12. Rollout and rollback

- Keep the existing Community placeholder available until Home plus contracts are functional; do not land a route that crashes on first open.
- Merge the editor dependency only after the POC gate passes. It can be rolled back independently to the TextArea fallback.
- Feature work does not require backend schema changes.
- Unsupported notification destinations use a safe fallback, so Announcement/Series route work can land later.
- If moderation asset loading regresses, publishing fails closed but reading remains available.

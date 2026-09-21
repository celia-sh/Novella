# Plan mobile community feature

## Goal

Deliver a complete React Native Expo Community experience that preserves the product capabilities of the Flutter mobile and Web-Master implementations while fitting Novella's current mobile navigation, theme, data, and package boundaries.

## Background

- The mobile app already has a Community `NativeTabs` destination and nested stack, but its root route is a placeholder (`apps/mobile/src/app/(tabs)/(community)/**`).
- Flutter is the primary mobile interaction reference for Home, Thread, Compose, Notifications, posting notice, and client moderation (`the archived Flutter implementation`).
- Web-Master is the reference for recently-replied ordering, My Community, mark-all-read, responsive content organization, and the complete TypeScript forum contracts (`the Web-Master reference implementation`, `the Web-Master reference implementation`).
- The current RN app already wraps application content in `HeroUINativeProvider` and uses native Expo Router/Android top-app-bar navigation.
- Source findings and deliberate adaptations are recorded in `research/parity-matrix.md`.

## Requirements

### R1 — First-release scope

The first Community release includes:

- Community Home;
- thread detail, top-level replies, child replies, related discussions, likes, and favorites;
- thread creation with rich-text capability;
- Notifications;
- My Community: published threads, participated replies, and favorites.

### R2 — Native navigation hierarchy

- Community remains a `NativeTabs` destination with its own native stack.
- Page titles, back behavior, large titles, and navbar actions are owned by Expo Router/native platform navigation, consistent with other mobile screens.
- HeroUI must not implement a replacement navbar/header.
- The Community tab displays the unread notification count.

### R3 — Community Home

- Show Community summary, announcement, boards, order/scope/subcategory filters, thread feed, Hot Discussions, and Active Members.
- Default feed order is recently replied (`reply`). Also expose latest, hot, and featured ordering.
- Support pull-to-refresh, progressive pagination, skeleton loading, empty state, full error, inline load-more error/retry, and end state.
- Filter changes must not allow stale requests to overwrite the current query.

### R4 — Thread and reply behavior

- Show the main post, author/deleted-author state, board/category/status labels, metrics, safe HTML body, related discussions, and locked state.
- Support thread like/favorite, reply like, posting a top-level reply, replying to a reply, top-level pagination, and child-reply pagination.
- Notification links containing `replyId` and `parentReplyId` must load missing pages, navigate to the target, and highlight it.
- Refresh/pagination must not increment the thread view count again.

### R5 — Compose and posting policy

- Use HeroUI for the compose page's title, board/subcategory selection, validation, loading/error state, toolbar controls, and supporting surfaces.
- Use `react-native-enriched-html` as the preferred editor only after a bounded iOS/Android POC passes. If it fails, use a HeroUI multiline text input that emits safe paragraph HTML.
- Preserve title max length 60, minimum trimmed title length 6, and minimum non-whitespace body length 20.
- Preserve the one-time Community usage notice before first posting.
- After successful creation, open the created thread and refresh Home.

### R6 — Notifications

- Support page size 20, refresh, pagination, read-on-open, and mark-all-read.
- Refresh the shared profile/unread projection after read mutations so the Community tab badge stays consistent.
- Navigate CommunityThread targets with reply focus and Book targets to the existing book route.
- Announcement/Series targets without current mobile routes must remain readable and fail safely instead of crashing.

### R7 — My Community

- Provide Published, Participated, and Favorites tabs.
- Reuse the Community thread-card presentation for published/favorite threads.
- Each tab supports loading, error/retry, data, and empty states.

### R8 — Client moderation

- Preserve the Flutter moderation manifest/rules/cache contract and the static assets published under `apps/site/public/assets/community-moderation/`.
- Validate schema, normalization, revision, UTF-8 size, SHA-256 digest, and cache age.
- Evaluate title/body before thread creation and reply text before reply creation.
- If no valid rules are available, publishing fails closed with retryable feedback while reading remains available.
- If a rule matches, persist Community speech-disabled state and keep Community read-only on that device.
- Matched user content and rule details must not be exposed in UI or logs.

### R9 — UI, theme, and accessibility

- Use `heroui-native` for Community content and controls wherever it has a suitable primitive.
- Intentional exceptions are native navigation, React Native virtualized/scroll containers, the gated rich-text editor, and the app-owned HTML renderer.
- Support light, dark, OLED dark, compact and large phone widths, dynamic type, reduced motion, and screen-reader labels/states.
- Deleted/blocked, unread, selected, locked, loading, and disabled states cannot rely on color alone.

### R10 — Architecture and compatibility

- API payload decoding and SignalR method contracts belong to `packages/api-client`.
- Community/notification use cases and moderation behavior belong to platform-neutral shared code; screens must not parse raw payloads.
- Mobile owns platform storage, hashing, native UI, navigation, and route adapters.
- No backend schema change is required.
- Rich-text output enabled in the first release must round-trip across mobile, Flutter-compatible, and Web rendering.

## Acceptance Criteria

- [ ] **AC1 (R1):** All five first-release surfaces are reachable and expose the reference capabilities listed above.
- [ ] **AC2 (R2):** Community uses native tab/stack/navbar behavior on iOS and Android; no HeroUI custom page header exists.
- [ ] **AC3 (R3):** Home renders every required module and all loading/empty/error/refresh/pagination/filter states with `reply` as the default order.
- [ ] **AC4 (R4):** Thread/reply interactions, locked state, pagination, related navigation, and notification target focus work without duplicate view tracking.
- [ ] **AC5 (R5):** The editor POC has a recorded pass/fallback decision; Compose validates, moderates, publishes, and opens the created thread.
- [ ] **AC6 (R6):** Notifications support single/all read flows, unread badge reconciliation, pagination, supported deep links, and safe unsupported-target behavior.
- [ ] **AC7 (R7):** My Community shows Published, Participated, and Favorites with shared presentation and complete states.
- [ ] **AC8 (R8):** Automated tests cover moderation normalization, validation, cache, unavailable, matched, and already-disabled behavior.
- [ ] **AC9 (R9):** Community passes light/dark/OLED, compact/large phone, dynamic-type, reduced-motion, and accessibility acceptance.
- [ ] **AC10 (R10):** Contract tests, type checks, package-boundary checks, Android build, iOS simulator build, and cross-client HTML fixtures pass.

## Out of Scope

- Community administration or moderator tools.
- Editing or deleting Community threads/replies without reference API contracts.
- User-profile pages for Active Members.
- Adding Announcement or Series detail features solely for notification navigation.
- Rich-text code blocks, mentions, checkbox lists, and inline images until cross-client compatibility is proven.
- Backend changes.
- Production implementation before the user reviews and approves this plan.

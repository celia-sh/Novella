# 移动端公告中心实施计划

## Phase 1 — Protocol And Services

- [ ] Extend `AnnouncementItem` with list HTML and add `AnnouncementDetail` decoding/invocation in `packages/api-client`.
- [ ] Add `AnnouncementsUseCase` to `packages/client-core` and export an instance from mobile client wiring.
- [ ] Add the application-manifest/Markdown HTTP service with validation, HTTPS URL resolution, abort support and front-matter stripping.
- [ ] Add only contract tests that protect real protocol mapping, manifest validation/path resolution, and front-matter behavior; do not hardcode Chinese output merely to prove localization.

Validation:

```bash
npm run test --workspace @novella/api-client
npm run test --workspace @novella/client-core
npm run typecheck --workspace @novella/mobile
```

Rollback: no UI routes consume the contracts yet.

## Phase 2 — Reusable Comments

- [ ] Generalize `useComments` and `useCommentSubmission` from `Book` to typed Book/Announcement targets.
- [ ] Key comment-change events by target.
- [ ] Extract the existing comment item/reply renderer and HeroUI skeleton; preserve current book-comment geometry and behavior.
- [ ] Extract the existing composer sheet body; keep the book route as a thin adapter and add an announcement adapter later.
- [ ] Verify book comment load/post/reply/delete/focus-refresh behavior is unchanged by inspection and typecheck.

Validation:

```bash
npm run typecheck --workspace @novella/mobile
npm run test:client
```

Rollback: revert generic target adapters and restore book wrappers.

## Phase 3 — Announcement Center And Entry

- [ ] Implement `useAnnouncements` concurrent source loading, merged sorting, partial errors, refresh and server pagination.
- [ ] Add Community card “查看更多 + IconChevronRight”.
- [ ] Remove old card-level `AnnouncementLink` external navigation.
- [ ] Add `/announcements` route and list screen with HeroUI Cards and Skeleton loading states.
- [ ] Add localized source/date/error/empty/accessibility copy.

Validation:

```bash
npm run typecheck --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
```

Rollback: Community card and route can be reverted independently of service contracts.

## Phase 4 — Details And Comments

- [ ] Add source-specific detail hook/screen.
- [ ] Render app Markdown through `marked` → `BookHtmlContent`; do not mount comments.
- [ ] Render server HTML through `BookHtmlContent` and append reusable comments with pagination.
- [ ] Add announcement comment composer route using shared composer sheet.
- [ ] Add root-stack configuration for list/detail/form sheet on iOS and Android.
- [ ] Use HeroUI Skeleton for detail and comment loading.

Validation:

```bash
npm run check
npm run test:client
npm run test:community --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
```

Rollback: remove detail/comment routes while retaining the list.

## Phase 5 — Quality Gate

- [ ] Audit list/detail/comment data flow and confirm app announcements never expose comment controls.
- [ ] Confirm no source/reference project name or copied implementation appears in production code.
- [ ] Confirm no tests merely assert hardcoded output is Chinese.
- [ ] Run production exports.

Validation:

```bash
npm run check
npm run test:client
npm run test:reader
npm run test:community --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
cd apps/mobile && npx expo export --platform ios --output-dir $TMPDIR/novella-announcements-ios
cd apps/mobile && npx expo export --platform android --output-dir $TMPDIR/novella-announcements-android
git diff --check
```

## Manual User Acceptance

- [ ] Community 卡片仅“查看更多”进入公告中心，旧外部跳转消失。
- [ ] iOS/Android 公告列表滚动、下拉刷新和继续加载正常。
- [ ] 应用公告详情显示 Markdown 且无评论。
- [ ] 站点公告详情显示 HTML，评论发布/回复/删除和 composer 返回刷新正常。
- [ ] 单一来源失败与两源失败的 UI 状态符合预期。

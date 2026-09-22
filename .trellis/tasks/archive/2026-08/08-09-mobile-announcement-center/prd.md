# 移动端公告中心

## Goal

在移动端社区首页公告卡片右侧增加“查看更多”与右箭头入口，并提供统一公告中心：同时展示轻书架站点公告和 Novella 应用公告；站点公告详情支持评论，应用公告详情不可评论。

## Confirmed Background

- 社区首页公告卡片位于 `apps/mobile/src/screens/community-home-screen.tsx`，当前整卡仅在 `AnnouncementLink` 是 HTTPS 时打开外部链接。
- 站点公告来自既有 SignalR 方法 `GetAnnouncementList`；移动端 API 已有列表 DTO，但尚无 `GetAnnouncementDetail` 合约。
- Web 参考实现：
  - `/announcement` 分页加载站点公告；
  - `/announcement/detail/:id` 展示服务端 HTML；
  - 已登录用户在详情下方使用 `CommentType.Announcement` 评论。
- Flutter 归档实现：
  - 应用公告来自 `[SITE_DOMAIN]/assets/announcements/index.json`；详情按 manifest `path` 获取 Markdown；
  - 应用公告与站点公告按发布时间合并排序，列表显示来源、摘要和日期；
  - 应用公告不可评论；
  - 当前线上 manifest 至少包含 `2026-05-28-long-time-no-see`，路径是相对站点根路径。
- 移动端已有可复用边界：
  - `BookHtmlContent` 可渲染服务端 authored HTML；
  - `CommentThreadRow` / `CommentThreadChildren` 统一展示评论和回复；
  - `CommentsUseCase` 已支持 `CommentTargetType = 'Announcement'`，但 hooks 与 compose route 目前硬编码为 `Book`；
  - Community 页面已经使用 HeroUI Native `Skeleton`。
- 当前工作树另有用户已要求的社区筛选药丸去描边修改，必须作为独立提交保留，不混入公告功能提交。

## Requirements

### R1. Community Entry

- 社区首页公告卡片右侧显示“查看更多”与 Tabler 右箭头图标。
- 点击“查看更多”进入应用内公告中心；旧公告卡片和 `AnnouncementLink` 不再承担外部跳转。
- 删除社区公告卡片现有的外部链接交互，卡片内容本身改为非跳转展示；仅“查看更多”是公告中心入口。
- 保留当前公告摘要和公告图标，不改变社区主列表、筛选栏或大标题滚动层级。

### R2. Announcement Center

- 一个列表同时展示应用公告与站点公告，并按发布时间倒序排列。
- 每项显示标题、最多两行摘要、日期、来源标签（应用公告 / 站点公告）和进入详情的右箭头。
- 应用公告使用手机相关 Tabler 图标；站点公告使用世界/站点相关 Tabler 图标。
- 支持下拉刷新、站点公告分页加载、部分来源失败时展示另一来源的可用数据。
- 加载态和分页加载态使用 HeroUI Native `Skeleton`；提供明确的空态、错误态和重试。

### R3. App Announcements

- 从固定公开 manifest 加载并严格校验 `id/title/path/publishedAt`；无效条目丢弃。
- 相对 Markdown 路径按 manifest 站点根路径解析；HTTP 非 2xx、无效 JSON 和无效路径必须成为可恢复错误。
- 详情获取 Markdown，移除 YAML front matter 后在应用内渲染。
- 应用公告详情不显示评论、不提供评论入口。

### R4. Site Announcements

- API client/client-core 增加真实 `GetAnnouncementDetail { Id }` 合约并解码 `Id/Title/CreatedAt/Content`。
- 详情使用现有 HTML 渲染组件展示服务端 authored HTML。
- 详情下方加载 `CommentTargetType = 'Announcement'` 评论，复用现有评论行、回复、删除、分页和评论提交逻辑。
- 评论 composer 必须复用通用实现，不复制书籍评论输入页面；书籍评论行为保持不变。

### R5. Navigation And Localization

- 新增公告列表、详情与评论 composer 的 Expo Router 路由，支持 Android 原生 top app bar 和 iOS native stack。
- 所有第一方标题、状态、按钮、来源与无障碍文案加入 `zh-CN` / 台湾 `zh-TW` 资源；公告标题、正文、摘要和评论保持服务端/manifest 原文。
- 图标使用 Tabler；系统导航和系统菜单图标仍由平台原生控件负责。

### R6. Reuse And Visual Contract

- 列表/详情/loading/error/comment 区域优先复用现有 Community、HTML、评论、主题与 formatter 边界。
- 骨架屏必须使用 HeroUI Native `Skeleton`，不得新增自绘动画骨架。
- 不复制 reference 源码、命名或品牌到正式代码。

## Acceptance Criteria

- [ ] 社区公告卡片右侧出现“查看更多 + 右箭头”，点击进入应用内公告中心。
- [ ] 公告中心合并展示应用与站点公告，来源、摘要、日期、排序正确。
- [ ] 应用公告 Markdown 能加载和显示，详情没有评论区或评论按钮。
- [ ] 站点公告 HTML 能加载和显示，评论区可加载、分页、发布、回复和删除。
- [ ] 一个来源失败时，另一来源仍可显示，并可独立重试/刷新。
- [ ] 首次加载、分页加载使用 HeroUI Skeleton；空态与错误态完整。
- [ ] 简繁资源结构一致，服务端和 manifest 内容不被 UI i18n 改写。
- [ ] Workspace check、相关 API/client/mobile tests、iOS/Android production export 和 `git diff --check` 通过。
- [ ] 用户手动验收 iOS/Android 导航、滚动、评论 composer 和两类详情。

## Out Of Scope

- 在应用公告下增加评论。
- 修改服务端公告、评论或 manifest 数据格式。
- 自动翻译公告或评论正文。
- 在本任务中实现推送通知、强制公告弹窗或远端已读同步。

## Scope Decision

- 首版仅实现公告列表与详情，不实现 Flutter 的本地未读红点、required 启动拦截、倒计时或完成动作；这些能力涉及新的持久化与启动协调，留待独立任务。

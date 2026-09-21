# 技术设计：移除宣传站点与应用内软件公告

## 1. 目标与边界

本任务把两个有关联但必须分开的能力拆开处理：

1. 删除 `apps/site` React/Vite 宣传站点及其构建、Cloudflare Pages 发布和静态资源生产链路。
2. 删除移动端从该站点读取的“应用公告”（静态 Markdown manifest），但保留轻书架服务端提供的“站点公告”（API 列表/详情/评论/通知）。

不修改轻书架服务端；仓库没有该服务端实现。DNS、Cloudflare Pages 账号资源、GitHub Actions secrets/variables 由用户在仓库外处理。侧载资源已有替代方案，不属于本任务。

## 2. 现状数据流

### 2.1 应用公告（删除）

```text
apps/site/public/assets/announcements/*.md
  -> generate-announcements.mjs
  -> public/assets/announcements/index.json (ignored)
  -> Cloudflare Pages /assets/announcements/index.json
  -> apps/mobile/src/services/app-announcements.ts
  -> useAnnouncements.reloadApp()
  -> AnnouncementCenterScreen (source = app)
  -> useAnnouncementDetail/app detail + marked
```

详情会重新读取 manifest，再读取 Markdown；仓库证据表明没有本地持久化、缓存、feature flag 或启动轮询。站点被删除后，仍在使用旧客户端的用户会看到应用公告源错误。

### 2.2 站点公告（保留）

```text
LightNovelShelf API / SignalR
  -> GetAnnouncementList / GetAnnouncementDetail
  -> packages/api-client DTO decoder
  -> packages/client-core announcements use case
  -> apps/mobile/src/services/client.ts
  -> useAnnouncements.reloadServer()
  -> AnnouncementCenterScreen (source = server)
  -> SiteAnnouncementDetail
  -> useComments(target = Announcement) / notifications
```

社区主页的 `CommunityHomePayload.announcement` 也属于这条服务端链路，只是摘要入口；不能因为名字相同而删除。

## 3. 目标结构

### 3.1 站点边界

- 删除整个 `apps/site/`，包括源码、Vite 配置、生成脚本、静态图片、公告 Markdown、robots 和站点 package manifest。
- 删除 `.github/workflows/deploy_site.yml`。
- 从 `.github/workflows/validate.yml` 删除站点构建步骤，保留 checkout、npm ci、边界、类型和客户端/阅读器测试。
- 根 `package.json` 删除 `dev:site`；通用 `build` 脚本可保留，因为它按 workspace 的现有 build 脚本工作。
- 删除 `.gitignore` 中只服务站点生成物的条目；根 `dist/` 等通用规则仍然保留。
- `README.md`、`CONTRIBUTING.md` 不再把 `apps/site` 描述为项目组成。
- 重新生成 `package-lock.json`，使 `apps/site` workspace/link 及仅由站点使用的 React DOM/Vite 依赖被移除；不要手工拼接 lockfile。

### 3.2 移动端公告边界

`useAnnouncements` 改为只拥有服务端公告状态：

- `AnnouncementListEntry` 只保留 `source: 'server'`、数字 `serverId`、标题、日期和预览。
- 删除 `appItems`、`appError`、应用 generation/controller、`reloadApp` 以及应用/服务端合并逻辑；保留服务端分页、去重、刷新、取消和 generation 保护。
- 首次加载、重试和刷新只请求 `announcementUseCase.loadPage`；应用公告 URL 不应再出现在产物或源码中。
- 公告中心继续保留 `/announcements`、`/announcement/[source]/[id]` 和公告评论 compose 路由，因为它们仍服务 `source=server`。
- `AnnouncementDetailScreen` 只渲染服务端详情；未知或旧的 `source=app` 深链进入 invalid 状态，不发起网络请求。删除 `marked` 及应用 Markdown 详情分支。
- `AnnouncementArticle` 可以保留为服务端公告的共享渲染组件，但应删除 `source: 'app'` 分支和应用来源文案。
- `AnnouncementCenterScreen` 只显示 `IconWorld`/站点公告文案和服务端错误；保留服务端空态、分页失败、刷新和详情导航。
- 删除 `apps/mobile/src/services/app-announcements.ts` 及测试，并从 `test:community` 移除该测试文件。
- 从 `apps/mobile/package.json` 删除仅由应用公告详情使用的 `marked`；`htmlparser2` 仍被 HTML 预览和 Readium 资源处理使用，不删除。
- 关于页删除 `novella.celia.sh` 常量、外部链接行及 `zh-CN`/`zh-TW` 对应文案；GitHub 源码、更新日志、轻书架和群组链接保留。

### 3.3 明确不得修改的服务端公告契约

以下内容是站点公告功能而非宣传站点的实现，必须保持：

- `packages/api-client` 的 `AnnouncementItem`、分页请求、`GetAnnouncementList`、`GetAnnouncementDetail` 和 decoder。
- `packages/client-core` 的 `AnnouncementsUseCase` 与 `createAnnouncementsUseCase`。
- 移动端 `announcements` use-case 导出。
- `CommentTargetType = 'Announcement'`、公告评论加载/提交/刷新和 `AppNotificationObjectType = 'Announcement'`。
- 社区主页 `home.announcement` 摘要和其打开公告中心的行为。
- GitHub Release 更新检查（它访问 `api.github.com`，不是宣传站点）。
- `navigation.routes.announcements`、站点公告翻译键和公告中心路由。

## 4. 外部资源与兼容性

### 4.1 用户执行的站点删除

代码合并并发布移动端清理版本后，用户再执行：

- 删除/停用 Cloudflare Pages 项目 `novella` 及 `novella.celia.sh` custom domain/DNS 绑定。
- 审计 `CF_PAGES_PROJECT_NAME`、`SITE_URL`、`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；只删除或撤销确认仅服务该站点的资源，不影响其他项目。
- 如需要保留公告历史，应在删除当前路径前把公告内容复制到 GitHub Release/Discussion；Git 历史本身仍保留删除前版本，但不提供运行时 URL。

### 4.2 旧版本行为与发布顺序

推荐顺序：

1. 先合并并发布包含客户端清理的移动端版本。
2. 验证新版本公告中心只请求轻书架 API，关于页不再展示宣传站点。
3. 用户删除 Cloudflare/DNS/站点资源。
4. 用旧版/新版本分别确认预期：旧版可能出现应用公告源失败提示；新版不应产生该请求。

如果站点先删除，旧版本仍会在公告中心并发请求静态 manifest，表现为“应用公告暂时不可用”；这是可预见的兼容性结果，不应通过删除站点公告 API 来规避。

## 5. 错误、回滚与验证原则

- 客户端不保留一个指向已删除域名的空壳 fallback；否则会继续产生无效网络请求。
- 新客户端对历史 `source=app` 路由只显示无效公告状态，不把字符串 ID误传给服务端公告 API。
- 在外部删除前，代码删除仍可通过 Git 回滚；外部资源删除后，恢复服务还需要重新建立 DNS/Pages 和 secrets，不能仅靠回滚代码。
- 变更完成后用仓库残留扫描确认宣传站点、应用公告 URL、`marked` 和 `@novella/site` 均不再被生产代码引用，同时用正向扫描确认服务端公告 API、评论 target 和更新检查仍存在。

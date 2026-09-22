# 移除宣传网页及应用内软件公告

## Goal

计划下线宣传网页 `[SITE_DOMAIN]`，同时移除与该网页联动的“应用内软件公告”功能（区别于轻书架接口提供的站点公告），避免下线后留下无效入口、请求、构建/部署任务和运营资源。

本任务已完成仓库证据盘点、范围收敛和仓库内实现；DNS、external deployment provider 等外部资源仍不在本仓库内处理。

## Background / Confirmed facts

- 目标站点为 `[SITE_DOMAIN]`。
- `apps/site` 是一个独立的 React/Vite 静态宣传站点，页面只有 Home/Download；它从 GitHub API 构建仓库、最新 Release、贡献者数据，并生成静态站点资源（`apps/site/src/app.tsx:3-281`、`apps/site/scripts/fetch-site-data.mjs:4-17`、`apps/site/scripts/prepare-site.mjs:3-14`）。
- 站点还承载应用内软件公告 Markdown/索引；公告生成器扫描 `apps/site/public/assets/announcements/*.md` 并写入被忽略的 `index.json`（`apps/site/scripts/generate-announcements.mjs:3-30`）。现有公告正文明确说明它独立于轻书架公告系统（`apps/site/public/assets/announcements/2026-05-28-long-time-no-see.md:1-8`）。侧载资源迁移已有替代方案，不属于本任务范围。
- 站点由 `.github/workflows/deploy_site.yml:3-65` 定时、发布和主分支变更触发，构建后部署 external deployment service；`.github/workflows/validate.yml:51-55` 也单独构建站点。仓库没有 DNS、external deployment provider 项目或重定向配置，账号/DNS/域名状态需在仓库外核实。
- 应用内软件公告的唯一客户端静态数据源是 `apps/mobile/src/services/app-announcements.ts:1-104`：从站点的 `assets/announcements/index.json` 加载清单，再按公告路径获取 Markdown；无本地持久化、缓存、功能开关或启动轮询（`apps/mobile/src/hooks/use-announcements.ts:71-87,129-153`）。其单元测试位于 `apps/mobile/src/services/app-announcements.test.mjs:9-34`，并由 `apps/mobile/package.json:72` 纳入测试。
- 移动端公告中心当前把两类来源合并排序：应用公告和站点公告（`apps/mobile/src/hooks/use-announcements.ts:13-53,216-274`）；应用来源的列表/错误/详情逻辑在 `apps/mobile/src/screens/announcement-center-screen.tsx:36-216`、`apps/mobile/src/hooks/use-announcement-detail.ts:9-92`、`apps/mobile/src/screens/announcement-detail-screen.tsx:39-95`。移除应用来源后，公告中心、详情路由和评论流程仍应保留站点公告。
- 站点公告来自轻书架服务端 API，不依赖 `[SITE_DOMAIN]`：`GetAnnouncementList`/`GetAnnouncementDetail` 定义于 `packages/api-client/src/index.ts:927-964,1131-1152`，移动端经 `packages/client-core/src/index.ts:135-138,676-690` 和 `apps/mobile/src/services/client.ts:73` 使用。站点公告的评论目标 `Announcement` 和通知对象类型也必须保留（`packages/api-client/src/index.ts:473,881-884`；`apps/mobile/src/screens/announcement-detail-screen.tsx:203-232`）。
- 社区主页的 `home.announcement` 是服务端/站点公告摘要，入口位于 `apps/mobile/src/screens/community-home-screen.tsx:270-282,347-371`，不读取静态应用公告；这部分不能误删。
- 关于页仍有一个打开 `[SITE_DOMAIN]` 的外部链接（`apps/mobile/src/screens/settings/about-settings-screen.tsx:11-13,73-79`），中英文文案在 `apps/mobile/src/localization/locales/settings.ts:209-212,635-639`。
- GitHub Release 更新检查是另一条独立链路，使用 GitHub API 和 Release URL（`apps/mobile/src/services/app-update.ts:1-2`、`apps/mobile/src/services/app-update-alerts.ts:19-45`），不应因本次移除而删除或改为站点依赖。
- `marked` 仅被应用公告详情使用（`apps/mobile/src/screens/announcement-detail-screen.tsx:8,60-64`），移除该详情实现后可评估同步移除移动端依赖；`htmlparser2` 仍被阅读器/HTML 预览使用，不能一并删除。
- 根 README/CONTRIBUTING 仍将 `apps/site` 列为项目结构（`README.md:18-23`、`CONTRIBUTING.md:5-10`）；根脚本 `package.json:10,14` 和 lockfile 也包含站点 workspace。删除站点后需要同步清理 workspace、lockfile、文档和 CI 引用。

## Requirements

- 删除 `apps/site` 的源码、构建脚本、静态资源和站点 workspace，并更新根 workspace/lockfile/文档引用。
- 删除 external deployment service 站点构建/部署 workflow，并移除验证 workflow 中的站点构建步骤；保留移动端/共享包的 CI 检查。
- 删除应用内软件公告的静态数据生产链路、客户端数据源、应用来源的合并/错误/详情逻辑、相关测试和不再需要的依赖。
- 从关于页移除已下线域名入口及对应中英文翻译；检查所有 `[SITE_DOMAIN]`、站点资源和站点 workspace 引用归零。
- 保留轻书架接口的站点公告列表、详情、评论、通知类型、社区主页公告摘要和公告中心/详情的站点来源功能。
- 记录仓库外的 DNS、external deployment service 项目/变量/密钥、监控/搜索引擎处置工作；侧载资源迁移不属于本任务。
- 明确分阶段顺序：先发布一个移除客户端静态公告依赖的移动端版本，再由用户自行停用站点承载与域名，避免已发布版本立即把公告中心的一半请求打成错误；不在本仓库任务中执行 DNS/external deployment provider 删除。

## Acceptance Criteria

- [x] 研究/实施清单逐项列出站点、应用内软件公告和外部托管资源的影响面，并带路径与代码证据。
- [x] 清单明确区分“应用公告”和“站点公告”，并列出保护站点公告、评论、通知及社区主页入口的检查项。
- [x] 删除后仓库不再包含 `apps/site` workspace、external deployment service 构建/部署引用、静态公告 URL/域名入口或应用公告专用依赖；残留扫描有明确命令和预期结果。
- [x] 删除后公告中心仍能加载、分页、刷新和打开轻书架站点公告，站点公告评论和通知目标仍可用；GitHub Release 更新检查仍可用。
- [x] `npm ci`、边界检查、类型检查和客户端/阅读器测试通过，且不再执行站点构建。
- [x] 已记录域名/external deployment provider 删除由用户在仓库外自行处理；侧载资源已有替代方案不纳入本任务，旧版本行为和客户端版本发布顺序已明确。
- [x] 复杂任务的 `design.md` 与 `implement.md` 在进入实现前完成，并按实施清单完成仓库内修改。

## Scope decision

- `[SITE_DOMAIN]` 的 DNS、external deployment service 项目及相关外部资源由用户自行删除；本仓库只清理源码、客户端依赖和 CI/文档引用，不代为执行外部删除。侧载替代方案已存在，不在本任务内跟进。
- 推荐先发布移除应用公告依赖的移动端版本，再删除站点承载；旧版本若仍访问静态公告 URL，将收到网络/解析失败，这是已知兼容性结果。

# 实施计划：移除宣传站点与应用内软件公告

> 实施状态：任务已启动，仓库清理已完成；外部 DNS/external deployment provider 和设备验收仍由用户处理。

## 0. 前置审阅与发布策略

- [x] 确认本任务按“删除 `apps/site` + 保留站点公告 API”执行。
- [x] 确认移动端清理版本先于用户删除 DNS/external deployment service；把域名删除列为仓库外手动步骤。
- [ ] 如需保留应用公告历史，在删除站点文件前完成外部复制。

## 1. 清理站点 workspace 与 CI

- [x] 删除 `apps/site/` 全目录：`package.json`、`src/`、`scripts/`、`public/` 及静态资源。
- [x] 删除 `.github/workflows/deploy_site.yml`，包括定时、release、external deployment service 部署和站点专用 secrets/variables 引用。
- [x] 从 `.github/workflows/validate.yml` 删除 `Build public site` 步骤，保留移动端/共享包的验证步骤。
- [x] 从根 `package.json` 删除 `dev:site`，保留通用 workspace 脚本。
- [x] 删除 `.gitignore` 只服务 `apps/site` 生成物的规则，保留通用 `dist/`、`build/` 等忽略规则。
- [x] 更新 `README.md` 与 `CONTRIBUTING.md` 的目录结构，不再描述已删除站点。
- [x] 在根目录运行 npm 的 lockfile 更新，确认 `package-lock.json` 删除 `apps/site` workspace/link 及不再需要的站点直接依赖；不要留下手工不一致的 lockfile。

**风险/回滚点**：站点目录删除是最大文件删除点；先确认应用公告历史是否需要存档，并在同一提交前检查 `git diff --stat`。侧载资源迁移已有替代方案，不在本任务处理。若移动端验证失败，先回滚移动端部分或延后外部删除，不要删除 external deployment provider 资源。

## 2. 删除客户端应用公告来源，保留服务端公告

- [x] 删除 `apps/mobile/src/services/app-announcements.ts` 与 `app-announcements.test.mjs`。
- [x] 修改 `apps/mobile/src/hooks/use-announcements.ts`：移除静态 manifest import、应用类型/状态、应用 generation/controller、`reloadApp` 和双源合并；保留服务端列表分页、预览生成、去重、刷新、取消和错误状态。
- [x] 修改 `apps/mobile/src/hooks/use-announcement-detail.ts`：只允许 `source=server`，删除应用 Markdown 分支；对旧 `source=app` 深链直接返回 invalid，不发起请求。
- [x] 修改 `apps/mobile/src/screens/announcement-center-screen.tsx`：删除应用来源图标、错误、空态参数和分支；列表仍显示/刷新/分页/打开服务端站点公告。
- [x] 修改 `apps/mobile/src/screens/announcement-detail-screen.tsx`：删除 `AppAnnouncementDetail`、`marked` import 和应用来源联合类型；保留服务端详情、评论、评论刷新和 compose 导航。共享文章组件若仍只被服务端使用，收窄为服务端字段。
- [x] 保持 `apps/mobile/src/app/announcements.tsx`、`apps/mobile/src/app/announcement/[source]/[id].tsx` 和 `apps/mobile/src/app/announcement/comment-compose.tsx`，因为它们的服务端公告路径仍需要。
- [x] 从 `apps/mobile/package.json` 删除 `marked`，从 `test:community` 移除已删除的 app-announcements 测试文件；重新生成 lockfile。确认 `htmlparser2` 仍由其他模块使用并保留。
- [x] 从 `apps/mobile/src/localization/locales/community.ts` 的 `zh-CN` 与 `zh-TW` 删除 `appSource`、`errors.app`、`errors.partialApp`；保留 `siteSource`、站点错误、公告标题/详情、评论和公共导航文案。

**风险/回滚点**：`useAnnouncements` 与详情页同时有 `app`/`server` 联合状态；修改后必须确保 server 的 `loadMore`、刷新、评论和 invalid 参数路径仍有类型覆盖。不要删除 API `Announcement` 契约或 `CommentTargetType`。

## 3. 删除已下线宣传入口

- [x] 修改 `apps/mobile/src/screens/settings/about-settings-screen.tsx`，移除 `novellaUrl` 及其外部链接行；保留 GitHub、轻书架和群组链接。
- [x] 从 `apps/mobile/src/localization/locales/settings.ts` 的简体/繁体资源删除 `about.externalLinks.novellaTitle` 与 `novellaDescription`。
- [x] 不修改社区主页的 `home.announcement`、`router.push('/announcements')`、`packages/api-client`/`client-core` 的站点公告实现。

## 4. 依赖与残留审计

- [x] 搜索并确认生产代码不再引用：`[SITE_DOMAIN]`、`apps/site`、`@novella/site`、`APP_ANNOUNCEMENT`、`AppAnnouncement`、`loadAppAnnouncement`、`source: 'app'`、`partialApp`、`appSource`、`marked`。
- [x] 正向搜索确认以下保留项仍存在且被使用：`GetAnnouncementList`、`GetAnnouncementDetail`、`Announcement` comment target、`AppNotificationObjectType` 的公告分支、`home.announcement`、GitHub `releases/latest` 更新检查。
- [x] `git grep` 结果中若只剩 task 文档或 Git 历史，不视为生产残留；不要为了清零而删除站点公告相关 `Announcement` 类型。

## 5. 自动验证

从仓库根目录执行（均已通过）：

```bash
npm ci
npm run check:boundaries
npm run typecheck
npm run test:client
npm run test:reader --workspace @novella/mobile
npm run build
npm run test:community --workspace @novella/mobile
npm run test:settings --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
npm ls marked --all

git diff --check
git grep -n -I -E 'novella\\.celia\\.sh|@novella/site|apps/site|APP_ANNOUNCEMENT|AppAnnouncement|loadAppAnnouncement|source: .app.|partialApp|appSource|marked' -- ':!package-lock.json'
```

预期：npm/类型/测试/边界检查成功；通用 build 不再触发站点 build；`npm ls marked --all` 不再列出直接或间接安装项；最后的残留扫描无生产代码结果。若 lockfile 尚未移除站点的间接依赖，应先重新执行 npm lockfile 更新并复查，而不是忽略输出。

## 6. 人工验收与外部收尾

- [ ] 新移动端版本在 iOS simulator/device 上：公告中心仅加载站点公告，刷新和分页可用，打开详情可评论；社区首页公告摘要仍可进入公告中心；旧 `source=app` 深链显示无效状态且无静态域名请求。
- [ ] 关于页不再显示 `[SITE_DOMAIN]`；GitHub 源码、更新日志和手动更新检查仍可用。
- [ ] 用户在确认新版本已发布后，自行删除 external deployment service 项目/custom domain/DNS 记录及确认仅供站点使用的变量、密钥。
- [ ] 外部删除后按用户选择验证旧域名的预期结果，并记录旧版本会显示应用公告不可用的兼容性说明。

## 7. 提交前回滚检查

- [x] `git diff --stat` 只包含本任务的站点删除、移动端应用公告清理、依赖/文档/CI 更新和任务文档。
- [x] 保留服务端公告 API/评论/通知的正向测试结果；若失败，不得标记任务完成。
- [ ] 代码提交后再执行外部站点删除；外部删除完成后若要恢复，除 Git 回滚外还需恢复 DNS/Pages 配置，不能假设回滚代码即可恢复域名。

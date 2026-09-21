# 公告中心参考实现与复用矩阵

## 站点公告（Web）

| 能力 | 证据 | 移动端结论 |
|---|---|---|
| 列表路由 | `the Web-Master reference implementation:15-25` | 新增应用内列表和详情路由 |
| 分页列表 | `the Web-Master reference implementation:1-77` | 站点源按页加载，支持刷新与继续加载 |
| 列表信息 | `Announcement.vue:20-28` | 日期、标题、摘要、相对时间；移动端保留标题/摘要/日期/来源 |
| 详情 HTML | `AnnouncementDetail.vue:1-30` | 复用 `BookHtmlContent` 渲染服务端 HTML |
| 详情加载骨架 | `AnnouncementDetail.vue:14-22` | 移动端改用 HeroUI Native `Skeleton` |
| 公告评论 | `AnnouncementDetail.vue:27`，`CommentType.Announcement` | 站点详情复用现有评论 hooks、评论行、回复/删除和 composer |

## 应用公告（Flutter archive）

| 能力 | 证据 | 移动端结论 |
|---|---|---|
| Manifest | `announcement_service.dart:28-42` | 固定公开 URL，严格校验条目 |
| Markdown 内容 | `announcement_service.dart:44-64` | 按站点根解析路径，剥离 front matter 后转 HTML 并复用现有 HTML renderer |
| 合并排序 | `announcement_provider.dart:124-163` | 应用与站点源按发布时间倒序合并 |
| 列表卡片 | `announcement_center_page.dart:101-177` | 来源图标、标题、摘要、日期/来源、右箭头 |
| 应用详情 | `announcement_detail_page.dart:107-127` | 应用公告只显示 Markdown 内容，不显示评论 |
| 站点详情 | `announcement_detail_page.dart:129-158` | HTML 内容；本任务额外按 Web 要求恢复评论 |
| 未读/required | `announcement_provider.dart:65-120`、`required_announcement_sheet.dart` | 用户明确排除，不实现读状态、启动拦截或倒计时 |

## 当前移动端复用点

| 边界 | 文件 | 复用方式 |
|---|---|---|
| Community 入口 | `apps/mobile/src/screens/community-home-screen.tsx:380-404` | 保留卡片内容；移除旧 HTTPS 外跳；增加“查看更多 + Tabler chevron” |
| HTML renderer | `apps/mobile/src/components/book-html-content.tsx` | 站点 HTML 和 Markdown 转换后的 HTML 共用 |
| 评论展示 | `apps/mobile/src/components/comment-thread.tsx` | 公告与书籍共用评论/回复行 |
| 评论数据 | `apps/mobile/src/hooks/use-comments.ts` | 将硬编码 Book target 泛化为 typed target |
| 评论提交 | `apps/mobile/src/hooks/use-comment-submission.ts` | 将硬编码 Book target 泛化，并抽取共享 composer sheet |
| 评论 use case | `packages/client-core/src/index.ts:162-172, 788-812` | 已接受 `CommentTargetType = Announcement`，无需新 mutation 协议 |
| HeroUI skeleton | `apps/mobile/src/screens/book-comments-screen.tsx:190-230`、Community screens | 抽取可复用评论骨架；公告列表/详情使用 HeroUI Skeleton |
| Locale formatter | `apps/mobile/src/localization/formatters.ts` | 日期和相对时间显式使用当前 app locale |

## Deliberate Deviations

- 不复制 Flutter 的未读红点、required 强制阅读、倒计时和 completion action。
- 社区首页旧 `AnnouncementLink` 外跳被删除；新入口始终进入应用内公告中心。
- 应用公告在正式 Novella UI 中渲染，但不复制 Flutter 页面源码、类名或布局代码。

# 跟进 Web-Master 最新契约

> 状态：已完成，2026-10-04 按用户确认归档。本文的完成记录取代此前未更新的验收清单；原始需求保留用于追溯。

## Goal

同步 Novella 与 `Web-Master reference snapshot [COMMIT]` 的最新漫画详情、评论、通知和社区线程管理契约，确保当前后端发布后，漫画详情/阅读/评论/通知跳转继续可用，并让有权限的用户能够锁定或解锁社区帖子。

## Background

参考仓库已从 `[COMMIT]` 快进到 `[COMMIT]`，包含两个提交：

- `[COMMIT] feat: add thread lock action`
- `[COMMIT] refactor: unify book and manga detail pages`

已确认 Novella 当前状态：

- 漫画详情仍通过 `GetComicInfo`/`GetComicSeriesInfo`，而 Web-Master 已统一为 `GetBookInfo`。
- `GetBookInfo` 新响应使用 `Book.Chapters`、`Book.Type`、`SeriesTitle`、`Series`，章节包含 `SortNum`、`PageCount`、`DownloadCost`。
- 漫画列表当前只有一个 `id` 字段，移动端仍以系列标题作为详情和通知跳转依据；Web-Master 使用作品/卷 ID 进入统一详情。
- 评论模型仍支持 `Series` 和 `seriesTitle`，最新 Web-Master 评论契约只支持 `Book` 与 `Announcement`。
- 通知仍支持 `open_series`，且 `open_book` 固定按小说打开；Web-Master 使用统一的 `open_book`。
- Novella 已有锁定状态展示和锁定后禁用互动，但缺少 `SetCommunityThreadLocked` mutation。

## Requirements

### R1 — 统一漫画详情契约

- 使用当前 `GetBookInfo({ Id })` 获取小说和漫画详情。
- 严格解码当前详情响应，支持 `Book.Type`、`Book.Chapters`、`SeriesTitle`、`Series` 及章节分页/下载字段。
- 漫画详情、章节列表、漫画阅读器、阅读位置恢复和章节下载使用统一的作品 ID 与章节 ID。
- 保留当前阅读位置恢复、6 页图片批量和现有图片预加载行为。
- 删除或停止移动端关键路径对 `GetComicInfo`、`GetComicSeriesInfo` 和按系列标题详情的依赖。

### R2 — 漫画列表与评论迁移到作品 ID

- 漫画列表项同时表达展示用系列标题和进入详情所需的作品/卷 ID。
- 搜索、发现、历史、书架、排行、版本切换和漫画详情入口使用有效作品 ID。
- 评论请求只使用 `Book` 或 `Announcement`；漫画评论使用当前作品 ID 的 `Book` 目标。
- 删除移动端关键路径对 `Series`、`seriesTitle` 评论参数的依赖，避免向当前后端发送已移除字段。
- 不改变非编辑内容仍使用 HTML 的既有约束。

### R3 — 通知跳转兼容

- 移除 `open_series` 作为当前契约的依赖。
- `open_book` 进入能够根据服务端详情类型识别小说/漫画的统一详情入口，不默认把漫画当小说。
- 保留 `open_announcement` 与 `open_community_thread` 的现有严格 ID 校验和路由行为。
- 未知或无效 action 继续安全忽略并显示现有不可用反馈。

### R4 — 社区线程锁定

- 在 API client 和 client-core 增加 `SetCommunityThreadLocked`，请求为 `ThreadId`、`Locked`，解码 `Id`、`Locked`。
- 仅允许现有 `canEdit` 用户看到锁定/解锁操作。
- 防止重复提交，成功后立即采用服务端返回的锁定状态；失败保留当前状态并展示本地化错误。
- 锁定状态继续禁用点赞、收藏、回复及回复点赞。
- 增加简体中文和台湾繁体中文文案及对应单元测试。

## Acceptance Criteria

- [x] R1/R2：统一漫画详情、作品 ID 入口和 Book 评论目标已完成。
- [x] R3：通知 `open_book` 使用类型识别入口，旧 `open_series` 已退出当前契约。
- [x] R4：社区线程锁定/解锁契约和权限控制已完成。
- [x] [self-verified] 当前 API/client-core 套件、移动端相关测试、类型和边界检查通过，验证范围见下方完成记录。
- [x] [user-accepted] 用户于 2026-10-04 确认之前除私信分支外的工作均已完成，当前私信工作也已完成。任务不再保留进行中的功能项。

## Out of Scope

- Web-only Quasar 页面布局和视觉样式迁移。
- 后端 API、部署、DNS、external deployment provider 或参考仓库修改。
- 阅读器 HTML 内容模型或全局 Markdown 存储迁移。
- 与本次两个远端提交无关的通知 envelope、商店、成长值和 public profile 改动。

## Technical Notes

- 当前 Novella 仍保留旧模型的证据位于 `packages/api-client/src/index.ts` 的漫画类型、详情 API、评论类型和 decoder，以及 `packages/client-core/src/index.ts` 的漫画详情/阅读接口。
- 当前通知旧系列路径位于 `apps/mobile/src/services/community-utils.ts` 与 `apps/mobile/src/screens/community-notifications-screen.tsx`。
- 当前社区线程已有 `locked` 读状态和互动拦截，新增 mutation 应沿用现有 `threadActionId` 互斥状态。

## Follow-up — `Web-Master reference snapshot [COMMIT]`

参考仓库随后从 `[COMMIT]` 更新到 `[COMMIT]`。移动端需要继续同步两项当前契约：

### R5 — 公共用户摘要 Hub 迁移

- `getPublicUserSummary` 改用 `GetUserSummary({ UserId })`。
- 删除已移除的 `/api/user/summary` REST 路由依赖。
- 保留现有严格摘要解码、请求去重和五分钟缓存。

### R6 — 私信

- 增加 `GetDirectConversations`、`GetDirectMessages`、`SendDirectMessage`、`MarkDirectMessagesRead` 和 `SetDirectMessageBlock` Hub 契约。
- 严格解码会话、消息、分页、已读游标、拉黑状态和 `CanSend`；MessagePack 实时事件中的 `Date` 在边界统一为 ISO 字符串。
- 订阅 `OnDirectMessage`、`OnDirectMessageRead` 和 `OnDirectMessageBlockChanged`，并在重连后从服务端校准断线期间可能遗漏的状态。
- 同一会话的发送按用户操作顺序串行；失败消息保留原 `ClientMessageId`，重试时复用以命中服务端幂等。
- 提供会话列表、聊天、历史加载、发送/重试、已读回执和拉黑/取消拉黑界面。
- 已登录用户可从公共用户资料发起私信，也可从应用导航进入私信列表；不能给自己发私信。
- `GetMyInfo` 新增 `UnreadDirectMessageCount`，实时事件后刷新并在移动端入口展示未读状态。
- 私信正文只按纯文本渲染，不解释 HTML。

### Follow-up Acceptance Criteria

- [x] R5：公共用户摘要使用 `GetUserSummary({ UserId })`，保持缓存、去重和严格 ID 校验。
- [x] R6：五个私信 Hub 方法、三种实时事件、会话/消息状态、发送重试、读回执和拉黑界面已实现。
- [x] 会话列表与聊天页面完成大标题、初始位置、键盘动画、输入框增长和最后气泡布局修复。
- [x] 私信入口保留在社区三个点菜单，显示未读角标；社区 tab 聚合通知和私信未读数。
- [x] 收到消息、自身已读和 SignalR 自动重连后重新同步服务端状态。
- [x] [self-verified] 简繁资源一致；现有自动检查通过，具体覆盖范围如下。
- [x] [user-accepted] 用户于 2026-10-04 确认整个任务完成并要求归档。

### 完成记录（2026-10-04）

- 当前分支为 `feat/direct-messages`，原名 `feat/sync-web-master-direct-messages`。Git reflog 记录了 2026-10-04 的改名。
- 原统一详情/评论/通知/锁定改动及公共资料 API 跟进已先行完成；原任务一直没有同步状态和 follow-up 清单。9 月的独立私信归档过早，已在该任务记录中更正完成日期和原因。
- 最后代码提交：`175f5a1`（私信布局/键盘）、`e381a0a`（通知全部已读）、`35aff9e`（头像尺寸）、`6329baf`（未读角标与实时刷新）。
- 本会话自动验证：workspace 类型/边界检查；API 37、client-core 47、community 25、localization 7、direct-message utilities 24 项测试通过。Swift 语法解析和 iOS JS export 通过，不能据此宣称已做原生应用构建或真实网络交互验证。
- 集中的私信自动测试覆盖未读字段、刷新顺序/失败、批量事件、重连刷新请求、滚动/键盘计算及本地化；不宣称五个私信 Hub 方法和所有状态 reducer 均有专门测试。旧记录对测试覆盖的笼统声明已改为实际证据。
- 交互完成依据为用户的整体完成确认；代理未操作模拟器，也没有把每个设备场景写成代理验证通过。
- 当前实现说明见 `.trellis/spec/backend/direct-message-contracts.md`。原始 9 月需求中的 `[COMMIT]` 是遗留脱敏占位符，不作为当前版本依据；本会话检查的 Web 参考为 `origin/master` `c53d0e829e7b9d3025167ed14cbb578e18d76907`。

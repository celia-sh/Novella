# 跟进 Web-Master 最新契约

## Goal

同步 Novella 与 `Web-Master reference snapshot 2c29426` 的最新漫画详情、评论、通知和社区线程管理契约，确保当前后端发布后，漫画详情/阅读/评论/通知跳转继续可用，并让有权限的用户能够锁定或解锁社区帖子。

## Background

参考仓库已从 `963eccf` 快进到 `2c29426`，包含两个提交：

- `01dbe9b feat: add thread lock action`
- `2c29426 refactor: unify book and manga detail pages`

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

- [ ] 最新 `GetBookInfo` fixture 可严格解码为统一 `BookDetail`，小说和漫画章节字段均正确。
- [ ] 漫画详情、阅读器、历史、搜索、发现、书架和通知入口均以作品 ID 工作，不再要求系列标题才能打开。
- [ ] 漫画评论请求不再包含 `Series` 或 `SeriesTitle`，现有评论分页、发布和回复测试通过。
- [ ] `open_book` 可正确打开小说和漫画，`open_series` 不再作为当前契约路径；无效 action 不会猜测目标。
- [ ] `SetCommunityThreadLocked` 请求参数、响应解码、client-core 校验和移动端 UI 均有测试覆盖。
- [ ] 有权限用户可锁定/解锁帖子；无权限用户不显示操作；服务端失败不会错误修改本地状态。
- [ ] `npm test --workspace @novella/api-client` 通过。
- [ ] `npm test --workspace @novella/client-core` 通过。
- [ ] 移动端相关测试、workspace typecheck、boundary check 和 `git diff --check` 通过。

## Out of Scope

- Web-only Quasar 页面布局和视觉样式迁移。
- 后端 API、部署、DNS、Cloudflare 或参考仓库修改。
- 阅读器 HTML 内容模型或全局 Markdown 存储迁移。
- 与本次两个远端提交无关的通知 envelope、商店、成长值和 public profile 改动。

## Technical Notes

- 当前 Novella 仍保留旧模型的证据位于 `packages/api-client/src/index.ts` 的漫画类型、详情 API、评论类型和 decoder，以及 `packages/client-core/src/index.ts` 的漫画详情/阅读接口。
- 当前通知旧系列路径位于 `apps/mobile/src/services/community-utils.ts` 与 `apps/mobile/src/screens/community-notifications-screen.tsx`。
- 当前社区线程已有 `locked` 读状态和互动拦截，新增 mutation 应沿用现有 `threadActionId` 互斥状态。

## Follow-up — `Web-Master reference snapshot 1e5a4e5`

参考仓库随后从 `2c29426` 更新到 `1e5a4e5`。移动端需要继续同步两项当前契约：

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

- [ ] 公共用户摘要只调用 `GetUserSummary({ UserId })`，不再请求旧 REST 路由。
- [ ] 五个私信 Hub 方法的参数、响应和三种实时事件均有契约测试。
- [ ] 会话和消息分页按稳定 ID 去重；收到响应/推送的先后顺序不会产生重复消息。
- [ ] 失败发送可使用相同 `ClientMessageId` 重试；同一会话连续发送保持顺序。
- [ ] 打开聊天并看到最新消息后上报已读，收到对方回执后更新最后一条已发送消息状态。
- [ ] 拉黑状态只采用服务端确认值，并正确禁用发送。
- [ ] 断线重连后重新加载会话与已打开聊天，未读数与服务端一致。
- [ ] 简体中文和台湾繁体中文资源结构一致。
- [ ] API、client-core、移动端测试、类型检查、边界检查及 `git diff --check` 通过。

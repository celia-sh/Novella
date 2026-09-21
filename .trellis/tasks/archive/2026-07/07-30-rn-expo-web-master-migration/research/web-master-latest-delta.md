# Web-Master 最新版本增量审计

## 版本与范围

- 参考仓库：`LightNovelShelf/Web`
- 更新命令：`git -C the Web-Master reference implementation fetch origin master && git -C the Web-Master reference implementation merge --ff-only origin/master`
- 本次刷新版本：`5505dd41bb91c45c791fe17b6ec2c092bb16b923` (`5505dd4`)，`2026-08-29 17:36:14 +08:00`
- 本次刷新前本地版本：`a8c317838ec7` (`a8c3178`)，`2026-08-20`
- 旧的完整书籍系统审计基线：`c919cd6e130479c5b9729e9c0b38f87aff13952f`
- 本文重点审计 `a8c3178..5505dd4`；旧基线到 `a8c3178` 的书籍、搜索、历史、漫画系列和阅读器结论继续保留在 `web-complete-book-system-reference.md`。

`the Web-Master reference implementation` 仍是本地、被 Git 忽略的研究 checkout，不是运行时依赖。本次快进后工作区干净，`HEAD` 与 `origin/master` 一致。

## 提交摘要

| 提交 | 变化 | 对 RN 的结论 |
| --- | --- | --- |
| `0f86a15` | 社区发帖独立路由；帖子草稿自动备份/恢复；帖子编辑、删除；回复/子回复删除；统一相对时间组件 | 需要跟进社区作者能力和草稿体验；相对时间属于呈现细节 |
| `eccda5c` | 商城、道具、补签卡、金币入口和金币流水；小说整本与漫画单话下载 | 新业务，当前 RN 没有对应协议、用例或界面 |
| `ac955d5` | 楼中楼分页增加 `AfterReplyId` 游标 | 需要更新 RN API 和加载逻辑，避免页码与动态插入造成重复/漏楼 |
| `7cb0b9c` | 通知跳转交给服务端以 `FocusReplyId` 定位，不再逐页扫描 | 需要更新 RN 通知深链与线程加载，避免无界请求 |
| `dbed727` | 漫画阅读器侧栏移到左侧并隐藏滚动条 | RN 不直接复制 CSS；检查原生章节/设置面板的遮挡和滚动体验 |
| `f6363c9` | HTML 清理器放行链接 `target`，自动补 `rel=noopener noreferrer` | Web 安全修复；RN 现有 `Linking` 打开 HTTPS 链接，保留独立校验 |
| `32a4573` | 新增 `ResetInviteCode`，个人资料可重置邀请码 | RN 缺失，属于账号能力补齐 |
| `4a8d837` | 编辑帖子改用 `GetCommunityThreadEditInfo`；编辑正文统一为 `Content`；补充 turndown 对照 fixture 工具 | RN 现有社区线程仍按 `bodyHtml` 解码，存在协议兼容风险 |
| `5505dd4` | 搜索、历史、设置的竖向布局增加 `no-wrap`，修复搜索结果被截断 | Web 布局修复；RN FlatList 不需搬运，但应做小屏截断回归 |

## 新增与改变的协议

### 社区

当前 Web 服务层新增或改变了这些调用（证据：
`the Web-Master reference implementation:40-135`）：

- `GetCommunityCatalog()`：独立获取发帖板块和子分类。
- `GetCommunityThread(..., FocusReplyId)`：服务端返回 `Focus`，由服务端把目标回复放进可定位窗口。
- `GetCommunityThreadEditInfo({ ThreadId, Format })`：只取编辑器需要的字段；`Content` 的格式由 `Format` 说明。
- `UpdateCommunityThread({ ThreadId, BoardKey, SubCategoryKey, Title, ContentHtml })`。
- `DeleteCommunityThread({ ThreadId })`。
- `DeleteCommunityReply({ ReplyId })`，返回被移除的回复数量 `Removed`。
- `GetCommunityReplyChildren(..., AfterReplyId)`：保留分页字段，同时支持以最后一条已加载回复作为游标。
- 社区默认排序从 `latest` 改为 `reply`。

响应模型也变化了（证据：
`the Web-Master reference implementation:87-176`）：

- 线程正文从 `BodyHtml` 改为 `Content`。
- 线程增加 `EditedAt`、`CanEdit`、`Focus`。
- 回复增加 `CanDelete`。
- 新增编辑信息和更新请求类型。

### 商城、金币与下载

新增商城协议（证据：
`the Web-Master reference implementation:7-28`、
`the Web-Master reference implementation:3-70`）：

- `GetShop()`：返回金币余额、商品价格、持有量、月购买上限和已购买量。
- `GetMyItems()`：返回当前持有道具。
- `BuyShopItem({ Key, Quantity })`：返回持有量、金币余额、消费金额和月购买量。
- `UseSignMakeupCard({ Date })`：日期按 UTC 的 `yyyy-MM-dd`，返回补签后的连续签到、奖励和剩余卡数。
- `GetCoinLog({ Page, Size })`：金币流水结构与积分流水一致。
- `Growth.Coin` 和 `SignIn` 响应增加金币相关字段。

下载不是 Hub 调用，而是带 Bearer token 的 HTTP 流（证据：
`the Web-Master reference implementation:109-178`、
`the Web-Master reference implementation:43-53`）：

- 小说整本：`GET /api/book/download?bid={bookId}`，导出 EPUB。
- 漫画单话：`GET /api/book/download_chapter?cid={chapterId}`，导出 CBZ。
- `Content-Disposition` 提供文件名；响应可能流式返回，只有存在 `Content-Length` 时才有确定进度。
- 非 2xx 仍返回统一错误模型；金币不足不能只依赖本地余额判断。
- 小说详情增加 `CanDownload`、`DownloadCost`；漫画章节增加 `DownloadCost`，漫画分卷增加 `CanDownload`（证据：
  `the Web-Master reference implementation:67-97`、
  `the Web-Master reference implementation:45-94`）。

### 账号

- `ResetInviteCode()` 返回新邀请码，旧邀请码立即失效（证据：
  `the Web-Master reference implementation:50-57`、
  `the Web-Master reference implementation:27-35`）。
- 个人资料提供显式重置按钮和确认弹窗（证据：
  `the Web-Master reference implementation:192-220`）。
- 邀请注册的流水文案增加“邀请注册”来源；注册请求本身仍是现有 `inviteCode` 字段。

## RN 对照

### 已经对齐或不需要直接搬运

- RN 已有社区默认 `reply` 排序，并在 `useCommunityHome` 中保持该默认值。
- RN 已有小说/漫画目录、漫画系列详情、双格式历史、搜索、基础社区浏览/发帖/回复/点赞，以及小说和漫画普通阅读器。
- RN 已保留漫画图片响应的兼容解码：当前 `decodeComicImage` 能接收最新的 URL 字符串，也能接收旧对象；最新 URL 中的占位图和尺寸元数据仍会被解析（证据：`packages/api-client/src/index.ts:2444-2482`）。这部分暂不需要重写，但必须用真实响应 fixture 覆盖。
- RN 的小说大屏双栏已通过原生阅读器偏好传递 `doublePage`（证据：`apps/mobile/src/screens/reader-screen.tsx:138-153,346-370`）。
- RN 已有漫画大屏自动双页和手机长图分段（证据：`apps/mobile/src/services/reader-display-layout.ts:49-150`），因此不需要重做基础双页算法。
- RN 社区正文链接已经通过 `Linking` 打开 HTTPS URL（证据：`apps/mobile/src/components/community/community-html-content.tsx:38-53`）；需保持不允许任意协议，不需要把 Web 的 `target` 属性复制到原生。
- Web 最近一次 `gap/no-wrap` 修复只针对 Quasar CSS 布局；RN 使用原生 `FlatList` 和固定网格，不应引入 Web 的 CSS 类名。

### 必须跟进

| 优先级 | 领域 | 当前 RN 状态 | 跟进内容与验收 |
| --- | --- | --- | --- |
| P0 | 社区正文协议 | `CommunityThreadDetail` 仍是 `bodyHtml`；decoder 读取 `BodyHtml`；线程加载未发送 `FocusReplyId`（证据：`packages/api-client/src/index.ts:671-729,1156-1171,1733-1753`） | 直接按当前后端契约切换为 `Content`，增加 `FocusReplyId` 请求和 `Focus` 解码；用 raw fixture 验证新响应。只有 App 需要连接仍返回 `BodyHtml` 的旧服务端时，才额外保留兼容读取，否则应让旧字段缺失在测试中暴露。社区详情必须能渲染正文，通知跳转不能退化为空白。 |
| P0 | 楼中楼加载 | RN 仍按页码继续拉取，且通知目标缺失时会逐页扫描（证据：`apps/mobile/src/hooks/use-community-thread.ts:123-190`） | `GetCommunityReplyChildren` 传 `afterReplyId`，线程通知直接带 `replyId` 请求服务端定位；仅在 fixture 证明旧服务端不支持时保留有界 fallback。验收：目标回复深度很大时请求次数有上限且无重复楼层。 |
| P1 | 社区编辑/删除 | RN 只有创建、回复、点赞和收藏；`CommunityUseCase` 没有更新/删除/编辑信息接口（证据：`packages/client-core/src/index.ts:201-218,882-958`） | API、client-core 和移动路由增加编辑信息、更新线程、删除线程、删除回复；详情显示 `CanEdit/CanDelete` 操作；403/404 分流；删除根回复时正确移除其子回复。 |
| P1 | 发帖草稿 | RN 发帖页有编辑器和首次发帖提示，但没有本地草稿自动保存/恢复（证据：`apps/mobile/src/screens/community-compose-screen.tsx:47-147`） | 用 `KeyValueStore` 保存新帖和每个编辑帖独立草稿；进入页面只询问一次恢复；发布成功清除；退出/切换目标不覆盖其他草稿。HTML 与纯文本校验继续保留 6/20 字符限制。 |
| P1 | 商城与道具 | RN 没有 Shop DTO、Hub 调用、use case、路由或界面；只有资料页金币余额和签到入口（证据：`apps/mobile/src/screens/profile-screen.tsx:48-68,157-170`） | 增加 `GetShop/GetMyItems/BuyShopItem/GetCoinLog/UseSignMakeupCard` 的 typed contract、错误/登录态、金币流水、商城入口、购买确认、月限额、补签日历和 UTC 日期测试。服务端余额是最终准则。 |
| 不跟进 | 下载 | RN 没有 EPUB/CBZ 下载业务；阅读器中的图片保存是另一条能力（证据：`apps/mobile/src/services/reader-image-actions.ts`） | 产品明确要求移动端不提供小说整本或漫画单话下载；不要增加下载 DTO、费用/权限字段、文件 adapter 或入口。 |
| P2 | 邀请码重置 | RN 可展示并复制邀请码，但没有 `ResetInviteCode` 和重置操作（证据：`apps/mobile/src/screens/profile-screen.tsx:143-152`） | 增加账号 use case、确认对话框、loading、成功后只更新本地 profile；旧码失效提示要明确。 |
| P2 | 漫画错位双页 | RN 大屏自动显示相邻双页，但没有 Web 的 `doubleOffset`（首页单页，随后 2+3、4+5）（证据：`apps/mobile/src/services/reader-display-layout.ts:55-118`） | 先确认产品要不要在 iPad 开放设置；若跟进，扩展可测试的显示 slot 算法、进度恢复、前进/后退、长图/宽图独占规则。 |
| P2 | 时间和布局细节 | RN 使用本地化的 `formatCommunityTime`，Web 改为全站共享 `TimeAgo`；Web 还统一了漫画/搜索/历史网格间距和漫画阅读器侧栏 | 不复制 Vue 组件；做一次 iOS 小屏/大屏视觉回归，确保相对时间随时间刷新、搜索和社区文本不截断、面板不遮住阅读内容。 |

## 建议实现顺序

1. **协议兼容与 fixture**：按当前契约将社区详情正文切换到 `Content`，补充 `Focus/FocusReplyId/AfterReplyId` 的完整 MessagePack 调用和 decoder 测试；只有确认需要兼容旧服务端时，才增加 `BodyHtml` 读取分支。
2. **社区可靠性**：接入服务端通知定位和楼中楼游标，再做帖子编辑/删除与草稿保存。这样不会在新协议上继续堆旧的逐页扫描逻辑。
3. **商城与账号**：商店入口放在个人资料的成长记录中并进入独立二级页；邀请码重置放在账号组第一项、退出上方。商品和金币不要写入阅读器、书架等无关领域。
4. **漫画错位双页与细节回归**：这是体验增强，排在协议和新业务之后，并用 iPad/手机设备验证。

## 约束与风险

- 以上商城、下载、社区编辑删除字段来自最新 Web-Master 代码，不等于已经获得后端稳定性承诺；实现前必须捕获成功、空数据、旧响应、401、403、404、402 和网络中断 fixture。
- 移动端下载是明确的产品非目标；Web 后续增加下载字段或费用规则时也不自动进入 App 跟进范围。
- `GetCommunityThreadEditInfo` 的 `Content` 是编辑器格式内容，不应直接与详情页正文的渲染字段混用，除非 fixture 证明两者格式一致。
- Web 的 Quasar/pnpm/oxlint/oxfmt 迁移、赞助入口、CSS `gap` 重构、全站 `TimeAgo` 组件、图片占位组件和编辑器滚动条是网站实现细节，不列入 RN 共享层。

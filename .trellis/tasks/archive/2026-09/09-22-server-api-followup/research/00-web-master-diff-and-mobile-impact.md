# Web-Master 参考版本差异与移动端影响

## 对比基线

- 参考仓库：`references/web-master`
- 远端：`[REFERENCE_REPOSITORY]`
- 更新前版本：`[COMMIT]`（2026-09-06，`Revert "refactor: move direct message action into the user card header"`）
- 最新版本：`[COMMIT]`（2026-09-21，`fix: 书架按类型筛选时递归过滤并隐藏空文件夹`）
- 差异范围：17 个提交、60 个文件，约 1640 行新增、1652 行删除。
- 参考仓库工作区已干净；本任务只读取参考仓库，不修改它。

## 提交范围分类

| 提交 | 变化 | 移动端/API判断 |
| --- | --- | --- |
| `[COMMIT]` | 私信已读后同步用户总未读数 | Web store 修正；私信 Hub 契约在基线前已存在。移动端对应工作已在 `09-06-sync-latest-web-master-contracts` 的私信 follow-up，不在本任务重复实现。 |
| `[COMMIT]` | 系列只有当前作品时隐藏系列按钮 | 移动端可选的详情页 UX 修正，无新 API。 |
| `[COMMIT]` | 社区已删除用户显示为“已注销”而非“被封禁” | 仅使用已有 `AuthorIsDeleted` 字段的文案修正。 |
| `[COMMIT]` | 书籍详情评论摘要 CSS 修正 | Web-only 样式。 |
| `[COMMIT]` | 编辑/发布页改为按书籍类型请求分类；漫画创建分类放宽为字符串 | `GetBookCategories({ Type })` 在基线前已存在；变化是 Web authoring 组合逻辑。当前移动端没有发布/书籍编辑调用路径，暂不纳入。 |
| `[COMMIT]` | Header 搜索复用到社区帖子，按标题/摘要搜索 | 新增 `CommunityListQuery.keyWords?`，请求向 `GetCommunityHome`/`GetCommunityFeed` 发送 `KeyWords`。这是记录中的 Web API 差异；本任务只审计，不在移动端或 API 生产代码中实现。 |
| `[COMMIT]` | Markdown 编辑器取消长链接折叠 | Web-only 编辑器行为。 |
| `[COMMIT]` | 通过新存储键把所有人的默认编辑器重置为 Markdown | Web-only 本地设置迁移。 |
| `[COMMIT]` | 统一 HTML/Markdown 编辑器容器高度 | Web-only 布局。 |
| `2633080` | 列表分页状态写入 URL，并增加分页/无限滚动设置 | Web composition/router 行为；服务端分页字段未改变。移动端已有自己的原生列表加载流程。 |
| `[COMMIT]` | 书架支持多层文件夹 | 主要是客户端树操作和页面行为；`parents` 字段本来存在，但移动端应确认递归移动、删除、封面统计语义。 |
| `[COMMIT]` | 系列页参数传递修正 | Web 生命周期/参数适配修正，无移动端 API 变化。 |
| `[COMMIT]` | `useInitRequest` 回调改为上下文对象 | Web 内部 composition API。 |
| `[COMMIT]` | 格式化 | 无行为/契约变化。 |
| `[COMMIT]` | 删除旧书架结构迁移 | 说明参考端已把新书架结构作为当前结构；移动端不能继续只接受旧 `BOOK` 类型。 |
| `[COMMIT]` | 书架支持漫画，条目类型改为 `NOVEL`/`COMIC` | 明确的破坏性书架契约变化，结构版本从 `20220211` 升为 `20260921`。 |
| `[COMMIT]` | 类型筛选时递归统计文件夹并隐藏空文件夹 | 新书架 UI 行为；如果移动端支持类型筛选，应按整棵文件夹子树统计。 |

## 已确认的 API 跟进项

### A. 必须更新：书架结构版本和条目类型

参考最新 `src/types/shelf.ts`：

- `SHELF_STRUCT_VER_LATEST = '20260921'`，旧值为 `'20220211'`。
- 文件夹仍为 `FOLDER`。
- 书籍条目由单一 `BOOK` 改为 `NOVEL | COMIC`，新增 `ShelfBookType`。
- `GetBookShelf` 仍返回 `{ data, ver? }`，`SaveBookShelf` 仍发送 `{ data, ver }`，但 data 中书籍的 `type` 和 `ver` 已变化。
- `updateAt`、`index`、`parents`、文件夹 `title` 的形状保持不变。

当前 Novella 证据：

- `packages/api-client/src/index.ts:171` 仍是 `SHELF_STRUCT_VERSION = '20220211'`。
- `packages/api-client/src/index.ts:286-305` 仍只声明 `BOOK | FOLDER`。
- `packages/api-client/src/index.ts:2766-2817` 的 decoder/encoder 只接受和发送 `BOOK`，收到 `NOVEL` 或 `COMIC` 会抛出无效类型错误。
- `packages/client-core/src/index.ts:1490-1610` 的书架 hydrate、投影、contains、toggle 全部以 `item.type === 'BOOK'` 判断；hydrate 也统一调用 `getBookListByIds`，没有按小说/漫画分流。
- `apps/mobile/src/screens/shelf-screen.tsx:100-106、420-435` 只把 `BOOK` 当作可展示书籍；漫画书架条目需要保留 `ShelfBookType`，并使用漫画列表/详情映射。

因此即使用户不选择“混合书架”视觉功能，API decoder 也至少要能读取当前服务端返回的数据，不能在收到 `NOVEL`/`COMIC` 时把整个书架判为错误。若纳入完整功能，client-core 还需：

1. 按条目类型批量 hydrate 小说和漫画；
2. toggle/add 时从详情的 `Novel`/`Comic` 类型写入对应 shelf type；
3. `ShelfItemKey` 从只支持 `BOOK:<id>` 改为能区分 `NOVEL` 和 `COMIC`，避免同 ID 跨类型冲突；
4. 保留文件夹、排序、移动、删除和失败重试的一致性。

### B. 记录但暂不实现：社区关键字查询字段

参考最新 `src/services/forum/types.ts` 与 `src/services/forum/community.ts`，Web 增加了可选 `CommunityListQuery.keyWords`，并将其映射为 `KeyWords` 请求字段。当前 Novella 的 `api-client` 和移动端没有该字段。

本任务只保留这项差异作为契约审计记录：用户已明确不做社区搜索 UI，也不在本任务扩展社区 API、query state、分页或请求调度。若未来产品决定支持社区搜索，另建独立任务并重新审阅字段映射、取消旧请求和分页行为；本任务的实现、验收和 diff 不应包含 `KeyWords` 生产代码。

### C. 条件项：作者/发布分类契约

最新参考端的 `getBookEditInfo` 在取得编辑信息后，再按 `data.Book.Type` 请求 `GetBookCategories`，并让漫画 `CategoryName` 接受任意服务端分类名。当前移动端没有发布页、书籍编辑页或对应 client-core use case，因此不应因为参考端的 Web authoring 变化扩张本任务；如未来移动端增加作者功能，再单独加入 `GetBookCategories`、`GetBookEditInfo` 和创建请求。

### D. 不作为本范围新增 API：私信未读数

`[COMMIT]` 只修正 Web 已有私信 store 在 `MarkDirectMessagesRead` 后更新 `GetMyInfo` 返回的 `UnreadDirectMessageCount`。这不是 `[COMMIT]..[COMMIT]` 新增的 Hub 方法或字段；Novella 的 `09-06-sync-latest-web-master-contracts` 已记录公共用户摘要和私信完整 follow-up，应保持任务边界分离。

## App 功能候选（等待用户选择）

1. **混合书架与类型筛选**：同步新版本书架，展示小说/漫画混合条目；按类型筛选时递归统计子文件夹、隐藏没有匹配内容的文件夹；书架漫画能进入统一漫画详情/阅读器。价值最高，但会触及 API、client-core、书架 UI、测试和本地化。
2. **社区搜索**：在社区页提供关键词输入（移动端没有 Web Header，可采用社区导航/列表搜索入口），调用 `KeyWords`，处理 query 切换取消旧请求、空结果和分页加载。需要 API 字段与移动端 UX 一起落地。
3. **低风险细节同步**：系列只有一个作品时隐藏系列入口；已注销用户使用与 Web 一致的状态文案。无新 API，适合独立小改动。
4. **Web-only 变化不迁移**：URL 分页、Quasar editor 高度/Markdown link folding、作者发布页分类加载、Web 路由改名不直接映射到 Expo 原生 App。

## 任务边界建议

- `09-22-server-api-followup` 负责本次最新参考差异中已批准的书架 `20260921` API/client-core 契约；社区 `KeyWords` 仅保留为研究记录，若未来实现需另建任务。
- `09-18-panelui-reader-improvements` 继续负责 PanelUI/reader UI，不把书架或社区搜索视觉迁移混入其中。
- `09-06-sync-latest-web-master-contracts` 继续负责 [COMMIT] 以前已确认的统一漫画详情、评论、通知、线程锁定、公共用户摘要和私信 follow-up。
- 参考仓库保持只读；不修改 Web-Master 或后端。

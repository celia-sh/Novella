# Migrate Web-Master shelf contract

## Goal

将 Novella 的 `api-client` 与 `client-core` 书架模型迁移到 Web-Master `cd1b4b7` 使用的 `20260921` 结构，使 Novel、Comic 和 Folder 可以被严格解码、类型化 hydrate、编辑和保存，并为移动端分离书架状态提供稳定边界。

## Background

参考仓库从 `1e5a4e5` 到 `cd1b4b7` 后：

- 书架版本从 `20220211` 变为 `20260921`。
- 书籍类型从单一 `BOOK` 变为 `NOVEL` / `COMIC`，文件夹仍为 `FOLDER`。
- `GetBookShelf` / `SaveBookShelf` 的外层 `{ data, ver }` 未变，但条目类型已改变。
- 当前 `packages/api-client/src/index.ts:171, 286-305, 2766-2817` 仍只接受 `BOOK`，收到最新 Comic 书架会失败。
- 当前 `packages/client-core/src/index.ts:1490-1610` 的 hydrate、membership、乐观保存和 toggle 全部写死 `BOOK`。

完整对比证据在父任务的 `research/00-web-master-diff-and-mobile-impact.md`；移动端分离展示的消费约束在兄弟任务的 `research/00-separated-shelf-state.md`。

## Requirements

### R1 — Normalize current and legacy wire types

- 暴露 `ShelfBookType = 'NOVEL' | 'COMIC'`，并把 `ShelfItem` 建模为 typed book 或 folder。
- `SHELF_STRUCT_VERSION` 的最新写入值为 `'20260921'`。
- `BOOK` 作为只读兼容别名归一为 `NOVEL`，覆盖旧版本、缺省版本和滚动升级期间即使携带 `20260921` 的响应；未知书籍类型仍以明确的 `ApiError` 拒绝，任何写入都不再发出 `BOOK`。
- 读取旧书架后保留其顺序、父路径、时间和文件夹；下一次保存使用最新版本与归一后的条目类型。
- 保持 null/空书架响应兼容和现有大小写字段兼容，不改变错误分类。

### R2 — Make client-core shelf operations type-aware

- `ShelfSnapshot`、`ShelfDraft`、typed key、membership 和保存投影不能只比较数值 ID或 `BOOK`。
- hydrate 必须保留 Novel/Comic 的 shelf type，并将卡片结果与类型化 shelf 条目稳定关联；未解析到卡片时不得删除原 shelf item。
- `contains` / `toggleBook` 使用包含媒体类型的引用；保存时新条目必须写入调用方指定的 Novel 或 Comic。
- 文件夹创建、重命名、移动、删除、提升子项、兄弟重排和 optimistic save 对两种书籍类型采用相同的结构规则，但不得改变媒体类型。
- 如果数值 ID在两种类型中重复，selection、map、remove、move、reorder 和 save confirmation 仍不能碰撞。
- 保持现有保存串行化、失败屏障、重试和旧响应保护行为。

### R3 — Keep API boundary independent of presentation

- 不添加混合/类型筛选服务端接口，不在 API client 中引入 UI tab 或持久化偏好。
- 不实现社区关键词搜索、Web authoring API 或与 `09-06`/`09-18` 重叠的工作。
- 为兄弟移动端任务提供清晰的类型化 public API，而不是让 screen 直接调用 transport。

## Acceptance Criteria

- [ ] API fixture 含 `NOVEL`、`COMIC`、`FOLDER` 时可严格解码；旧 `BOOK` fixture 按明确规则归一为 Novel。
- [ ] `SaveBookShelf` 使用 `ver: '20260921'`，且 Novel/Comic/Folder 字段和顺序完整保留。
- [ ] 混合书架 hydrate 能获得两种类型的卡片；缺失卡片不会删除 shelf item。
- [ ] typed keys 能区分 `NOVEL:<id>`、`COMIC:<id>` 和 `FOLDER:<id>`；文件夹编辑测试覆盖两种书籍类型。
- [ ] contains/toggle/save 的测试覆盖媒体类型、同 ID 防碰撞、乐观保存、旧响应保护、失败重试。
- [ ] `npm test --workspace @novella/api-client`、`npm test --workspace @novella/client-core` 和 workspace typecheck 通过。
- [ ] 无 API 生产代码包含社区 `KeyWords` 搜索或混合 All 书架逻辑。

## Out of Scope

- 移动端书架两个 tab、路由 query、空状态视觉和本地化；由 `09-22-mobile-shelf-separated-state` 负责。
- Web-Master 参考仓库和后端修改。
- 社区关键词搜索、作者发布分类、URL 分页、编辑器和私信 UI。

## Dependency

`09-22-mobile-shelf-separated-state` 必须在本任务的 normalized `ShelfItem`、typed key 和 `ShelfUseCase` 接口稳定后再开始实现；若接口变更，需先更新兄弟任务设计和 manifests，再进入其执行阶段。

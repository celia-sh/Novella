# Separate mobile shelf media states

## Goal

将移动端书架改为与历史记录一致的 Novel / Comic 分离状态，避免混合书架价值低的问题，同时保留一个完整服务端书架树的文件夹、编辑、导航、保存、错误恢复和本地化行为。

## Background and constraints

- Web-Master 最新书架协议由 `BOOK/20220211` 改为 `NOVEL`、`COMIC`、`FOLDER/20260921`。
- `09-22-shelf-contract-migration` 负责 API/client-core 归一化；本任务只消费其类型化 `ShelfSnapshot` / `ShelfUseCase`，不在 screen 里重复解码或迁移协议。
- 历史记录已经提供可复用的产品先例：`apps/mobile/src/screens/history-screen.tsx` 使用两个 segment，默认 Novel，并按类型提供空状态和详情路由。
- 当前书架浏览只有一个混合列表；当前编辑/重排接口依赖完整兄弟集合，不能直接对过滤列表写回 index。

## Requirements

### R1 — Two separate browse states

- 提供 Novel / Comic 两个状态，默认 Novel，使用与历史记录一致的原生 segmented control 和本地化标签。
- 不提供混合 All 状态，不建立两个持久化书架、两个 repository 或两个保存队列。
- 状态只作为完整 `ShelfSnapshot` 的浏览投影；切换状态不得重新请求、重新保存或修改服务端顺序。

### R2 — Type-aware folder projection

- 浏览态只显示当前类型的书籍。
- 文件夹只有在整棵子树中包含当前类型书籍时才显示。
- 文件夹数量、封面预览、子文件夹统计都必须使用同一类型过滤结果，不能混用总数。
- 递归规则在根目录和深层文件夹一致；无匹配项时显示类型正确的空状态。
- 使用 `ShelfItem.type` 作为过滤权威来源，即使卡片 hydrate 失败，也不能把匹配的 shelf item 删除或归类到另一类型。

### R3 — Preserve full-tree edit behavior

- 进入编辑态时隐藏或禁用 Novel/Comic 切换，并显示当前路径下完整未筛选的兄弟列表。
- 选择、重排、移动、删除、新建文件夹、重命名、删除文件夹、optimistic save 和失败重试继续作用于完整 typed tree。
- 过滤列表不能参与 sibling reorder，不能因为当前 tab 而保存时丢掉另一类型或未解析卡片。
- 退出编辑态不得丢弃已提交的乐观变更或待重试保存。

### R4 — Preserve navigation and state

- 打开文件夹时携带当前 Novel/Comic 状态；多层导航、返回和深链都有确定的状态恢复行为。
- 缺省或非法状态默认 Novel。
- 继续使用现有 `/book/[id]` 路由和正确的 Novel/Comic detail 参数；Comic 不得被当作 Novel 打开。
- 保持现有文件夹 breadcrumb、action sheet、加载/刷新/错误/重试和不可用书籍行为。

### R5 — Localization and accessibility

- 简体中文和台湾繁体中文资源结构保持一致。
- 书架根目录、文件夹和类型空状态使用本地化文案，不在 JSX 中硬编码媒体名称。
- 保留并补齐 segmented control、重试、文件夹、删除、移动和不可用书籍的 accessibility labels。

### R6 — Complete typed membership flow

Comic 状态必须形成完整闭环：Comic 详情显示类型化的加入/移出书架操作，`contains` / `toggleBook` 传入 Comic 类型；Novel 继续使用 Novel 类型。当前 `book-detail-screen.tsx` 会隐藏 Comic 的 shelf button，需要移除该限制并保留现有 loading、错误和重试语义。

## Acceptance Criteria

- [ ] 书架默认 Novel，切换 Comic 后只显示 Comic 条目；不存在混合 All 视图。
- [ ] 混合 fixture 下，文件夹的可见性、数量、封面预览和子文件夹统计按当前类型递归计算。
- [ ] 切换 tab 不触发新的书架请求、hydrate、保存或 index 变更。
- [ ] 打开深层文件夹、返回和深链均保留类型状态；非法/缺省状态默认 Novel。
- [ ] 编辑态显示完整兄弟列表，重排/移动/删除/文件夹操作不会丢失未选中的媒体类型或未解析条目。
- [ ] Novel/Comic 卡片使用正确 detail ID、type、cover placeholder 和 Comic series title。
- [ ] 根目录和文件夹空状态、错误、重试、可访问性文案在简体中文和台湾繁体中文完整。
- [ ] Comic detail 的加入/移出书架、typed membership 和错误重试有测试；Novel 行为保持兼容。
- [ ] 移动端 shelf、client-core、api-client 测试和 typecheck 通过，且 `git diff --check` 通过。

## Out of Scope

- 混合 All 视图、跨类型排序、全新书架卡片设计或持久化 tab 偏好。
- 社区关键词搜索和任何 Web-only 分页/编辑器/作者发布功能。
- 重新设计历史记录；这里只复用它的分离态交互先例。
- 在本任务内重复实现 API decoder、旧 `BOOK` 迁移或 transport 调用。

## Dependency

本任务依赖 `09-22-shelf-contract-migration` 先稳定 normalized shelf model 和 typed membership API。Comic detail 的加入/移出书架属于本任务的完整闭环范围。

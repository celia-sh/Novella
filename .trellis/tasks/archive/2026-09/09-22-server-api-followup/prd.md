# 跟进 Web-Master 最新参考契约

## Goal

以 `references/web-master` 为只读参考源，将其从 `[COMMIT]` 更新到 `[COMMIT]` 后，对 Novella 需要跟进的书架 API 契约和移动端书架体验建立可执行任务树。

用户已明确：

- 不做 Web-Master 的社区关键词搜索，价值不足。
- 不做小说/漫画混合书架展示；移动端按历史记录的方式分为 Novel / Comic 两个状态。
- 其余与移动端实际数据契约相关的 API 变化继续跟进。

本父任务负责范围、依赖和最终集成验收；独立实现分别由子任务负责。

## Comparison baseline

- 参考仓库：`references/web-master`
- 更新前：`[COMMIT]`（2026-09-06）
- 最新：`[COMMIT]`（2026-09-21）
- 差异：17 个提交、60 个文件，约 1640 行新增、1652 行删除。
- 完整提交分类和移动端证据记录在 `research/00-web-master-diff-and-mobile-impact.md`。

## Confirmed scope

### In scope

1. **书架 API/client-core 契约**
   - 从旧 `BOOK`/`20220211` 迁移到 `NOVEL`、`COMIC`、`FOLDER`/`20260921`。
   - 保持旧本地书架可读，读取旧 `BOOK` 时按明确迁移规则归一为 Novel；下一次写入使用最新版本。
   - client-core 的 hydrate、membership、typed identity、文件夹编辑、保存投影和重试都不能丢失漫画或小说。

2. **移动端书架分离状态**
   - 采用与历史记录相同的两项切换：Novel / Comic，默认 Novel。
   - 不提供混合的 All 视图。
   - 浏览态按条目类型筛选，并递归隐藏没有当前类型内容的文件夹；编辑态显示完整未筛选树，避免错误重排或保存丢失另一类型。
   - 保留现有文件夹导航、编辑、移动、删除、重试、可访问性和中英文资源结构。

3. **父任务集成**
   - API 子任务完成后，移动端子任务消费其类型化模型，不在 screen 内重复实现协议迁移。
   - 最终检查跨 `api-client → client-core → mobile hook/screen` 的读写数据流。

### Explicitly excluded

- 社区关键词搜索 UI、query state、分页、请求调度，以及任何 `KeyWords` 生产代码变更；该差异只保留在研究中审计，不由本任务实现。
- Web-only URL 分页、Quasar 编辑器、作者发布页分类加载、Web 路由和样式变化。
- `09-06` 已负责的统一漫画详情、评论、通知、公共用户摘要和完整私信迁移。
- `09-18` 的 PanelUI、reader 和媒体预览工作。
- 混合 All 书架、第二份持久化书架、两个独立 repository 或独立保存队列。

## Task tree

- `09-22-shelf-contract-migration`
  - 负责 `packages/api-client` 与 `packages/client-core` 的最新书架契约、兼容归一化、类型化 membership 和测试。
- `09-22-mobile-shelf-separated-state`
  - 依赖 API 子任务的公共类型和 client-core 接口；负责移动端 Novel/Comic 分离浏览态、路由状态、编辑态投影、本地化和测试。

依赖顺序写入两个子任务的 `design.md` / `implement.md`；任务树本身不作为隐含依赖。

## Acceptance Criteria

- [ ] 两个子任务均完成 PRD、technical design、implementation plan 和真实的 context manifests，并在实现前通过最终规划审查。
- [ ] API 子任务能解码 `NOVEL`、`COMIC`、`FOLDER` 和旧 `BOOK` 归一化数据；保存时使用 `ver: '20260921'`，不丢失任何类型或文件夹。
- [ ] client-core 的书架 membership、typed keys、hydrate、文件夹操作、乐观保存和失败重试有混合类型测试。
- [ ] 移动端默认显示 Novel，能够切换 Comic；不存在混合 All 视图。
- [ ] 浏览态的文件夹、数量、封面预览按当前类型递归计算；编辑态展示完整树并能安全重排、移动、删除和保存。
- [ ] 打开深层文件夹后仍保留 Novel/Comic 状态；无效或缺省状态有确定的默认值。
- [ ] 简体中文与台湾繁体中文资源结构一致，新增空状态和可访问性文案完整。
- [ ] API/client-core/mobile 类型检查、相关测试、边界检查和 `git diff --check` 通过。
- [ ] 社区搜索、Web-only 变化和其他平行任务没有被意外纳入 diff。

## Risks and deferred decisions

- Comic detail 的加入/移出书架已确定纳入移动端子任务；它依赖 API 子任务提供类型化 membership，不得保留只传数值 ID的调用。
- 若服务端保证全局唯一书籍 ID，可简化部分映射；规划仍按类型化 key 设计，避免客户端把 Novel/Comic 当作同一条目。
- `GetBookCategories` 等 Web 作者功能没有移动端调用路径，不因“其余 API 跟进”而添加 speculative endpoint。

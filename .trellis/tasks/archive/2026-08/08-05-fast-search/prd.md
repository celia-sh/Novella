# 接入类似 Flutter 的详情页快速搜索

## Goal

将 Flutter 版本的书籍详情页快速搜索能力迁移到 RN/Expo：用户可以直接点击详情页 Hero 中的书名、作者（以及已有标签入口中的标签）进入现有搜索页，并使用对应的搜索模式；系列名使用可持久化的偏好设置选择系统、原文或展示语言。

## Confirmed facts

- 用户确认：功能位于书籍详情页，且搜索方式允许在设置中切换；参考项目是 `the archived Flutter implementation`，目标项目是 `apps/mobile`。
- Flutter 的详情页实现位于 `the archived Flutter implementation:283-300,1324-1362,1994-2151`：
  - 书名和非空作者是可点击的搜索目标。
  - 有系列分类时，书名点击使用系列名并进入 `name` 模式；无系列名时使用书名并进入 `fuzzy` 模式。
  - 作者点击使用 `author` 模式。
  - 搜索页通过初始关键词和模式打开。
- Flutter 的系列名偏好位于 `the archived Flutter implementation:21,142,401-403,542-543,787-790`，内容设置入口位于 `the archived Flutter implementation:164-197`：`system`、`original`、`display` 三种模式，默认 `system`，并持久化。
- Flutter 的系列名选择规则位于 `book_detail_page.dart:283-300`：原文/展示名缺失时互相回退；系统模式只在日文原版分类且有原文系列名时优先原文，否则优先展示名。
- Flutter 的详情标签 Sheet 选择标签后以 `tags` 模式进入搜索（`book_detail_page.dart:2579-2601`）；RN 目前已有标签 Sheet，但标签尚未成为搜索入口。
- RN 现有搜索路由 `apps/mobile/src/app/(tabs)/(search)/search.tsx` 已接受 `query`、`mode`、`format`，`useBookSearch` 已支持六种模式；因此本需求不新增搜索 API 或搜索页。
- RN 的 `BookDetail` 已由 `packages/api-client/src/index.ts:328-345,1994-2022` 解码分类信息（原文 `classification.seriesName`、展示名 `classification.seriesNameCn`、分类 `category.name/shortName`），可完成 Flutter 规则所需的解析。
- RN 设置由 `apps/mobile/src/services/settings.ts` 的 `AppSettings` + Expo 本地存储管理，内容设置页面为 `apps/mobile/src/screens/settings/content-settings-screen.tsx`。
- 用户确认按完整 parity 实现：标签可点击进入 `tags` 搜索；漫画详情快速搜索进入漫画搜索，小说详情进入小说搜索。
- 用户实测发现首屏体验问题：点击后导航过程中有停顿，搜索页先显示无结果/空状态，随后才进入骨架屏并显示结果；期望像 Flutter 一样在进入搜索后立即显示加载态。详情页已经持有系列信息，不应为此额外等待或重复请求。

## Requirements

### R1. 详情页书名/作者快速搜索

- 在 RN 详情页 Hero 的书名和非空作者上提供可访问的按钮/触摸目标；iOS 内嵌 Hero 和 Android 可折叠 Hero 都必须保持该交互。
- 书名点击：按 R2 解析系列关键词；有有效系列关键词时以 `name` 模式搜索，否则以书名执行 `fuzzy` 搜索。
- 作者点击：以作者文本执行 `author` 搜索。
- 点击后复用现有搜索页，并传递 `query` 与 `mode`；RN 详情页为漫画时同时传递 `format=Comic`，小说保持 `format=Novel`，避免跨格式搜索。
- 空书名、空作者、空系列名不产生空搜索请求；保留现有文本显示和布局。

### R2. 系列名解析设置

- 增加 `SeriesSearchMode = 'system' | 'original' | 'display'`（或等价命名）到 RN 本地设置，默认 `system`。
- 在内容设置中增加“系列搜索”选择行，提供“系统 / 日文 / 中文”三个选项，实时更新并持久化；非法或旧值回退到 `system`。
- 系列名选择规则与 Flutter 一致：
  - `original`：优先原文系列名，缺失时展示名；
  - `display`：优先展示名，缺失时原文；
  - `system`：当分类名称为“日文原版”或短名为“日文 / 日原 / 日文原版”且有原文系列名时使用原文，否则优先展示名，再回退原文。
- 设置改变后，已挂载详情页按新设置重新渲染并立即影响下一次点击；无需重新请求详情数据。

### R3. 标签快速搜索（Flutter 详情页 parity）

- RN 现有详情标签 Sheet 中的标签改为可访问的触摸目标；点击标签关闭 Sheet 并打开对应格式的搜索页，使用 `tags` 模式。
- 标签为空时不显示标签入口（沿用现有行为）；空标签不触发搜索。

### R4. 可靠性与复用

- 快速搜索只负责导航和参数组装，不在屏幕中解析原始 API/存储 payload；系列名解析放在无 UI 的纯函数/服务层并可单测。
- 搜索目标文本应 trim；导航参数应使用现有 Expo Router 类型和搜索页的模式白名单。
- 不改变现有搜索历史、分页、取消请求、内容过滤或搜索 UI 行为。

### R5. 搜索跳转与首屏加载体验

- 详情页快速搜索使用根 Stack 的轻量 `/quick-search` 路由，不通过 `/(tabs)/(search)/search` 再挂载一棵 NativeTabs 树；普通 Search tab 仍保留原路由。
- 详情页已解析出的系列/作者/标签关键词随路由参数直接传入搜索页；进入搜索页不得重新等待详情数据或重新解析系列信息。
- 路由带有初始查询时，搜索页首个可见状态必须是骨架屏/加载态，不得先渲染“无搜索结果”或普通空状态。
- 搜索请求不得等待本地搜索历史写入完成；历史写入可异步排队，但交互搜索必须立即进入 `loading` 并发起网络请求。
- 搜索失败仍显示明确错误状态；真实无结果仅在请求完成后显示。

## Acceptance Criteria

- [x] [self-verified] 小说详情页点击书名：有系列名时进入搜索页并带 `mode=name` 与解析后的关键词；无系列名时带 `mode=fuzzy` 与书名。证据：`book-quick-search.test.mjs`、iOS/Android Expo bundle。
- [x] [self-verified] 小说详情页点击作者进入搜索页并带 `mode=author`；空作者不可点击。证据：`book-quick-search.test.mjs` 与 mobile typecheck。
- [x] [self-verified] 漫画详情页快速搜索传递 `format=Comic`，不会误打开小说结果；标签以 `mode=tags` 搜索。证据：route-param 单测、mobile typecheck 和双平台 bundle。
- [x] [self-verified] “系列搜索”设置包含系统/日文/中文三项，默认系统，修改后持久化；非法持久化值恢复为系统。证据：设置存储接线、`decodeSeriesSearchMode` 单测和 workspace typecheck。
- [x] [self-verified] 系列名解析覆盖原文优先、展示名优先、日文原版系统判断、缺失回退和空白输入边界，并有纯函数测试。证据：`book-quick-search.test.mjs` 7 项通过。
- [x] [self-verified] 现有搜索页六种模式、历史、分页和取消请求行为未被破坏；工作区边界检查与 TypeScript 检查通过。证据：`npm run check`、`npm run test:client`。
- [x] [self-verified] 初始查询进入搜索页时不显示错误空状态；历史写入不阻塞搜索 loading。证据：初始 pending/loading 分支、同步搜索历史投影、搜索历史工具单测和 iOS/Android Expo bundle。
- [ ] [user-verified] 在 iOS 和 Android 真机/模拟器上从详情页点击书名、作者、标签，确认触摸反馈、返回栈和搜索结果格式符合预期。

## Out of scope

- 不新增后端搜索接口、DTO 或搜索 API；现有客户端搜索契约已足够。
- 不重做搜索页的输入框、历史、分页、筛选和结果卡片 UI；本任务只修正初始查询的 loading/空状态时序。
- 不将设置同步到云端；RN 设置遵循现有设备本地存储策略。
- 不扩展 Flutter 未覆盖的书籍字段搜索（分类、上传者等）。

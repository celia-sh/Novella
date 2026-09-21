# 集成 Readium 原生小说阅读器

## Goal

将 Novella 当前基于 WebView 的小说章节阅读器替换为 Readium Swift/Kotlin 驱动的原生阅读器，减少分页、滚动、字体、阅读偏好和脚注等基础能力的自维护，同时保持 Novella 现有书籍 API、阅读设置和轻书架阅读位置协议可用。

正式实现必须是 Novella 自有代码，只依赖 Readium 官方组件和 Novella 现有业务代码。任何本地参考项目仅限研究阶段，不能成为正式代码、注释、文档、测试、文件名、提交信息、许可证声明或用户界面的内容来源或文字内容。

## Confirmed Background

- 移动端当前小说阅读器使用 `react-native-webview` 和自建 XHTML/CSS 阅读逻辑。
- 章节内容契约包含 `id`、`bookId`、`title`、`content`、`fontUrl`、`sortNum`、`chapterTitles`。
- 轻书架后端位置契约为 `SaveReadPosition { bookId, chapterId, position }`，其中 `position` 仍是 Novella 现有 block/XPath locator。
- 当前阅读设置至少包含字号、行高、左右边距、首行缩进、分页/滚动、分页动画、图片长按预览和章节预加载窗口。
- 每本书可能有独立动态字体。字体没有成功加载前，不得向用户显示使用该字体编码的正文。
- Expo 57 / React Native 0.86 的 Android 构建链必须保持可用；Readium native 版本不能要求升级到 Expo 不支持的 Kotlin/Gradle/AGP 基线。

## Requirements

### R1. 统一跨平台 API

提供一个 Novella 自有 Expo local module，对 React/TypeScript 暴露统一的阅读器 View、命令和事件契约。业务层不得出现 `Platform.OS`、Swift/Kotlin 类型、Readium 平台专属生命周期或原生导航容器概念。

本任务只替换正文内容渲染层，不重做阅读页面 UI。现有顶部/底部工具栏、章节选择、脚注面板、图片预览、主题和进度业务逻辑继续复用。

统一契约至少覆盖：打开 publication、初始 Locator、阅读偏好、Locator 变更、准备完成、错误、脚注/链接事件、跳转、前进、后退、偏好更新和销毁。

### R2. Native 平台封装

iOS 和 Android 分别在 native module 内封装 Readium 官方 toolkit。publication 打开、navigator 生命周期、Locator、偏好映射、字体声明、链接/脚注回调和资源生命周期不得泄漏到 React 业务页面。

### R3. 章节 API 到 publication

将 Novella 章节内容转换为 Readium 可读取的本地 publication 资源。章节 href 必须以稳定的 `chapterId` 为基础，例如 `chapters/{chapterId}.xhtml`，不能以易变的 `sortNum` 作为稳定身份。

publication 必须能够生成 OPF、spine、导航、章节 XHTML、样式和当前书籍字体资源；章节内容必须继续遵守现有清理、脚注和 HTML 处理规则。

资源必须支持渐进式加载：打开阅读器时只等待 publication 元数据/导航、目标章节 XHTML 和显示正文所必需的字体完成；不能因为其他章节、非当前视口图片或整本书资源尚未下载而阻塞首屏显示。图片应由 publication/native resource 层按内容需要加载，并允许失败而不阻塞正文，除非该图片是当前内容布局不可缺少的资源。

章节获取、认证、缓存和预加载由 TypeScript/现有 API 层负责；Swift/Kotlin 不得各自实现 Novella 的业务 API 请求。

### R4. 动态字体安全

优先使用现有 WOFF2 缓存，不恢复未经证实的 WOFF2 到 TTF 转换。publication 内的字体必须通过有效的 OPF media type 和相对路径 `@font-face` 引用。

字体加载失败、字体资源缺失或字体尚未准备完成时，阅读器必须保持阻塞/加载状态，不能显示可能乱码的正文。

### R5. 阅读位置互通

后端仍以 `chapterId + Novella block/XPath position` 作为 canonical 格式。Readium 完整 Locator 只能作为 native 与 JS 之间的边界格式，不得直接替换后端位置协议。

必须实现：

- 后端位置到章节 href 和 Readium Locator 的恢复。
- Readium Locator 到 `chapterId + canonical block locator` 的保存。
- 章节切换、字体加载、偏好变更和重新打开后位置仍可恢复。
- 继续兼容现有进度暂存、批量/延迟同步和 `SaveReadPosition` 流程。

### R6. 阅读设置

将现有阅读设置统一规范化后映射到 Readium preferences，至少覆盖字号、行高、边距、首行缩进、分页/滚动、分页动画、主题颜色和预加载行为。无法一比一映射的设置必须在设计文档中明确降级行为，而不是静默丢弃。

现有 `readerPreloadWindow` 必须继续生效：它控制当前章节之后预取的章节数量，范围和上限沿用现有设置/服务约束；预加载是后台优化，不能阻塞当前章节首次显示，也不能让活动阅读请求等待预加载队列完成。章节正文预取和图片预取必须分离，图片预取失败不能使章节预取失败。

### R7. 脚注和链接

验证并实现当前章节内容需要的脚注/链接交互。脚注行为不能因为 Readium 平台差异而在 React 层分叉；native 事件应转换为统一 JS 事件。若某个平台能力有限，必须提供明确、可测试的 fallback。

### R8. 版本与构建兼容性

Android 优先使用与 Expo 57 构建链兼容的最高稳定 Readium Kotlin 版本，并通过 Maven 依赖接入，不将 Readium 源码作为宿主工程的 Gradle composite build。iOS 使用与当前 deployment target 和 Expo 57 CocoaPods 构建链兼容的稳定 Readium Swift 版本。

版本、Kotlin/Gradle/AGP、compile SDK、iOS deployment target 和依赖模块选择必须记录在设计文档中，并通过实际构建验证。

## Acceptance Criteria

- [ ] React/TypeScript 侧只有一个 Novella 自有跨平台阅读器 API，业务阅读页面不包含平台分支或 native 实现细节。
- [ ] 现有阅读页面 UI、工具栏、章节选择、脚注面板、图片预览和进度业务逻辑继续复用；本任务没有复制一套新的阅读页面 UI。
- [ ] iOS 和 Android 都能构建并打开同一份 Novella 本地 publication。
- [ ] publication 使用稳定 chapter ID href，章节标题、正文顺序和现有内容清理规则正确。
- [ ] 用户无需等待整本书章节、图片或其他非当前视口资源完成下载即可看到当前章节正文。
- [ ] 当前章节正文显示后，后续章节和图片可以在后台渐进式加载；非关键图片失败不会阻塞正文。
- [ ] 每本书的动态 WOFF2 字体能正确加载；字体未完成或失败时不会显示乱码正文。
- [ ] 现有后端阅读位置可恢复，阅读器位置变化能转换回既有 `SaveReadPosition` 契约。
- [ ] 阅读位置在章节切换、重新打开、字体完成加载和阅读设置变化后仍然可恢复。
- [ ] 现有阅读设置逐项映射或有明确 fallback，并通过测试验证核心设置。
- [ ] `readerPreloadWindow = 0` 时不预取后续章节；设置为正数时只按该窗口后台预取，且活动阅读请求不等待预加载完成。
- [ ] 章节正文预取与图片预取相互隔离，图片预取失败不会取消正文或后续章节预取。
- [ ] 脚注/链接事件在 iOS 和 Android 都通过统一 JS 事件契约处理，或具备记录在案的可测试 fallback。
- [ ] Android 依赖不会要求 Expo 57 不支持的 Kotlin/Gradle/AGP 基线；iOS 依赖符合当前 deployment target。
- [ ] 相关单元测试、类型检查、lint 和 iOS/Android 原生构建验证通过。
- [ ] 正式新增或修改的代码、注释、文档、测试、文件名和提交信息不包含任何本地参考项目名称、来源描述或复制痕迹。

## Out Of Scope

- 修改轻书架后端 `SaveReadPosition` 数据结构。
- 将 Readium Locator 直接持久化为后端协议。
- 在 Swift/Kotlin 内复制 Novella 的 SignalR、MessagePack、认证或章节业务请求逻辑。
- 恢复 WOFF2 到 TTF 的转换，除非实际平台构建/运行验证证明 WOFF2 路径不可行，并另行记录决策。
- 为了使用更高 Readium 版本而升级 Expo SDK、React Native、AGP、Gradle 或 Kotlin 主版本。
- 在本任务中重构漫画阅读器。

## Planning Notes

这是复杂任务。开始实现前必须补充 `design.md` 和 `implement.md`，完成版本、publication 资源模型、Locator 双向映射、设置映射、字体阻塞和脚注 fallback 的设计，并在用户确认规划后再执行 `task.py start`。

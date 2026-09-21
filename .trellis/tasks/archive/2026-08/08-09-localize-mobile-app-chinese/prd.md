# 移动端简繁中文本地化

## Goal

让 Novella 移动应用的第一方界面同时支持简体中文和繁体中文（台湾用语），移除第一方英文界面文案，并允许用户跟随系统或在应用内即时切换语言。书籍、章节、评论等服务端内容按原始数据展示，不属于应用界面翻译范围。

## Confirmed Background

- 当前移动端没有 i18n 依赖、locale resolver、翻译资源或持久化语言设置。
- 初步静态审计在 `apps/mobile/src` 的 62 个文件中识别出约 326 行第一方英文 UI 候选，覆盖认证、五个主标签页、书籍/漫画、阅读器、社区、设置和共享组件。
- `AppSettings` 已有设备本地持久化边界，根布局在首帧路由决策前等待 `loadAppSettings()`，可以避免已保存语言偏好产生错误语言闪烁。
- 根导航、原生 tabs、原生 Compose/SwiftUI 控件、alerts、空态/错误态和无障碍标签都有硬编码英文。
- `app.config.ts` 的照片保存权限文案以及生成后的 iOS `Info.plist` 目前是英文；iOS 没有 `.lproj` 本地化资源，Android 只有默认 `values/strings.xml`。
- 多处相对时间和数字格式化直接使用英文或设备默认 locale，且部分 hooks/screens 会把服务、Readium 或第三方库的 `Error.message` 直接显示到界面。
- Expo SDK 57 对应 `expo-localization ~57.0.1`，支持 `getLocales`/`useLocales`、config plugin `supportedLocales` 和 app config `locales` 原生元数据翻译。

## Requirements

### R1. Language Set And Selection

- 提供 `跟随系统`、`简体中文`、`繁體中文` 三个应用语言选项。
- 语言偏好持久化到现有 `AppSettings`；旧设置缺少该字段时迁移为 `跟随系统`。
- `跟随系统` 时，系统 locale 的 script 为 `Hant`，或地区为 `TW`、`HK`、`MO` 时使用繁体资源；其他任何 locale（包括英文和未知 locale）都使用简体资源。
- 应用内切换语言立即更新当前页面、导航标题、tabs、原生控件和 alerts，无需重启。
- Android 在应用回到前台时重新读取系统 locale；iOS 遵循系统重启应用后的 locale 结果。

### R2. Translation Resources

- 仅维护简体中文 `zh-CN` 和繁体中文 `zh-TW` 两套第一方资源；简体是缺失/未知 locale 的唯一 fallback，不新增英文资源。
- 繁体资源使用自然台湾书面语和术语，而不是仅做字符级简转繁。
- 翻译 key 必须具备 TypeScript 类型约束；两套资源必须 key 对称，并支持变量插值。
- `Novella`、`GitHub`、`UID`、`AI`、`OLED` 等品牌或技术专名可保留拉丁字符，不视为英文界面回退。

### R3. Complete First-Party Surface

迁移所有第一方用户界面文案，包括：

- Expo Router 根 stack、tabs、页面和 sheet 标题；
- 认证、发现、书架、历史、搜索、社区、资料、设置、书籍/漫画详情与阅读器页面；
- 按钮、菜单、picker、segmented control、placeholder、表单验证、空态、loading 和 error state；
- alerts、确认按钮、Toast/状态提示和图片操作反馈；
- accessibility label、content description 和 native module 的默认用户文案；
- 书籍 badge 的第一方名称/说明、筛选/排序选项和设置选项。

### R4. Formatting

- 日期、相对时间、数字、紧凑数字和插值文案显式使用当前应用 locale，不再使用英文缩写或 `Intl(..., undefined)` 的设备默认语言。
- 复用统一格式化边界，删除 `book-detail-screen`、`book-comments-screen`、`community-utils` 等位置重复的英文相对时间实现。
- 小说/漫画正文和服务端数据保持原文，不因 UI locale 自动做简繁转换；现有阅读器正文转换设置继续独立工作。

### R5. Error Policy

- 能按已知类别识别的认证、网络、权限、解析、加载、保存和阅读器错误显示对应简繁中文。
- 无法分类的外部错误允许显示原始 `Error.message`，以保留诊断信息；该例外可能包含英文，但不得作为第一方默认/fallback 文案。
- 内部 invariant、调试日志和错误堆栈无需翻译，也不得直接新增为用户文案。

### R6. Native And System Localization

- 通过 `expo-localization` config plugin 声明 iOS/Android 支持 `zh-CN`、`zh-TW`，启用系统的 per-app language selection。
- 使用 Expo app config `locales` 生成简繁 `InfoPlist.strings`/Android resources，至少本地化应用名和照片保存权限说明；应用名继续显示 `Novella`。
- 由本地 Expo module 直接绘制的 accessibility content description 必须由 JS 传入当前翻译，不能保留 Kotlin/Swift 英文默认值。
- 系统权限弹窗遵循系统选择的 app locale；应用内手动语言不会伪造系统权限弹窗语言。

### R7. Verification And Drift Prevention

- 增加 locale resolver、设置迁移、资源 key 对称、插值和格式化单元测试。
- 本次迁移完成前执行一次性第一方英文残留源码复核；临时扫描工具在使用后删除，不进入正式代码或持续检查。
- 验证 iOS/Android 原生配置生成、Metro production export、workspace typecheck、package boundary 和相关测试。

## Acceptance Criteria

- [ ] 首次安装在简体系统、繁体系统和英文/其他系统语言下分别得到简体、繁体和简体 UI。
- [ ] 设置中可以选择跟随系统、简体中文、繁體中文；切换后当前 UI 立即更新且重启后保持。
- [ ] 所有第一方可见页面、导航、tabs、sheet、alerts、表单、空态、错误 fallback、阅读器 chrome 和无障碍标签均显示当前中文资源。
- [ ] 简繁资源 key 完全对称；缺失 key 在测试中失败，生产运行时只回退到简体且不会显示英文 key。
- [ ] 相对时间、日期和数字按 `zh-CN`/`zh-TW` 格式显示，无 `m ago`、`Weekly` 等英文格式残留。
- [ ] 已知错误类别显示简繁中文；只有无法分类的外部原始错误可按 R5 保留原文。
- [ ] `Novella` 等允许专名保留，书籍正文、章节标题、评论和其他服务端内容不被 UI i18n 改写。
- [ ] iOS/Android 声明简繁支持，照片保存权限说明具备简繁原生资源。
- [ ] 一次性英文残留复核完成，locale/设置/资源/格式测试、workspace check 和 production export 通过；仓库不保留临时审计工具。
- [ ] 用户在 iOS/Android 设备上验收主要流程的简繁即时切换以及系统权限文案。

## Out Of Scope

- 自动翻译书籍正文、章节标题、书籍元数据、评论、社区内容或其他服务端内容。
- 新增英语或其他语言资源。
- 在本任务中改变阅读器正文的 `t2s`/`s2t` 转换语义。
- 翻译仅用于开发调试的日志、错误堆栈、协议字段、内部标识符或测试描述。

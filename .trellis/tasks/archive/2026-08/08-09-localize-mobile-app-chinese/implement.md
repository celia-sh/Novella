# 移动端简繁中文本地化实施计划

## Phase 1 — Infrastructure And Contracts

- [ ] 安装 Expo SDK 匹配的 `expo-localization` 及 `i18next`、`react-i18next`，不升级现有 Expo/RN 原生基线。
- [ ] 新增 `apps/mobile/src/localization/`：
  - locale/settings types；
  - pure locale resolver；
  - i18next instance 与 typed resources；
  - provider/hooks；
  - date/number/relative-time formatters；
  - `UserMessage` descriptor 和已知错误分类映射。
- [ ] 在 `AppSettings` 增加 `language: 'system' | 'zh-CN' | 'zh-TW'`，补充 decode/migration 测试。
- [ ] 在根布局真实 route 显示前初始化 locale，并确保手动语言与系统语言变化都会触发当前 React tree 更新。
- [ ] 增加 locale resolver、资源 key 对称、插值变量、formatter 和 message projection 单元测试。

Validation:

```bash
npm run typecheck --workspace @novella/mobile
npm run test:shelf --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
```

Rollback point: provider 尚未接管生产 UI 文案，可以移除依赖与新增目录而不影响现有页面。

## Phase 2 — Native Metadata And Local Module Strings

- [ ] 在 `app.config.ts` 注册 `expo-localization` config plugin 和 `zh-CN`/`zh-TW` supported locales。
- [ ] 新增 Expo locale JSON，本地化应用名和照片保存权限说明，设置 `CFBundleAllowMixedLocalizations`。
- [ ] 扩展 `NativeTopAppBarScaffold` 的 back accessibility label prop。
- [ ] 扩展 Android `NativeSearchBar` 的 clear accessibility label，删除 Kotlin 英文 placeholder/content-description 默认值。
- [ ] 让 `NativeAlertHost` fallback action 使用当前 `common.confirm` 翻译。
- [ ] 审计其他 Kotlin/Swift 自绘控件，用户文案全部由 JS props 或 native locale resources 提供。
- [ ] 运行 clean prebuild，审计生成的 iOS `.lproj`、Android locale config/resources 和已有原生改动。

Validation:

```bash
cd apps/mobile && npx expo config --type public
cd apps/mobile && npx expo prebuild --clean
cd apps/mobile/android && ./gradlew :novella-ui:compileDebugKotlin :app:compileDebugKotlin
cd apps/mobile/ios && xcodebuild -workspace Novella.xcworkspace -scheme Novella -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

Rollback point: native prop additions保持向后兼容；config/locales 可独立撤回。

## Phase 3 — Shell, Navigation, Auth, And Settings

- [ ] 迁移根 Stack、NativeTabs、sheet titles 和 shared navigation/actions。
- [ ] 迁移注册、登录、验证邮箱、重置密码及表单验证/错误 fallback。
- [ ] 在外观设置增加语言 section，提供跟随系统/简体/繁体三项并立即更新。
- [ ] 迁移 Settings 首页和 appearance/content/reader/cache/about/profile/avatar/badges 页面。
- [ ] 把 module-scope option labels 改为 render-time translation，避免切换后保留旧语言。
- [ ] 迁移 common controls、alerts、empty/error/loading states 和 accessibility labels。

Validation:

```bash
npm run typecheck --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
```

## Phase 4 — Main Product Surfaces

- [ ] 迁移 Discover/Home、Rankings、All novels、All comics。
- [ ] 迁移 Shelf/folders/manage、History、Search。
- [ ] 迁移 book/comic detail、info/tags/uploader/versions/comments/compose。
- [ ] 迁移 Profile/My Community 入口和所有共享 book/badge/grid 状态组件。
- [ ] 保持书籍名、章节名、作者、标签和其他服务端内容原样传入。

Validation:

```bash
npm run typecheck --workspace @novella/mobile
npm run test:shelf --workspace @novella/mobile
npm run test:client
```

## Phase 5 — Community And Readers

- [ ] 迁移 Community 首页、boards/filter/sort、thread/reply/compose、notifications、mine、rankings。
- [ ] 迁移 shared comment thread 的 action/a11y/state labels。
- [ ] 迁移小说/漫画 reader chrome、准备/错误/重试、章节 sheet、设置、脚注和图片操作反馈。
- [ ] 保持 publication 内 `xml:lang`、正文内容和正文简繁转换设置独立于 UI locale。
- [ ] 确保 native reader 原始错误只按 `UserMessage` 策略显示。

Validation:

```bash
npm run test:community --workspace @novella/mobile
npm run test:reader
npm run typecheck --workspace @novella/mobile
```

## Phase 6 — Formatting And Error Projection

- [ ] 将 `book-detail-screen`、`book-comments-screen`、`community-utils` 等英文相对时间合并到 localization formatter。
- [ ] 所有 `Intl` UI 调用显式使用 resolved `zh-CN`/`zh-TW` locale。
- [ ] hooks/state 中 first-party error strings 改为 `UserMessage` key；已知 `ApiError.category`、reader/image error code 分类本地化。
- [ ] 无法分类的外部错误保留 raw message，并在代码中清楚标记该例外。
- [ ] 验证语言切换时当前已显示的 error/empty/status 文案也立即重算。

Validation:

```bash
npm run test:localization --workspace @novella/mobile
npm run typecheck --workspace @novella/mobile
```

## Phase 7 — Residual Review And Quality Gate

- [ ] 使用一次性 source scan 覆盖 JSX/props/options/alerts/fallback/native descriptions/config permission strings，并人工复核候选。
- [ ] 确认品牌、技术名、日志和 raw external error 属于允许范围，不用它们掩盖第一方文案。
- [ ] 删除临时 source scan，不加入 npm/workspace 持续检查。
- [ ] 搜索简繁资源中的 key 漂移、重复 formatter 和 module-scope translated values。
- [ ] 执行完整自动化验证。

Validation:

```bash
npm run check
npm run test:client
npm run test:reader
npm run test:community --workspace @novella/mobile
npm run test:shelf --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
cd apps/mobile && npx expo export --platform ios --output-dir $TMPDIR/novella-i18n-ios
cd apps/mobile && npx expo export --platform android --output-dir $TMPDIR/novella-i18n-android
git diff --check
```

## Manual User Acceptance

按项目质量规范，除非用户另行授权，模拟器/设备交互由用户完成：

- [ ] 简体系统首次启动显示简体；繁体系统首次启动显示台湾繁体；英文系统回退简体。
- [ ] 在设置中依次切换跟随系统/简体/繁体，当前 tabs、导航、页面和 alert 立即更新且不闪回英文。
- [ ] 重启后语言偏好保持；Android 修改系统/app locale 后回到前台可更新跟随系统模式。
- [ ] 检查认证、发现、书架、历史、搜索、社区、设置、书籍详情、小说和漫画阅读器主流程。
- [ ] 触发照片保存权限，确认系统权限文案使用系统选择的简繁资源。
- [ ] 触发一个已知分类错误与一个未知外部错误，确认分别显示中文分类文案和原始诊断文案。

## Risk Controls

- 每一批迁移后运行 TypeScript 与 localization tests，避免一次性出现无法定位的 missing key。
- translation resources 与 UI 调用分批但在同一逻辑提交中保持可运行，不提交只显示 key 的中间状态。
- clean prebuild 前记录 git status；生成后逐文件审计，避免覆盖 Readium、签名、desugaring或其他手工 native 改动。
- 不调用 reviewer，除非用户明确要求；最终交互验收前不擅自提交本 i18n 任务代码。

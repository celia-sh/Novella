# 移动端简繁中文本地化设计

## 1. Architecture

本地化分为四个边界：

```text
expo-localization (system locales)
        +
AppSettings.language (system | zh-CN | zh-TW)
        ↓
locale resolver / language controller
        ↓
react-i18next provider + typed resources
        ↓
React screens/components ──props──> local native UI modules
        ↓
Intl formatters / localized user-message projection
```

`apps/mobile` 是 UI locale 的唯一所有者。`packages/api-client` 和 `packages/client-core` 继续返回领域数据、`ApiError.category` 和原始错误，不依赖 React 或翻译资源。共享 package 不返回翻译后的字符串。

## 2. Dependencies And Locale Declaration

- 使用 Expo SDK 对应的 `expo-localization ~57.0.1` 读取系统 locale 并通过 config plugin 声明支持语言。
- 使用 `i18next` + `react-i18next` 提供插值、React 响应式更新和成熟的资源查找；配置 `escapeValue: false`，仅支持 `zh-CN` 与 `zh-TW`，`fallbackLng: 'zh-CN'`，不注册英文资源。
- `app.config.ts` 增加：
  - `['expo-localization', { supportedLocales: { ios: ['zh-CN', 'zh-TW'], android: ['zh-CN', 'zh-TW'] } }]`；
  - `locales` 指向简繁 JSON；
  - `ios.infoPlist.CFBundleAllowMixedLocalizations = true`。
- locale JSON 本地化 `CFBundleDisplayName`、`NSPhotoLibraryAddUsageDescription` 和 Android `app_name`。品牌名仍是 `Novella`。

系统 per-app language 与应用内设置可以并存：`language = system` 时使用 `expo-localization` 返回的 app/system locale；显式 `zh-CN`/`zh-TW` 时只覆盖 JS/应用自绘 native UI。系统权限弹窗始终使用系统为该 app 选择的 locale。

## 3. Settings And Locale Resolution

`AppSettings` 新增：

```ts
type AppLanguage = 'system' | 'zh-CN' | 'zh-TW';
```

默认和旧设置迁移均为 `system`。纯函数 `resolveAppLocale(preference, locales)` 负责：

1. 显式语言直接返回；
2. `languageScriptCode === 'Hant'` 返回 `zh-TW`；
3. `languageCode === 'zh'` 且 region 为 `TW/HK/MO` 返回 `zh-TW`；
4. 其他全部返回 `zh-CN`。

根布局已经在显示真实 route 前等待 `loadAppSettings()`，因此 provider 可以放在 `AppThemeProvider` 外层并利用现有首帧 gate，避免已保存的手动语言在启动时短暂显示系统语言。

`LocalizationProvider` 订阅 `useAppSettings()` 与 `useLocales()`：

- locale 变化时调用 `i18n.changeLanguage()` 并通过 React context 触发当前页面更新；
- Android 从后台回到前台时 `useLocales()` 会刷新；
- provider 暴露 `locale`、`t`，以及只依赖当前 locale 的 formatter facade。

## 4. Translation Resource Contract

资源按领域分 namespace（例如 `common`、`navigation`、`auth`、`discover`、`book`、`reader`、`community`、`settings`），最终组合为两个静态对象。

`zh-CN` 是结构基准，`zh-TW` 使用递归 `TranslationShape<typeof zhCN>` 约束相同 key 结构但允许不同 string literal。通过 i18next TypeScript module augmentation 让 `t()` 的 key 和插值参数可检查。

资源要求：

- key 描述语义，不复制英文原文，例如 `common.actions.retry`；
- 简繁资源人工撰写，繁体采用台湾用语；
- 变量使用命名插值，不在组件内拼接半句翻译；
- 品牌、技术名和服务端内容作为值传入，不成为可翻译 key；
- module-scope 的英文 option 常量改成 value-only 常量，label 在 render 时调用 `t()`，以便即时切换。

## 5. UI Migration Boundary

迁移顺序按共享面优先：

1. 根 Stack、NativeTabs 和共享 common controls；
2. auth 与 settings；
3. discover、book/comic、shelf、history、search、profile；
4. community；
5. novel/comic reader chrome 和 sheets。

所有用户文案必须在 render 边界通过 `useTranslation()` 生成。服务/hook 不直接调用 React hook，也不保存已经翻译的字符串。

### Native UI

立即切换要求 JS 继续拥有本地 Expo module 的文案：

- `NativeTopAppBarScaffold` 增加 `backAccessibilityLabel`，Kotlin 不再硬编码 `Back`；
- Android `NativeSearchBar` 增加 `clearAccessibilityLabel`，默认 placeholder 由 TS wrapper 提供，不在 Kotlin 留英文；
- Android `NativeAlertHost` 的 fallback OK 通过 provider 翻译；
- bottom app bar、reader navigation 和 menu labels 继续通过已有 props 传入翻译；
- 原生错误事件仍传 code/raw message，JS 决定显示文案。

## 6. Error And Message Model

为了让语言切换时当前错误也能立即更新，hook/state 不应保存已经翻译的字符串。新增 JSON-safe UI message descriptor：

```ts
type UserMessage =
  | { kind: 'key'; key: TranslationKey; values?: Record<string, string | number> }
  | { kind: 'raw'; text: string };
```

- first-party fallback、表单验证和已知 `ApiError.category` 保存 `key`；
- 能识别的 reader/image/native 错误 code 映射为 `key`；
- 无法分类的外部 `Error.message` 保存为 `raw`；
- UI 使用 `useUserMessage()`/`formatUserMessage(t, message)` 在 render 时解析。

开发日志保留原始错误。内部 invariant 不进入 `UserMessage`。

## 7. Date And Number Formatting

新增 React-free formatter：

```ts
formatRelativeTime(value, locale)
formatDate(value, locale, options)
formatCompactNumber(value, locale)
```

- 相对时间使用 `Intl.RelativeTimeFormat(locale, { numeric: 'auto' })`，保留现有时间阈值；
- 较早日期使用 `Intl.DateTimeFormat(locale, ...)`；
- 计数使用 `Intl.NumberFormat(locale, ...)`；
- 调用方必须显式传 provider 的 resolved locale，禁止 `Intl(..., undefined)`。

这会合并目前 `book-detail-screen`、`book-comments-screen` 和 `community-utils` 的重复实现。

## 8. First-Party English Review

本次迁移使用一次性 targeted source scan 和人工复核生产 TS/TSX、本地 native module 与 app config 中最容易泄漏的用户文案位置：

- JSX text；
- `title`、`label`、`description`、`placeholder`、`accessibilityLabel`、`message` 等 props；
- alert 参数、表单 fallback 和 UI option labels；
- Kotlin/Swift `contentDescription` 与用户可见默认值；
- app config permission strings。

品牌/技术专名、协议字段、route 名、开发日志、测试 fixture、服务端原文不作为第一方英文。临时扫描脚本在复核完成后删除，不加入 mobile/workspace 持续检查。

资源测试验证：

- 简繁 key 对称；
- 必需插值变量对称；
- locale resolver 不会产生英文 locale。

## 9. Native Generation And Compatibility

这是 JS + config/native resource 变更：

- 安装 `expo-localization` 后需要重新生成/构建 development client；
- clean prebuild 后审计 iOS `.lproj`、Android locale config/resources，保留已有 Readium、签名和 desugaring 配置；
- 不升级 Expo、React Native、Kotlin、Gradle 或 AGP 主基线。

## 10. Rollout And Rollback

改造按可独立检查的提交推进，但在最终合并前整套资源和调用必须同时完整：

1. locale infrastructure/settings/resources；
2. native config/module accessibility；
3. shared shell/auth/settings；
4. content/community/reader surfaces；
5. formatting/error migration/residual audit。

回滚可以按上述提交逆序进行。`AppSettings.language` 是向后兼容的可选持久化字段；回滚旧版本会忽略它，不涉及服务端迁移。

# 贡献指南

感谢你参与 Novella 的开发。本文档介绍项目的目录结构、移动端开发流程与代码约定，供贡献者参考。

## 项目结构

- `apps/mobile`：React Native + Expo 移动端
- `packages/*`：与平台无关的客户端核心与协议
- `apps/mobile/modules/novella-ui`：自定义 Expo 原生模块，封装 iOS UIKit/SwiftUI 组件，并与 `@expo/ui` 混合使用

## 移动端开发

移动端基于 Expo Development Build 开发，仅支持 iOS。项目不使用 Expo Go，日常开发也不依赖 EAS Build。

Expo CLI 命令统一在 `apps/mobile` 目录下执行：

```bash
cd apps/mobile
```

### 首次构建

首次运行前，或安装、修改了包含原生代码的依赖之后，需要重新编译并安装 Development Build：

```bash
npx expo run:ios
```

连接真机时，可指定设备：

```bash
npx expo run:ios --device
```

`expo run:ios` 会在需要时生成 iOS 原生工程、编译并安装应用到设备，然后启动 Metro。

### 日常开发

Development Build 安装完成后，若只修改 JavaScript 或 TypeScript 代码，无需重新编译原生应用：

```bash
npx expo start
```

需要清除 Metro 缓存时：

```bash
npx expo start --clear
```

### 重新生成原生工程

修改了 Expo 配置、Config Plugin 或原生依赖后，如需彻底重新生成 iOS 工程：

```bash
npx expo prebuild --clean --platform ios
npx expo run:ios
```

注意：`prebuild --clean` 会重建原生工程，尚未迁移到 Expo Module 或 Config Plugin 的手动原生修改会被覆盖，请勿将其保留在生成目录中。

## 代码规范

### 原生设计

移动端以 iOS 原生体验为目标：系统导航由 Expo Router native stack 负责，局部控件使用 SwiftUI。优先使用 `@expo/ui` 的原生宿主（`RNHostView` / `Host`）和 `modules/novella-ui` 中封装的原生组件。

- 优先复用共享组件（`NativeGroupedList`、`NativeIcon` 等），避免在每个页面中直接使用 `RNHostView`。
- `apps/mobile` 的 TypeScript 与 Expo Module 源码直接使用 iOS 实现。
- 项目采用 CNG（Continuous Native Generation）：`ios/` 为生成产物（已 gitignore）。原生配置应写入 `app.config.ts` 的 Config Plugin 或 Expo Module，不宜长期手改生成目录——`prebuild --clean --platform ios` 会覆盖这些改动。

### 图标

图标分两条路径使用：

- **平台原生图标**（需要 iOS 显示为 SF Symbols 的场景，如系统导航、原生列表行）：统一经由 `NativeIcon` 组件与 `NativeIconName` 类型使用，不要直接 `import` `@tabler/icons-react-native`，也不要在组件中写死 SF Symbol 名称。
- **普通内联图标**（页面内容中的装饰性图标，如箭头、按钮图标）：可直接从 `@tabler/icons-react-native` 按需 import。

平台原生图标的具体规则：

- **iOS**：优先使用 SF Symbols（`@expo/ui/swift-ui` 的 `Image systemName`）——凡是 SF 能自然表达语义的场景均优先使用；SF 无法表达的含义（如部分设置二级行）回退到 Tabler。
- 新增 `NativeIconName` 时，需在 `native-icon-types.ts` 中声明，并同步更新 `tabler-native-icon-map.ts` 与 `native-icon.tsx` 中的 iOS SF 映射。

通用注意：

- 使用 Tabler 图标前请核对 `@tabler/icons-react-native` 的图标列表，不要根据名称猜测。
- 纯逻辑解析器（如图标键映射、格式化函数）不应导入 react-native 依赖，应放在 react-native-free 模块中，以便 Node 单元测试覆盖。

### 组件泛用性

**向 `modules/novella-ui` 新增原生组件时**：组件应保持泛用，不与某个具体功能或页面绑定。公共 props 采用通用语义的命名（如 `icon`、`title`、`description`、`trailing`、`onPress`、`disabled`）；当组件开始出现业务字段时，应拆出通用契约。

**一般 React Native 组件**（如骨架屏、通用占位组件）若会被多处使用，请抽离为可复用组件，供各页面共享。

## 质量门槛

提交前请在仓库根目录运行以下检查：

```bash
npm run check        # 边界检查 + 类型检查
npm run test:client  # 客户端核心测试
npm run test:reader  # 阅读器相关测试
```

提交 PR 前，请完成 iOS simulator/device 的功能回归；视觉和交互验收范围见任务文档。

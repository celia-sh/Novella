<p align="center">
  <img src="assets/banner.png" alt="Novella banner" width="100%">
</p>

# 📚 Novella

<a href="https://trendshift.io/repositories/22931?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-22931" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/22931" alt="celia-sh%2FNovella | Trendshift" width="250" height="55"/></a>

<p>
  <img src="assets/badges/typescript.svg" alt="TypeScript" height="24" />
  <img src="assets/badges/react-native.svg" alt="React Native" height="24" />
  <img src="assets/badges/expo.svg" alt="Expo" height="24" />
  <img src="assets/badges/license.svg" alt="License: AGPL 3.0" height="24" />
</p>

轻书架第三方客户端。

本仓库正在从 Dart 迁移到 TypeScript：

- `apps/mobile`：基于 React Native + Expo 的 iOS 客户端。
- `packages/*`：与平台无关的客户端核心、协议。

原有的 Flutter 实现保留在 `archive/flutter` 分支上。

## 开发状态

React Native 重写正在积极开发中，欢迎向本仓库提交代码。功能开发清单见 [Issues](https://github.com/celia-sh/Novella/issues) 中的待办事项；如果你想做的功能不在清单中，请先在 [Discussions](https://github.com/celia-sh/Novella/discussions) 中讨论。

## 移动端开发

移动端使用 Expo Development Build 开发，仅支持 iOS。

开发工作流（首次构建、日常开发、重新生成原生工程）与代码规范（原生设计、图标、组件泛用性）见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

AGPL-3.0。参见 [LICENSE](LICENSE)。

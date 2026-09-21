# Skia 自绘阅读器实现

## Goal

使用 React Native Skia 替代 WebView 实现章节渲染，解决 WebView 在部分设备上的兼容性问题，并恢复旧版 Flutter 阅读器的稳定性和性能。

**用户价值：**
- 解决部分设备上 WebView 无法加载章节的兼容性问题
- 提供更稳定的阅读体验（参考旧版 Flutter 自绘方案）
- 原生滚动集成，解决 WebView 滚动状态隔离问题
- 为未来的长文本优化（虚拟化渲染）打下基础

## Background

### 当前问题

1. **WebView 兼容性**：部分设备无法加载章节，缺乏详细错误信息
2. **滚动隔离**：滚动状态在 WKWebView 内部，外层导航难以感知边界
3. **调试困难**：WebView 是黑盒，问题难以定位

### 历史参考

旧版 Flutter 使用 CustomPainter + ScrollView 自绘渲染非常稳定，包含：
- 完整的 HTML → Block 解析管线
- 稳定的 XPath locator 系统
- 字体加载和图片比例预解析
- 样式 class preset（pius1/pius2、emXX 等）
- Ruby 注音处理
- 脚注抽离和预览机制

### 现有基础设施

项目已有 `packages/reader-engine`：
- `normalizeNovelBlocks()` - HTML → 稳定 block 转换
- `processNovelFootnotes()` - 脚注抽离
- `createReaderPagePlan()` - 分页逻辑
- `findReaderBlockIndex()` - locator 映射
- `useReaderFont` - 字体加载机制

## Requirements

### R1: 第一阶段 - 长 Canvas + RN ScrollView

**优先级：P0**

实现最简单的 Skia 渲染方案：
- Canvas 高度等于章节总高度
- 原生 UIScrollView 负责滚动
- 使用 Reanimated 4 的 `useScrollOffset()` 获取滚动位置
- Block-level 渲染（不拆分段落）

**技术要求：**
- 添加 `@shopify/react-native-skia` 依赖
- 创建 `packages/reader-layout` 包，包含：
  - `StyleResolver` - 样式解析（继承旧 Flutter 的 class preset）
  - `BlockLayout` - block 级布局
  - `SkiaParagraphMeasurer` - 使用 Skia Paragraph API 测量
- 实现 `ReaderSkiaCanvas` 组件
- 保持现有的字体加载、主题、locator 映射机制

**不包含：**
- Line-level 分页（段落可以跨页）
- 虚拟化渲染（viewport canvas）
- Selection 和 accessibility（后续补充）

### R2: 样式兼容性

**优先级：P0**

保留现有服务器 HTML 的样式支持：
- 基础标签：`p/div/blockquote/h1-h6/center`
- 现有 class preset：`emXX`、`pius1/pius2/ph4`、`right/left/center`、`zin`、`bold`、`ita`、`stress`、`author`、`message`、`cut-line`、`meg`、`lh`、`m0/p0`、颜色 class、`fl/fr` float 等
- Ruby 注音：`<ruby>` 标签处理
- 图片：inline image、standalone illustration、float left/right

### R3: 功能完整性

**优先级：P0**

保持现有阅读器功能：
- 脚注点击 → 原生 Sheet 弹窗（复用现有 RN 组件）
- 图片长按 → 预览弹窗（复用现有 RN 组件）
- 阅读进度保存（复用现有 locator 映射机制）
- 字体加载和应用（复用现有 `useReaderFont`）
- 主题切换（深色/浅色模式）
- 阅读设置（字号、行高、首行缩进、边距）

### R4: 性能验证

**优先级：P1**

真机测试不同长度章节的性能：
- 2 万像素高度
- 5 万像素高度
- 10 万像素高度

如果发现性能问题，准备升级到虚拟化渲染方案。

### R5: 第二阶段 - 虚拟化渲染（可选）

**优先级：P2**

仅在第一阶段发现性能问题时实施：
- Canvas 高度固定为屏幕高度
- 根据 scrollY 只绘制可见区域的 blocks
- 实现 viewport renderer

## Acceptance Criteria

### AC1: 基础渲染

- [ ] 可以渲染包含文本、标题、Ruby 注音的章节
- [ ] 支持现有的 class preset（至少支持 pius1/pius2、emXX）
- [ ] 图片正确显示（保持比例）
- [ ] 原生滚动流畅，无卡顿

### AC2: 功能完整性

- [ ] 脚注点击正常工作，弹出原生 Sheet
- [ ] 图片长按预览正常工作
- [ ] 阅读进度保存和恢复正确
- [ ] 字体加载和应用正确
- [ ] 主题切换（深色/浅色）正常工作
- [ ] 阅读设置（字号、行高等）实时生效

### AC3: 兼容性

- [ ] 在之前无法加载章节的设备上可以正常阅读
- [ ] iOS 和 Android 均正常工作
- [ ] 与现有 WebView 阅读器行为一致（用户无感知切换）

### AC4: 性能

- [ ] 真机测试：2 万像素章节滚动流畅
- [ ] 真机测试：5 万像素章节可接受
- [ ] 如 10 万像素章节有明显性能问题，记录数据，准备虚拟化方案

### AC5: 代码质量

- [ ] 通过 TypeScript 类型检查
- [ ] 遵循项目现有代码风格
- [ ] 关键逻辑有单元测试（layout、locator 映射等）
- [ ] 可行性研究文档更新为最终设计文档

## Technical Notes

### 架构选择

基于外部咨询建议，选择**长 Canvas + RN ScrollView**方案：

```
Native Navigation
        │
        ▼
  Animated.ScrollView (原生滚动)
        │
        ▼
    Canvas (height: 章节总高度)
        │
        └── Skia 绘制章节内容
```

**为什么不选 Skia 自己模拟滚动：**
- 会失去原生滚动的所有优势（bounce、indicators、accessibility 等）
- 需要自己实现大量原生行为
- 外层导航无法感知滚动状态

### 关键技术点

1. **Reanimated 4 集成**
   ```tsx
   const scrollRef = useAnimatedRef<ScrollView>();
   const scrollY = useScrollOffset(scrollRef);
   ```

2. **Skia Paragraph 测量**
   - 测量和绘制使用同一个 layout result
   - 比 Flutter 两遍布局更高效

3. **保留现有数据模型**
   - 不推倒重写 `NovelReaderBlock`、locator、progress 等
   - 旧 Flutter 的设计作为行为标准
   - current reader-engine 作为数据内核
   - Skia 只补上 deterministic layout + paint layer

### 文件结构

```
packages/reader-layout/          # 新包
├── src/
│   ├── index.ts
│   ├── style-resolver.ts        # 样式解析
│   ├── block-layout.ts          # Block 级布局
│   ├── ruby-layout.ts           # Ruby 注音
│   ├── image-layout.ts          # 图片布局
│   └── skia-paragraph.ts        # Skia Paragraph 封装

apps/mobile/src/components/
└── reader-skia-canvas.tsx       # Skia Canvas 渲染组件

apps/mobile/src/screens/
└── reader-screen-skia.tsx       # Skia 版阅读器屏幕
```

### 迁移策略

不是"逐函数翻译 Flutter 代码"，而是：
1. 保留旧 Flutter 的算法和设计思想
2. 删除 Flutter 框架绑定（Riverpod、Widget、RenderObject 等）
3. 利用 Skia 的优势（直接获取 line metrics、glyph geometry）

## Out of Scope

- Line-level 分页（段落跨页切割）- 第二阶段
- Viewport 虚拟化渲染 - 仅在性能问题时实施
- Selection 文本选择 - 后续补充
- Accessibility 细粒度支持 - 后续补充
- 漫画阅读器迁移 - 独立任务

## Open Questions

### Q1: 是否立即启动实施？

**已确认：是，立即开始实施**

**理由：**
- 可行性研究已完成，架构清晰，风险可控
- 可以尽快解决 WebView 在部分设备上的兼容性问题
- 第一阶段（长 Canvas + RN ScrollView）实现复杂度可控

### Q2: Skia 阅读器是否完全替代 WebView，还是作为备选方案？

**已确认：直接替换现有 WebView 实现**

**理由：**
- 版本控制提供了安全的回退路径（Git revert）
- 避免维护两套代码
- 更简洁的代码库
- 如有问题可以快速回滚

**实施方案：**
- 直接修改现有的 `reader-screen.tsx`
- 保持相同的路由结构 `/reader/[bookId]/[sortNum]`
- 保持相同的 API 和数据流
- 用户无感知切换

### Q3: 性能基准是什么？

**已确认：宽松基准，重点是样式和排版迁移**

**性能标准：**
- 2 万像素高度章节：滚动流畅，无明显卡顿
- 5 万像素高度章节：滚动基本流畅，偶尔掉帧可接受
- 10 万像素高度章节：如明显卡顿，记录数据，准备虚拟化方案

**测试环境：**
- 主要在 iPhone 17 Pro 模拟器测试
- 用户会在真机上安装测试
- 可使用调试工具监控模拟器性能

**优先级：**
- P0：Flutter 版本的样式和排版完整迁移
- P1：基础性能可接受
- P2：性能优化（仅在发现问题时）

## Next Steps

1. 用户确认方案和 open questions
2. 运行 PRD 收敛检查（确保无重复事实、无未解决的临时章节）
3. 创建 `design.md`（技术设计细节）
4. 创建 `implement.md`（实施检查清单）
5. 运行 `python3 ./.trellis/scripts/task.py start` 进入实施阶段

# React Native Skia 自绘渲染可行性研究

## 背景

当前 Novella 阅读器使用 WebView (WKWebView) 渲染章节内容，在部分设备上遇到兼容性问题：
- 部分设备无法加载章节内容
- 滚动状态隔离在 WebView 内部，外层导航不易感知边界
- 旧版 Flutter 使用 CustomPainter 自绘渲染非常稳定

## 方案对比

根据外部咨询建议，有以下几种方案：

| 方案 | 谁负责滚动 | 上层知道位置 | 长章节支持 | 实现复杂度 | 评价 |
|------|-----------|------------|-----------|----------|------|
| **WebView (当前)** | WKWebView 内部 UIScrollView | ⚠️ 隔了一层 | ✅ 很强 | ⭐ | 当前问题来源 |
| **长 Canvas + RN ScrollView** | 原生 UIScrollView | ✅ 天然 | ⚠️ 需实测 | ⭐⭐ | **推荐先做** |
| **Viewport Canvas + RN ScrollView** | 原生 UIScrollView | ✅ 天然 | ✅ 最好 | ⭐⭐⭐⭐ | 最终理想方案 |
| **Skia 自己模拟滚动** | Gesture + Skia | ❌ 需要自己同步 | ✅ | ⭐⭐⭐⭐⭐ | 不建议 |

## 推荐方案：分两阶段实施

### 第一阶段：长 Canvas + RN ScrollView（推荐先做）

**架构：**
```
Native Navigation
        │
        ▼
  Animated.ScrollView
        │
        ▼
    Canvas (height: 章节总高度)
        │
        └── Skia 绘制章节内容
```

**关键优势：**
1. **滚动完全由原生 UIScrollView 处理**，不需要自己实现滚动逻辑
2. **scroll ownership 明确**：外层 RN ScrollView 直接拥有滚动状态
3. **useScrollOffset() 天然集成**：
   ```tsx
   const scrollRef = useAnimatedRef<ScrollView>();
   const scrollY = useScrollOffset(scrollRef);
   ```
4. **和 Flutter CustomPainter + ScrollView 模型完全一致**
5. Canvas 被当作普通 RN View，系统自动移动整个 Canvas

**实现步骤：**

1. **添加依赖**
   ```bash
   npx expo install @shopify/react-native-skia
   ```

2. **保留现有的 reader-engine 基础设施**
   - `normalizeNovelBlocks()` - 已有的 HTML → 稳定 block 转换
   - `processNovelFootnotes()` - 脚注抽离
   - `createReaderPagePlan()` - 分页逻辑（暂时保留用于进度计算）
   - `findReaderBlockIndex()` - locator 映射

3. **新增 Skia Layout 层** (packages/reader-layout)
   - `StyleResolver` - 解析样式（继承旧 Flutter 的 class preset）
   - `InlineTree` - 内联元素树
   - `BlockLayout` - block 级布局
   - `RubyLayout` - Ruby 注音特殊处理
   - `ImageLayout` - 图片布局和比例缓存
   - `SkiaParagraphMeasurer` - 使用 Skia Paragraph API 测量高度

4. **第一版实现要点**
   - **block-level 渲染**：保持和旧 Flutter 一致，不拆分段落
   - **预测量所有 block**：利用 Skia Paragraph.getHeight() 获取真实高度
   - **计算总高度**：`Canvas style={{ height: totalHeight }}`
   - **不需要处理滚动**：UIScrollView 自动处理
   - **useScrollOffset 仅用于**：
     - 阅读进度计算
     - 隐藏/显示 toolbar
     - 保存阅读位置

**风险评估：**
- ⚠️ **长章节 Canvas 性能**：需要真机实测 2 万、5 万、10 万像素高度的 Canvas
- ✅ **测量一致性**：Skia Paragraph 测量和绘制使用同一个 layout result，比 Flutter 两遍布局更好
- ✅ **字体加载**：可复用现有的 `useReaderFont` 机制

### 第二阶段：Viewport Canvas + RN ScrollView（优化）

如果第一阶段发现超长章节性能问题，升级为虚拟化渲染：

```
UIScrollView (logical content height)
        │
   useScrollOffset
        │
        ▼
    scrollY = 47321
        │
        ▼
Canvas (height: viewport height)
        │
        └── 只绘制可见区域的 blocks
```

**实现要点：**
- ScrollView 的 `contentSize.height` 设置为逻辑高度
- Canvas 高度固定为屏幕高度
- 根据 scrollY 计算可见 block 范围
- Skia 在固定 Canvas 内绘制可见内容
- 这是真正的 viewport renderer，类似浏览器渲染引擎

## 不推荐的方案：Skia 自己模拟滚动

如果用 GestureDetector + PanGesture + Skia transform 实现滚动：

**问题：**
- ❌ status bar tap 回顶部不工作
- ❌ 没有原生滚动指示器
- ❌ UIKit scroll edge 自动识别失效
- ❌ bounce physics 需要自己写
- ❌ deceleration 需要自己写
- ❌ accessibility scroll 需要自己写
- ❌ native navigation 不知道滚动位置

## 现有基础设施评估

### 已有且可复用的部分

✅ **packages/reader-engine**
- `NovelReaderBlock` 类型定义
- `normalizeNovelBlocks()` - HTML 解析和 block 提取
- `processNovelFootnotes()` - 脚注处理
- `findReaderBlockIndex()` - locator 查找
- `createReaderPagePlan()` - 可用于进度计算

✅ **apps/mobile/src/hooks**
- `useReaderFont` - 字体加载机制
- `useReaderPositionSaver` - 阅读进度保存

✅ **apps/mobile/src/services**
- `reader-locator-mapping.ts` - locator 映射逻辑
- `readium-preferences.ts` - 主题和样式配置

### 需要新增的部分

📦 **packages/reader-layout** (新包)
```typescript
// 核心 API
export interface LayoutBlock {
  id: string;
  locator: string;
  width: number;
  height: number;
  lines: LineMetrics[];
  hitRects: HitRect[];
  role: 'paragraph' | 'heading' | 'image' | 'ruby';
}

export interface StyleResolver {
  resolve(node: BlockNode, context: StyleContext): ResolvedStyle;
}

export function layoutChapter(
  blocks: NovelReaderBlock[],
  width: number,
  theme: ReaderTheme,
  fontFamily: string
): LayoutBlock[];
```

🎨 **apps/mobile/src/components/reader-skia-canvas.tsx** (新组件)
```tsx
interface ReaderSkiaCanvasProps {
  layout: LayoutBlock[];
  theme: ReaderTheme;
  onFootnote: (id: string) => void;
  onImage: (source: ReaderImagePreviewSource) => void;
}

export function ReaderSkiaCanvas(props: ReaderSkiaCanvasProps) {
  // 用 Skia Canvas 绘制 layout blocks
}
```

## 迁移策略

根据外部建议，**不要逐函数翻译 Flutter 代码**，而是：

1. **保留旧 Flutter 的算法和设计思想**
   - block normalization 逻辑
   - 稳定的 XPath locator
   - 样式 class preset（pius1/pius2/emXX 等）
   - 图片比例预解析
   - Ruby 处理方式
   - 脚注抽离机制

2. **删除 Flutter 框架绑定**
   - Riverpod
   - Flutter Widget
   - Offstage 测量
   - RenderObject
   - PageController

3. **利用 Skia 的优势**
   - Paragraph 测量和绘制用同一个 layout result
   - 不需要隐藏测量 Widget
   - 直接获取 line metrics、glyph geometry
   - 更精确的 hit testing

## 实施优先级

### P0 - 立即可做
1. ✅ 改进加载状态可观测性（已完成）
2. 添加 @shopify/react-native-skia 依赖
3. 创建 packages/reader-layout 包
4. 实现基础的 Skia Paragraph 测量和绘制

### P1 - 第一版核心
1. 实现 StyleResolver（支持现有的 class preset）
2. 实现 BlockLayout（block-level，不拆分段落）
3. 实现长 Canvas + RN ScrollView 方案
4. 迁移字体加载和主题系统
5. 实现脚注和图片预览（复用现有 RN 组件）

### P2 - 优化和完善
1. 真机性能测试（不同长度章节）
2. 如需要，实现 Viewport Canvas 虚拟化
3. Line-level 分页（允许段落跨页）
4. Selection 和 accessibility 支持

## 风险和缓解措施

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 长 Canvas 性能问题 | 高 | 中 | 真机测试，准备好 Viewport 方案 |
| 样式兼容性 | 中 | 低 | 保留 class preset，逐步测试 |
| 字体渲染差异 | 中 | 低 | 复用现有字体加载，Skia 直接支持自定义字体 |
| Ruby 排版问题 | 低 | 低 | 参考旧 Flutter 实现，Skia 有完整控制 |

## 结论

**推荐立即启动第一阶段：长 Canvas + RN ScrollView**

理由：
1. ✅ 架构最接近稳定的旧 Flutter 方案
2. ✅ 滚动由原生 UIScrollView 处理，不需要自己实现
3. ✅ 解决 WebView 隔离问题
4. ✅ 可复用现有 reader-engine 基础设施
5. ✅ 实现复杂度可控
6. ✅ 如需要可平滑升级到 Viewport 方案

**下一步行动：**
1. 向用户确认方案
2. 添加 @shopify/react-native-skia 依赖
3. 创建 packages/reader-layout 包结构
4. 实现最小化 Skia 渲染 demo

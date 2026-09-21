# Skia 自绘阅读器 - 技术设计

## 实施修订（2026-08-20）

最初的“整章长 Canvas”设计已被运行时内存验证否决，当前实现以此修订为准：

```text
normalizeNovelBlocks
  → layoutChapter（临时 SkParagraph 只用于测量，结果为纯数据）
  → scroll: tileChapter → vertical FlatList
  → paged:  pageChapter → horizontal paging FlatList
  → mounted ReaderSkiaTile owns SkParagraph / SkImage
```

不可回退的约束：

1. `LayoutChapterResult`、tile/page plan 不得持有 Skia/JSI 对象。
2. 测量与绘制必须共用 `createSkiaParagraphStyle()` 和首行缩进文本转换。
3. 行高是 `1.0...2.5` multiplier，应用到 Skia text style + strut；不是绝对像素。
4. 首行缩进使用两个全角空格 `\u3000\u3000`，测量与绘制完全相同。
5. 滚动 tile 必须完整分割 `[0, totalHeight]`，`tile.y` 就是 FlatList offset。
6. Skia FlatList 使用 `removeClippedSubviews={false}` 与即时 batch；禁止 JS 自算可见 tile。
7. 图片几何按 HTML 显式尺寸 → 系统图床 URL 完整元数据（`placeholder` + `size=WxH`）→ 持久化尺寸 → `2:3` fallback；URL 自然宽度限制首次占位，不再对已知小图贪心占满正文宽度；mounted tile 才加载图片像素。
8. 分页模式必须使用横向、定宽、`pagingEnabled` 的 native FlatList，而不是仅修改导航栏 mode。
9. 自定义字体的 PUA 字形在 Unicode 层仍不是 CJK；数字/十六进制 HTML entity 必须先物化，随后仅在送入 Skia 的文本中为完整 PUA 范围加入 `\u200B` 换行机会。原始 HTML、block identity 和 locator 不得改变，测量与 mounted paint 共用同一转换函数。
10. Ruby 不得 flatten 为基文 + `rp` 括号 + `rt` 同排文本。按 Flutter `HtmlRuby` 将每个 pending base + direct `rt` 组成 inline placeholder，`rt` 使用 `0.5em` 并居中置于 base 上方，placeholder 暴露 base alphabetic baseline 并参与主 Paragraph 换行；测量后只复制 rect 数值，mounted tile 重建相同 placeholder 并绘制 base/rt Paragraph。`@novella/reader-layout` 与 mobile 必须共用 Skia 2.6.2，禁止再安装 1.x 副本。
11. 富文本不能再依赖“去标签后的一条纯字符串”。`parseReaderBlockContent()` 生成带完整继承样式的纯数据 inline runs（text / hard break / Ruby / image）；普通 run 用 `pushStyle/pop`，Ruby、sub/sup、inline image 用 baseline placeholder，临时测量和 mounted paint 重放同一 `ParagraphRun[]`。`br` 保留 hard break，`pre` 保留空白；列表 marker 元数据由 reader-engine 在 block boundary 提供，不能从已经失去 `ol/ul` 父级的 `li` 字符串猜测。blockquote/center 外层必须作为 block 保留。布局计划只保存样式、placeholder rect 数值和 overlay 几何，不保存 DOM 或 JSI 对象。

## 架构概览（历史初版，已被上方修订取代）

```
┌─────────────────────────────────────────┐
│     Native Navigation                    │
│     (ReaderNavigation + Chapter Nav)    │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│     Animated.ScrollView                  │
│     (原生 UIScrollView)                  │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Canvas (height: 章节总高度)        │ │
│  │                                    │ │
│  │  ┌──────────────────────────────┐ │ │
│  │  │ Skia 绘制内容               │ │ │
│  │  │  - 段落文本                 │ │ │
│  │  │  - 标题                     │ │ │
│  │  │  - Ruby 注音                │ │ │
│  │  │  - 图片                     │ │ │
│  │  └──────────────────────────────┘ │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                  │
                  ▼
        useScrollOffset(scrollRef)
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
阅读进度      导航栏状态    位置保存
```

## 数据流

### 1. 章节加载流程

```
服务器 HTML
    ↓
normalizeNovelBlocks()          // packages/reader-engine
    ↓
NovelReaderBlock[]
    ↓
processNovelFootnotes()         // packages/reader-engine
    ↓
{ html, notesById }
    ↓
layoutChapter()                 // packages/reader-layout (新)
    ↓
LayoutBlock[]                   // 包含测量后的高度、line metrics 等
    ↓
计算总高度
    ↓
ReaderSkiaCanvas 渲染
```

### 2. 滚动和进度流程

```
用户滚动
    ↓
UIScrollView 原生处理
    ↓
useScrollOffset() 暴露 scrollY
    ↓
┌──────────┬──────────┬──────────┐
│          │          │          │
▼          ▼          ▼          ▼
导航栏    阅读进度  当前block  保存位置
隐藏/显示  计算     定位       schedulePosition()
```

### 3. 交互流程

```
用户点击/长按
    ↓
Canvas onTouchEnd
    ↓
hitTest(x, y)
    ↓
┌─────────┬─────────┬─────────┐
│         │         │         │
▼         ▼         ▼         ▼
脚注     图片     链接     普通文本
Sheet   Preview  导航     (无操作)
```

## 包设计

### packages/reader-layout (新包)

这是核心布局引擎，负责将 HTML 转换为可绘制的布局树。

```
packages/reader-layout/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # 导出公共 API
│   ├── types.ts                    # 类型定义
│   ├── layout-chapter.ts           # 主入口：layoutChapter()
│   ├── style-resolver.ts           # 样式解析
│   ├── html-parser.ts              # HTML → AST
│   ├── block-layout.ts             # Block 级布局
│   ├── inline-layout.ts            # 内联元素布局
│   ├── ruby-layout.ts              # Ruby 注音特殊处理
│   ├── image-layout.ts             # 图片布局和比例处理
│   ├── skia-paragraph.ts           # Skia Paragraph 封装
│   └── utils.ts                    # 工具函数
└── README.md
```

#### 核心类型定义

```typescript
// types.ts
export interface LayoutBlock {
  id: string;
  locator: string;
  type: 'paragraph' | 'heading' | 'image' | 'ruby' | 'blockquote' | 'hr';
  x: number;
  y: number;        // 相对于章节顶部的偏移
  width: number;
  height: number;

  // 文本块特有
  paragraph?: SkiaParagraph;
  lines?: LineMetrics[];

  // 图片块特有
  image?: {
    url: string;
    width: number;
    height: number;
    aspectRatio: number;
  };

  // Ruby 块特有
  ruby?: RubyLayout;

  // 交互区域
  hitRects: HitRect[];
}

export interface HitRect {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'footnote' | 'image' | 'link';
  id: string;       // 脚注ID、图片URL、链接href
  content?: string; // 脚注内容、图片alt等
}

export interface ReaderTheme {
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  lineHeight: number;
  topPadding: number;
  bottomPadding: number;
  sidePadding: number;
  firstLineIndent: boolean;
}

export interface LayoutChapterOptions {
  blocks: NovelReaderBlock[];
  width: number;
  theme: ReaderTheme;
  fontFamily: string;
  fontDataUrl?: string;
}

export interface LayoutChapterResult {
  blocks: LayoutBlock[];
  totalHeight: number;
  blockHeights: Record<string, number>; // 用于兼容现有的 createReaderPagePlan
}
```

#### 主 API

```typescript
// layout-chapter.ts
export function layoutChapter(
  options: LayoutChapterOptions
): LayoutChapterResult {
  // 1. 解析 HTML → AST
  // 2. 应用样式规则
  // 3. 布局每个 block（测量 Skia Paragraph）
  // 4. 计算总高度和偏移
  // 5. 提取 hit rects（脚注、图片、链接）
  // 6. 返回布局结果
}
```

#### 样式解析器

```typescript
// style-resolver.ts
export interface StyleRule {
  tag?: string;
  className?: string;
  selector: (node: HTMLNode) => boolean;
  style: Partial<TextStyle>;
}

export class StyleResolver {
  private rules: StyleRule[];

  constructor(theme: ReaderTheme) {
    this.rules = this.buildRules(theme);
  }

  resolve(node: HTMLNode): TextStyle {
    // 应用继承的 Flutter class preset
    // pius1/pius2, emXX, bold, ita, etc.
  }

  private buildRules(theme: ReaderTheme): StyleRule[] {
    // 从旧 Flutter 代码迁移的样式规则
    return [
      // 基础标签样式
      { tag: 'h1', style: { fontSize: theme.fontSize * 1.5, fontWeight: 'bold' } },
      { tag: 'h2', style: { fontSize: theme.fontSize * 1.3, fontWeight: 'bold' } },
      // class preset
      { className: 'pius1', style: { fontSize: theme.fontSize * 0.9 } },
      { className: 'pius2', style: { fontSize: theme.fontSize * 0.8 } },
      { className: 'em10', style: { fontSize: theme.fontSize * 1.0 } },
      { className: 'em12', style: { fontSize: theme.fontSize * 1.2 } },
      // ... 更多规则
    ];
  }
}
```

### apps/mobile 集成

#### 新增组件

```
apps/mobile/src/components/
├── reader-skia-canvas.tsx       # Skia Canvas 渲染组件
└── reader-loading-state.tsx     # 已添加：加载状态组件
```

#### ReaderSkiaCanvas 组件设计

```typescript
// reader-skia-canvas.tsx
import { Canvas, Group, Paragraph, Image, rect } from '@shopify/react-native-skia';
import type { LayoutBlock } from '@novella/reader-layout';

interface ReaderSkiaCanvasProps {
  layout: LayoutBlock[];
  totalHeight: number;
  theme: ReaderTheme;
  onFootnote: (id: string, content: string) => void;
  onImage: (source: ReaderImagePreviewSource) => void;
}

export function ReaderSkiaCanvas({
  layout,
  totalHeight,
  theme,
  onFootnote,
  onImage,
}: ReaderSkiaCanvasProps) {
  const handleTouch = useCallback((event: TouchEvent) => {
    const { x, y } = event.nativeEvent;

    // Hit test
    for (const block of layout) {
      for (const hitRect of block.hitRects) {
        if (isPointInRect({ x, y }, hitRect)) {
          if (hitRect.type === 'footnote') {
            onFootnote(hitRect.id, hitRect.content ?? '');
          } else if (hitRect.type === 'image') {
            onImage({ uri: hitRect.id, alt: hitRect.content });
          }
          return;
        }
      }
    }
  }, [layout, onFootnote, onImage]);

  return (
    <Canvas
      style={{ width: '100%', height: totalHeight }}
      onTouchEnd={handleTouch}
    >
      <Group>
        {layout.map((block) => (
          <BlockRenderer key={block.id} block={block} theme={theme} />
        ))}
      </Group>
    </Canvas>
  );
}

function BlockRenderer({ block, theme }: { block: LayoutBlock; theme: ReaderTheme }) {
  if (block.type === 'paragraph' || block.type === 'heading') {
    return (
      <Paragraph
        paragraph={block.paragraph!}
        x={block.x}
        y={block.y}
        width={block.width}
      />
    );
  }

  if (block.type === 'image' && block.image) {
    // 使用 Skia Image 组件渲染图片
    return (
      <Image
        image={block.image.url}
        fit="contain"
        x={block.x}
        y={block.y}
        width={block.width}
        height={block.height}
      />
    );
  }

  // Ruby、blockquote 等其他类型
  return null;
}
```

#### 修改现有 reader-screen.tsx

替换策略：
1. 保留现有的数据加载逻辑（`useReaderChapter`, `useReaderFont`）
2. 替换 `NovellaReadiumView` 为 `ReaderSkiaCanvas`
3. 保持相同的导航、主题、设置逻辑

```typescript
// reader-screen.tsx (修改后)
import { ReaderSkiaCanvas } from '@/components/reader-skia-canvas';
import { layoutChapter } from '@novella/reader-layout';

export function ReaderScreen({ bookId, sortNum, openPosition }: ReaderScreenProps) {
  // ... 现有的加载逻辑保持不变

  // 新增：布局计算
  const layout = useMemo(() => {
    if (!content || fontLoading) return null;

    return layoutChapter({
      blocks,
      width: screenWidth - settings.readerSidePadding * 2,
      theme: {
        backgroundColor: readerBackground,
        textColor: readerTextColor,
        fontSize: settings.fontSize,
        lineHeight: settings.readerLineHeight,
        topPadding: readerChromeInsets.top,
        bottomPadding: readerChromeInsets.bottom,
        sidePadding: settings.readerSidePadding,
        firstLineIndent: settings.readerFirstLineIndent,
      },
      fontFamily: readerFont.family ?? 'System',
      fontDataUrl,
    });
  }, [blocks, screenWidth, settings, readerBackground, readerTextColor, fontLoading]);

  // 新增：滚动位置管理
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);

  // 替换 WebView 为 Skia Canvas
  return (
    <View style={styles.root}>
      {/* ... 错误和加载状态保持不变 */}

      {layout ? (
        <Animated.ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={{ paddingHorizontal: settings.readerSidePadding }}
        >
          <ReaderSkiaCanvas
            layout={layout.blocks}
            totalHeight={layout.totalHeight}
            theme={theme}
            onFootnote={openFootnote}
            onImage={setPreviewSource}
          />
        </Animated.ScrollView>
      ) : null}

      {/* 脚注和图片预览保持不变 */}
      {/* 导航组件保持不变 */}
    </View>
  );
}
```

## 关键技术决策

### 1. 为什么是 Block-level 而不是 Line-level？

**决定：** 第一版使用 block-level 布局，每个 block 是最小渲染单位。

**理由：**
- 和旧 Flutter 版本保持一致
- 实现复杂度低
- 大多数章节不需要 line-level 精度
- 第二版可以升级到 line-level

**trade-off：**
- 超长段落无法跨页切割（第二版解决）
- FittedBox scaleDown 作为 fallback（和旧版一致）

### 2. 字体加载机制

**决定：** 复用现有的 `useReaderFont` 和 `readerFontDataUrl`。

**实现：**
```typescript
// Skia Paragraph 支持自定义字体
const paragraph = Skia.ParagraphBuilder.Make()
  .pushStyle({
    fontFamilies: [fontFamily],
    // ... 其他样式
  })
  .addText(text)
  .build();

// 字体需要在 Skia 中注册
if (fontDataUrl) {
  const fontData = Skia.Data.fromBase64(fontDataUrl);
  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(fontData);
  Skia.FontMgr.FromData([fontData]);
}
```

### 3. 图片加载和缓存

**决定：** 使用 expo-image 的缓存机制，Skia 渲染时引用缓存的图片。

**实现：**
```typescript
// 预加载图片
import { Image as ExpoImage } from 'expo-image';

// 在布局阶段预加载
await ExpoImage.prefetch(imageUrl);

// Skia 渲染时使用
const image = Skia.Image.MakeImageFromEncoded(
  Skia.Data.fromURI(imageUrl)
);
```

### 4. Ruby 注音处理

**决定：** Ruby 作为特殊的 inline box，自己计算布局。

**实现：**
```typescript
interface RubyLayout {
  baseText: string;
  rtText: string;
  baseWidth: number;
  rtWidth: number;
  totalWidth: number;
  baseY: number;  // 相对于 baseline
  rtY: number;    // ruby text 的 Y 偏移
}

function layoutRuby(
  baseText: string,
  rtText: string,
  baseFontSize: number,
  rtFontSize: number
): RubyLayout {
  // 1. 测量 base 和 rt 的宽度
  // 2. 计算 overhang
  // 3. 计算 Y 偏移（rt 在 base 上方）
  // 4. 返回布局结果
}
```

### 5. 滚动位置恢复

**决定：** 保留现有的 locator 映射机制。

**实现：**
```typescript
// 初始位置
const initialBlockIndex = findReaderBlockIndex(blocks, savedLocator);
const initialBlock = layout.blocks[initialBlockIndex];
const initialScrollY = initialBlock?.y ?? 0;

// 滚动到初始位置
useEffect(() => {
  if (layout && initialScrollY > 0) {
    scrollRef.current?.scrollTo({ y: initialScrollY, animated: false });
  }
}, [layout, initialScrollY]);

// 保存当前位置
const currentBlockIndex = useMemo(() => {
  const visibleY = scrollY.value + screenHeight / 2;
  return layout.blocks.findIndex(
    (block) => block.y <= visibleY && block.y + block.height > visibleY
  );
}, [scrollY, layout]);

const currentLocator = layout.blocks[currentBlockIndex]?.locator;
```

## 性能考虑

### 1. 测量缓存

```typescript
// 布局结果缓存
const layoutCache = new Map<string, LayoutChapterResult>();

function getLayoutCacheKey(options: LayoutChapterOptions): string {
  return JSON.stringify({
    blockIds: options.blocks.map((b) => b.id),
    width: options.width,
    theme: options.theme,
    fontFamily: options.fontFamily,
  });
}
```

### 2. 虚拟化渲染（第二阶段）

如果第一阶段发现性能问题，实施虚拟化：

```typescript
function getVisibleBlocks(
  blocks: LayoutBlock[],
  scrollY: number,
  viewportHeight: number
): LayoutBlock[] {
  const buffer = viewportHeight; // 上下各一屏的 buffer
  const start = scrollY - buffer;
  const end = scrollY + viewportHeight + buffer;

  return blocks.filter(
    (block) => block.y + block.height >= start && block.y <= end
  );
}
```

### 3. Canvas 尺寸限制

- iOS: 最大 Canvas 尺寸约 16384 x 16384
- Android: 取决于设备，通常 8192 x 8192
- 如果章节超过限制，自动切换到虚拟化模式

## 迁移清单

### Phase 1: 基础设施

1. 添加 `@shopify/react-native-skia` 依赖
2. 创建 `packages/reader-layout` 包
3. 实现核心类型定义
4. 实现 HTML parser（复用现有的 `normalizeNovelBlocks`）

### Phase 2: 样式和布局

1. 实现 StyleResolver（迁移旧 Flutter class preset）
2. 实现 Block layout（Skia Paragraph 测量）
3. 实现 Ruby layout
4. 实现 Image layout

### Phase 3: 渲染和交互

1. 实现 ReaderSkiaCanvas 组件
2. 实现 hit testing（脚注、图片点击）
3. 集成字体加载
4. 集成主题系统

### Phase 4: 替换和验证

1. 修改 reader-screen.tsx
2. 保留现有导航、进度保存逻辑
3. 测试基本渲染
4. 测试交互功能

### Phase 5: 完善和优化

1. 真机性能测试
2. 边缘情况处理
3. 错误处理和降级
4. 文档和注释

## 回退策略

如果 Skia 方案出现严重问题：

1. **Git revert**：版本控制提供了安全的回退路径
2. **保留的兼容性**：
   - `NovelReaderBlock` 类型不变
   - locator 映射不变
   - 阅读进度保存机制不变
3. **问题隔离**：只有渲染层改变，数据层完全复用

## 测试策略

### 单元测试

```typescript
// packages/reader-layout/src/__tests__/
describe('layoutChapter', () => {
  it('should layout simple paragraph', () => {
    const result = layoutChapter({
      blocks: [{ id: '1', locator: '/p[1]', html: '<p>Hello</p>', ... }],
      width: 300,
      theme: defaultTheme,
      fontFamily: 'System',
    });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].height).toBeGreaterThan(0);
  });

  it('should handle Ruby annotation', () => {
    // ...
  });
});
```

### 集成测试

- 在 iPhone 17 Pro 模拟器测试
- 使用 Instruments 监控性能
- 测试不同长度章节（2万、5万、10万像素）

### 视觉回归测试

- 截图对比（Skia vs WebView）
- 确保样式一致性

# Skia 自绘阅读器 - 实施检查清单

## Phase 1: 基础设施搭建

### 1.1 添加依赖

- [ ] 添加 `@shopify/react-native-skia` 到 `apps/mobile/package.json`
  ```bash
  cd apps/mobile
  npx expo install @shopify/react-native-skia
  ```
- [ ] 运行 `npx expo prebuild` 重新生成原生项目
- [ ] 验证依赖安装成功
  ```bash
  npm run typecheck
  ```

### 1.2 创建 reader-layout 包

- [ ] 创建包目录结构
  ```bash
  mkdir -p packages/reader-layout/src
  ```
- [ ] 创建 `packages/reader-layout/package.json`
  - 依赖：`@shopify/react-native-skia`, `htmlparser2`
  - 脚本：`typecheck`, `test`
- [ ] 创建 `packages/reader-layout/tsconfig.json`
  - 继承项目根 tsconfig
  - 输出到 `dist/`
- [ ] 在根 `package.json` 添加 workspace 引用
- [ ] 创建 `packages/reader-layout/README.md`

### 1.3 定义核心类型

- [ ] 创建 `packages/reader-layout/src/types.ts`
  - `LayoutBlock` - 布局块
  - `HitRect` - 交互区域
  - `ReaderTheme` - 主题配置
  - `LayoutChapterOptions` - 布局选项
  - `LayoutChapterResult` - 布局结果
  - `TextStyle` - 文本样式
  - `RubyLayout` - Ruby 注音布局
- [ ] 导出类型到 `src/index.ts`
- [ ] 运行 TypeScript 检查
  ```bash
  cd packages/reader-layout
  npm run typecheck
  ```

## Phase 2: 样式解析器

### 2.1 实现 StyleResolver

- [ ] 创建 `packages/reader-layout/src/style-resolver.ts`
- [ ] 定义基础样式规则（p, div, h1-h6, blockquote, center）
- [ ] 迁移旧 Flutter 的 class preset 规则
  - [ ] `pius1`, `pius2`, `ph4` - 字号缩放
  - [ ] `emXX` 系列 - em10, em12, em14 等
  - [ ] `right`, `left`, `center` - 对齐方式
  - [ ] `zin` - 首行缩进
  - [ ] `bold`, `ita` - 字重和斜体
  - [ ] `stress`, `author`, `message` - 特殊语义样式
  - [ ] `cut-line`, `meg` - 分隔线和边距
  - [ ] `lh` - 行高调整
  - [ ] `m0`, `p0` - 边距清除
  - [ ] 颜色 class - `color-*` 系列
  - [ ] `fl`, `fr` - float left/right
- [ ] 实现样式继承和合并逻辑
- [ ] 单元测试：验证每个 preset 输出正确样式

### 2.2 HTML 解析

- [ ] 创建 `packages/reader-layout/src/html-parser.ts`
- [ ] 复用 `@novella/reader-engine` 的 `normalizeNovelBlocks()`
- [ ] 实现 HTML → AST 转换
- [ ] 提取节点的 class、style 属性
- [ ] 单元测试：解析各种 HTML 结构

## Phase 3: 布局引擎

### 3.1 Skia Paragraph 封装

- [ ] 创建 `packages/reader-layout/src/skia-paragraph.ts`
- [ ] 封装 Skia.ParagraphBuilder API
- [ ] 实现字体注册（自定义字体支持）
- [ ] 实现文本测量（`getHeight()`, line metrics）
- [ ] 缓存已创建的 Paragraph 对象
- [ ] 单元测试：测量简单段落

### 3.2 Block 布局

- [ ] 创建 `packages/reader-layout/src/block-layout.ts`
- [ ] 实现 `layoutParagraph()` - 段落布局
- [ ] 实现 `layoutHeading()` - 标题布局
- [ ] 实现 `layoutBlockquote()` - 引用块布局
- [ ] 实现 Y 偏移计算（cumulative offset）
- [ ] 实现段落间距处理
- [ ] 单元测试：验证布局高度和偏移

### 3.3 Ruby 注音布局

- [ ] 创建 `packages/reader-layout/src/ruby-layout.ts`
- [ ] 解析 `<ruby>` 标签（base + rt）
- [ ] 测量 base 和 rt 的宽度
- [ ] 计算 overhang（ruby 比 base 宽时）
- [ ] 计算 Y 偏移（rt 在 base 上方）
- [ ] 生成 RubyLayout 结果
- [ ] 单元测试：验证 ruby 布局正确

### 3.4 图片布局

- [ ] 创建 `packages/reader-layout/src/image-layout.ts`
- [ ] 解析 `<img>` 标签（src, width, height, alt）
- [ ] 实现图片比例预解析（从服务器或缓存获取）
- [ ] 计算图片实际显示尺寸（fit within width）
- [ ] inline image vs standalone illustration 处理
- [ ] float left/right 图片布局
- [ ] 单元测试：验证图片尺寸计算

### 3.5 主布局入口

- [ ] 创建 `packages/reader-layout/src/layout-chapter.ts`
- [ ] 实现 `layoutChapter()` 主函数
  1. 解析 HTML → AST
  2. 应用样式规则（StyleResolver）
  3. 布局每个 block
  4. 计算总高度
  5. 提取 hit rects（脚注、图片、链接）
- [ ] 实现布局缓存机制（cache key 生成）
- [ ] 集成测试：完整章节布局

## Phase 4: Skia Canvas 渲染

### 4.1 创建 ReaderSkiaCanvas 组件

- [ ] 创建 `apps/mobile/src/components/reader-skia-canvas.tsx`
- [ ] 实现 Canvas 容器（width, height）
- [ ] 实现 BlockRenderer 子组件
  - [ ] 渲染段落（Skia Paragraph）
  - [ ] 渲染标题
  - [ ] 渲染图片（Skia Image）
  - [ ] 渲染 Ruby 注音
  - [ ] 渲染 blockquote
- [ ] 实现 hit testing（点击/长按检测）
- [ ] 实现脚注点击处理
- [ ] 实现图片点击/长按处理

### 4.2 字体加载集成

- [ ] 在 `layoutChapter()` 中集成字体
- [ ] 使用 `readerFontDataUrl` 注册自定义字体到 Skia
- [ ] 测试自定义字体渲染
- [ ] 测试系统字体 fallback

### 4.3 主题集成

- [ ] 传递 ReaderTheme 到 Canvas
- [ ] 应用背景色、文本色
- [ ] 应用字号、行高
- [ ] 应用边距（top, bottom, side）
- [ ] 应用首行缩进
- [ ] 测试主题切换（深色/浅色）

## Phase 5: 替换 WebView

### 5.1 修改 reader-screen.tsx

- [ ] 导入 `layoutChapter` 和 `ReaderSkiaCanvas`
- [ ] 添加布局计算逻辑（useMemo）
- [ ] 替换 `NovellaReadiumView` 为 Skia 实现
  - [ ] 用 `Animated.ScrollView` 包裹 Canvas
  - [ ] 设置 `contentContainerStyle` 边距
  - [ ] 渲染 `ReaderSkiaCanvas`
- [ ] 保留现有的错误和加载状态处理
- [ ] 保留现有的导航组件
- [ ] 保留现有的脚注和图片预览组件

### 5.2 滚动位置管理

- [ ] 实现 `useScrollOffset()` 集成
  ```typescript
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  ```
- [ ] 实现初始位置恢复
  - [ ] 根据 saved locator 找到初始 block
  - [ ] 计算初始 scrollY（block.y）
  - [ ] `scrollTo()` 到初始位置
- [ ] 实现当前位置跟踪
  - [ ] 根据 scrollY 计算当前可见 block
  - [ ] 更新当前 locator
  - [ ] 调用 `schedulePosition()` 保存进度

### 5.3 保留现有功能

- [ ] 脚注点击 → 原生 Sheet（复用现有 `presentReaderFootnote`）
- [ ] 图片预览 → 原生弹窗（复用现有 `ReaderImagePreview`）
- [ ] 章节导航（上一章/下一章）
- [ ] 阅读设置实时生效
- [ ] 导航栏隐藏/显示
- [ ] 章节预加载

## Phase 6: 测试和验证

### 6.1 基础功能测试

- [ ] 模拟器测试：iPhone 17 Pro
  - [ ] 渲染简单章节（纯文本）
  - [ ] 渲染复杂章节（标题、Ruby、图片）
  - [ ] 滚动流畅度
  - [ ] 脚注点击
  - [ ] 图片预览
  - [ ] 阅读进度保存和恢复
- [ ] Android 模拟器测试（如有）
  - [ ] 基本渲染正常
  - [ ] 交互正常

### 6.2 样式兼容性测试

- [ ] 测试所有 class preset
  - [ ] `pius1`, `pius2` 字号正确
  - [ ] `emXX` 系列正确
  - [ ] 对齐方式（left/right/center）
  - [ ] `bold`, `ita` 字重和斜体
  - [ ] 颜色 class
- [ ] 测试 Ruby 注音显示
- [ ] 测试图片显示（inline, standalone, float）
- [ ] 对比 WebView 和 Skia 渲染结果（截图对比）

### 6.3 主题和设置测试

- [ ] 深色/浅色主题切换
- [ ] 字号调整（14-24）
- [ ] 行高调整
- [ ] 首行缩进开关
- [ ] 边距调整
- [ ] 设置实时生效（无需重新加载章节）

### 6.4 性能测试

- [ ] 模拟器性能（使用 Instruments 或调试工具）
  - [ ] 2 万像素章节：FPS、内存、加载时间
  - [ ] 5 万像素章节：FPS、内存、加载时间
  - [ ] 10 万像素章节：FPS、内存、加载时间
- [ ] 记录性能数据
- [ ] 如有明显问题，准备虚拟化方案

### 6.5 边缘情况测试

- [ ] 空章节
- [ ] 超长段落（不拆分段落的 fallback）
- [ ] 大量图片章节
- [ ] 复杂嵌套 HTML
- [ ] 网络图片加载失败
- [ ] 字体加载失败

## Phase 7: 真机验证

### 7.1 用户真机测试

- [ ] 用户在真机上安装测试版本
- [ ] 测试之前无法加载章节的设备
- [ ] 测试基本功能
- [ ] 测试性能表现
- [ ] 收集用户反馈

### 7.2 问题修复

- [ ] 根据真机测试反馈修复问题
- [ ] 性能优化（如需要）
- [ ] 边缘情况处理

## Phase 8: 完善和文档

### 8.1 代码质量

- [ ] 运行 TypeScript 类型检查
  ```bash
  npm run typecheck
  ```
- [ ] 运行 ESLint
  ```bash
  npm run lint
  ```
- [ ] 添加关键逻辑的单元测试
  - [ ] StyleResolver 测试
  - [ ] Block layout 测试
  - [ ] Ruby layout 测试
  - [ ] locator 映射测试

### 8.2 文档更新

- [ ] 更新 `packages/reader-layout/README.md`
- [ ] 添加 API 文档（JSDoc 注释）
- [ ] 更新可行性研究文档为最终设计文档
- [ ] 添加迁移说明（WebView → Skia）

### 8.3 清理

- [ ] 删除未使用的代码
- [ ] 清理调试日志
- [ ] 清理临时文件

## 验证命令

### TypeScript 类型检查
```bash
cd packages/reader-layout && npm run typecheck
cd apps/mobile && npm run typecheck
```

### 运行测试
```bash
cd packages/reader-layout && npm test
```

### 启动开发服务器
```bash
cd apps/mobile && npm run dev
```

### iOS 模拟器
```bash
cd apps/mobile && npm run ios
```

### Android 模拟器
```bash
cd apps/mobile && npm run android
```

## 回退路径

如果遇到严重问题，可以通过 Git 快速回退：

```bash
# 查看当前分支
git status

# 回退到上一个提交
git reset --hard HEAD~1

# 或者回退到特定提交
git reset --hard <commit-hash>

# 强制推送（如果已经推送到远程）
git push -f origin main
```

## 风险点和缓解措施

| 风险 | 缓解措施 |
|------|---------|
| 样式不一致 | 对比 WebView 截图，逐个 class preset 验证 |
| Ruby 排版错误 | 参考旧 Flutter 实现，单元测试覆盖 |
| 图片加载失败 | 实现错误处理和 placeholder |
| 长章节性能问题 | 模拟器测试 + 真机验证，准备虚拟化方案 |
| 字体加载失败 | 实现 fallback 到系统字体 |
| 滚动位置不准确 | 使用 block Y 偏移精确定位 |

## 下一步

完成所有检查清单后：
1. 运行 `python3 ./.trellis/scripts/task.py start` 进入实施阶段
2. 按照 Phase 1-8 顺序实施
3. 每完成一个 Phase，运行相应的验证命令
4. 遇到问题及时记录和解决
5. 真机验证通过后，准备发布

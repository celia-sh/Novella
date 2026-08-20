# @novella/reader-layout

Skia-based layout engine for Novella reader.

## Overview

This package provides deterministic layout for novel chapters using Skia's paragraph API. It converts HTML blocks into measurable, renderable layout trees that can be drawn with React Native Skia.

## Architecture

```
HTML Blocks (from reader-engine)
    ↓
HTML Parser → AST
    ↓
Style Resolver (apply class presets)
    ↓
Block Layout (measure with Skia Paragraph)
    ↓
LayoutBlock[] (ready for rendering)
```

## Key Features

- **Block-level layout**: Each block is measured as a unit (paragraph, heading, image, etc.)
- **Style presets**: Preserves legacy class-based styling from the old Flutter reader
- **Skia integration**: Uses Skia Paragraph API for consistent measurement and rendering
- **Hit testing**: Extracts interaction areas for footnotes, images, and links

## Usage

```typescript
import { layoutChapter } from '@novella/reader-layout';

const result = layoutChapter({
  blocks: novelReaderBlocks,
  width: screenWidth - sidePadding * 2,
  theme: {
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    fontSize: 18,
    lineHeight: 32,
    topPadding: 20,
    bottomPadding: 20,
    sidePadding: 16,
    firstLineIndent: true,
  },
  fontFamily: 'CustomFont',
  fontDataUrl: 'data:font/woff2;base64,...',
});

// Use result.blocks for rendering
// result.totalHeight for scroll container
// result.blockHeights for legacy pagination
```

## Style Presets

This package preserves the class-based styling from the old Flutter reader:

- `pius1`, `pius2`, `ph4` - Large heading styles
- `emXX` - Font size scaling (em10, em12, em14, etc.)
- `bold`, `ita` - Font weight and style
- `right`, `left`, `center` - Text alignment
- `zin` - Zero indent
- `stress`, `author`, `message`, `meg` - Semantic styles
- `cut-line`, `lh`, `m0`, `p0` - Layout adjustments
- `fl`, `fr`, `cl`, `cr`, `cb` - Float and clear
- `vt`, `vb`, `vm` - Vertical alignment
- Color classes: `red`, `green`, `blue`, `black`, `white`
- `dot`, `em-dot` - Text decoration

See `style-resolver.ts` for the complete list.

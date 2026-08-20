import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractReaderImages,
  parseSystemImageDimensions,
  resolveReaderImageFrame,
} from '../image-layout.ts';
import { StyleResolver } from '../style-resolver.ts';
import {
  addPuaLineBreakOpportunities,
  createRenderableParagraphText,
  decodeReaderLayoutTextEntities,
} from '../text-layout.ts';
import { pageChapter, tileChapter } from '../tile-chapter.ts';
import type { LayoutBlock, LayoutChapterResult, ReaderTheme } from '../types.ts';

const theme: ReaderTheme = {
  backgroundColor: '#fff',
  textColor: '#111',
  fontSize: 18,
  lineHeight: 1.6,
  topPadding: 20,
  bottomPadding: 30,
  sidePadding: 24,
  firstLineIndent: true,
};

test('StyleResolver keeps line-height as a multiplier', () => {
  const resolver = new StyleResolver(theme);
  const paragraph = resolver.resolve({
    tag: 'p',
    classes: [],
    attributes: {},
    children: [],
  });
  const message = resolver.resolve({
    tag: 'p',
    classes: ['message'],
    attributes: {},
    children: [],
  });
  const inlinePixels = resolver.resolve({
    tag: 'p',
    classes: [],
    attributes: { style: 'font-size: 18px; line-height: 36px' },
    children: [],
  });

  assert.equal(paragraph.lineHeight, 1.6);
  assert.equal(message.lineHeight, 1.2);
  assert.equal(inlinePixels.lineHeight, 2);
});

test('heading classes never participate in first-line indent', () => {
  const resolver = new StyleResolver(theme);
  for (const className of ['pius1', 'pius2', 'ph4', 'title', 'chapter-title']) {
    const style = resolver.resolve({
      tag: 'p',
      classes: [className],
      attributes: {},
      children: [],
    });
    assert.equal(style.textIndent, 0, `${className} must not be indented`);
  }
});

test('inline footnotes use compact text without first-line indent', () => {
  const style = new StyleResolver(theme).resolve({
    tag: 'aside',
    classes: ['nv-inline-footnote'],
    attributes: {},
    children: [],
  });
  assert.equal(style.fontSize, theme.fontSize * 0.82);
  assert.equal(style.lineHeight, 1.5);
  assert.equal(style.textIndent, 0);
});

test('reader text entities materialize private-use codepoints before layout', () => {
  const supplementaryPua = String.fromCodePoint(0xF0001);
  assert.equal(
    decodeReaderLayoutTextEntities(
      `甲&#57345;&#xE002;&\u200B#\u200BX\u200BE003;&amp;&unknown;&#983041;`,
    ),
    `甲\uE001\uE002\uE003&&unknown;${supplementaryPua}`,
  );
});

test('PUA glyphs receive layout-only line-break opportunities', () => {
  const plane15 = String.fromCodePoint(0xF0001);
  const plane16 = String.fromCodePoint(0x100001);
  assert.equal(
    addPuaLineBreakOpportunities(`甲\uE001\uE002乙 ${plane15}${plane16}`),
    `甲\u200B\uE001\u200B\uE002\u200B乙 ${plane15}\u200B${plane16}`,
  );
  assert.equal(
    addPuaLineBreakOpportunities(`\uE001\u200B\uE002`),
    `\uE001\u200B\uE002`,
  );
  assert.equal(addPuaLineBreakOpportunities('普通汉字 Latin'), '普通汉字 Latin');
});

test('measurement and paint share PUA wrapping and first-line indent text', () => {
  assert.equal(
    createRenderableParagraphText(`\uE001\uE002`, true),
    `\u3000\u3000\uE001\u200B\uE002`,
  );
});

test('image layout keeps authored geometry and a stable fallback frame', () => {
  const images = extractReaderImages(`
    <div class="illus">
      <img src="/art.png?x=1&amp;y=2" alt="插图" width="600" height="900">
      <img class="footnote" src="/note.png">
    </div>
  `);
  assert.equal(images.length, 1);
  const authored = resolveReaderImageFrame(images[0]!, 300, {});
  assert.equal(authored.image.url, '/art.png?x=1&y=2');
  assert.equal(authored.image.aspectRatio, 2 / 3);
  assert.deepEqual(
    { width: authored.image.width, height: authored.image.height, x: authored.x },
    { width: 300, height: 450, x: 0 },
  );

  const [unknown] = extractReaderImages('<img src="/unknown.webp" class="no-preview">');
  const fallback = resolveReaderImageFrame(unknown!, 320, {});
  assert.equal(fallback.image.height, 480);
  assert.equal(fallback.image.previewable, false);
});

test('system image URL metadata prevents greedy full-width placeholders', () => {
  const [image] = extractReaderImages(
    '<img src="https://img.example/art.webp?placeholder=hash&amp;size=120x80">',
  );
  assert.deepEqual(
    parseSystemImageDimensions(image!.src),
    { width: 120, height: 80 },
  );

  const frame = resolveReaderImageFrame(image!, 320, {
    [image!.src]: { width: 600, height: 900 },
  });
  assert.deepEqual(
    { width: frame.image.width, height: frame.image.height, x: frame.x },
    { width: 120, height: 80, x: 100 },
  );
  assert.equal(frame.image.aspectRatio, 1.5);
});

test('system image size requires the complete URL metadata contract', () => {
  assert.equal(parseSystemImageDimensions('/art.webp?size=120x80'), null);
  assert.equal(
    parseSystemImageDimensions('/art.webp?placeholder=hash&size=0x80'),
    null,
  );
});

test('scroll tiles preserve the complete document coordinate range', () => {
  const layout = createLayout([
    createBlock('a', 20, 80),
    createBlock('b', 112, 80),
    createBlock('c', 260, 90),
  ], 400);
  const result = tileChapter(layout, 200);

  assert.deepEqual(result.tiles.map((tile) => ({
    y: tile.y,
    height: tile.height,
    ids: tile.blocks.map((block) => block.id),
  })), [
    { y: 0, height: 260, ids: ['a', 'b'] },
    { y: 260, height: 140, ids: ['c'] },
  ]);
  assert.equal(result.tiles.reduce((sum, tile) => sum + tile.height, 0), 400);
});

test('paged plan repeats chrome insets and keeps block order', () => {
  const layout = createLayout([
    createBlock('a', 20, 100),
    createBlock('b', 132, 100),
    createBlock('c', 244, 100),
  ], 380);
  const result = pageChapter(layout, {
    pageHeight: 220,
    topPadding: 40,
    bottomPadding: 40,
  });

  assert.deepEqual(result.tiles.map((page) => ({
    height: page.height,
    contentOffsetY: page.contentOffsetY,
    ids: page.blocks.map((block) => block.id),
  })), [
    { height: 220, contentOffsetY: 40, ids: ['a'] },
    { height: 220, contentOffsetY: 40, ids: ['b'] },
    { height: 220, contentOffsetY: 40, ids: ['c'] },
  ]);
  assert.equal(result.totalHeight, 660);
});

function createLayout(blocks: LayoutBlock[], totalHeight: number): LayoutChapterResult {
  return { blocks, totalHeight, blockHeights: {} };
}

function createBlock(id: string, y: number, height: number): LayoutBlock {
  return {
    id,
    locator: `//*/p[${id}]`,
    type: 'paragraph',
    x: 0,
    y,
    width: 300,
    height,
    hitRects: [],
  };
}

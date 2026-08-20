import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractReaderImages,
  resolveReaderImageFrame,
} from '../image-layout.ts';
import { StyleResolver } from '../style-resolver.ts';
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

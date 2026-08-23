import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractReaderImages,
  parseSystemImageDimensions,
  resolveReaderImageFrame,
} from '../image-layout.ts';
import { parseReaderBlockContent } from '../inline-layout.ts';
import { StyleResolver } from '../style-resolver.ts';
import {
  addBreakAllLineBreakOpportunities,
  addPuaLineBreakOpportunities,
  createRenderableParagraphText,
  decodeReaderLayoutTextEntities,
  shouldAddLineBreakOpportunityBetween,
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

test('StyleResolver matches reader heading alignment and authored zero indent', () => {
  const resolver = new StyleResolver(theme);
  const heading = resolver.resolve({
    tag: 'h1',
    classes: [],
    attributes: {},
    children: [],
  });
  assert.equal(heading.fontSize, theme.fontSize * 1.65);
  assert.equal(heading.textAlign, 'center');
  assert.equal(heading.marginTop, heading.fontSize! * 0.1);

  const paragraph = resolver.resolve({
    tag: 'p',
    classes: [],
    attributes: { align: 'justify', style: 'text-indent: 0; margin: 1em 2em' },
    children: [],
  });
  assert.equal(paragraph.textAlign, 'justify');
  assert.equal(paragraph.textIndent, 0);
  assert.equal(paragraph.marginTop, theme.fontSize);
  assert.equal(paragraph.marginRight, theme.fontSize * 2);
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

test('dash-break adds layout-only opportunities between every visible glyph', () => {
  assert.equal(
    addBreakAllLineBreakOpportunities('AB 中文'),
    `A\u200BB 中\u200B文`,
  );
});

test('styled run boundaries retain PUA and break-all opportunities', () => {
  assert.equal(shouldAddLineBreakOpportunityBetween('\uE001', '\uE002'), true);
  assert.equal(shouldAddLineBreakOpportunityBetween('A', 'B'), false);
  assert.equal(shouldAddLineBreakOpportunityBetween('A', 'B', true), true);
  assert.equal(shouldAddLineBreakOpportunityBetween('A', ' '), false);
});

test('measurement and paint share PUA wrapping and first-line indent text', () => {
  assert.equal(
    createRenderableParagraphText(`\uE001\uE002`, true),
    `\u3000\u3000\uE001\u200B\uE002`,
  );
});

test('inline parser removes rp fallback and keeps annotation above its base token', () => {
  const parsed = parseReaderBlockContent(
    '<p>前<ruby>漢<rp>（</rp><rt>かん</rt><rp>）</rp></ruby>後</p>',
    new StyleResolver(theme),
  );
  assert.equal(parsed.text, '前漢後');
  assert.deepEqual(parsed.runs.map(stripRunStyle), [
    { type: 'text', text: '前' },
    { type: 'ruby', baseText: '漢', annotationText: 'かん' },
    { type: 'text', text: '後' },
  ]);
});

test('inline parser preserves multiple Ruby pairs as separate wrap units', () => {
  const parsed = parseReaderBlockContent(
    '<p><ruby><span>東</span><rt>とう</rt>京<rt>きょう</rt></ruby>へ</p>',
    new StyleResolver(theme),
  );
  assert.deepEqual(parsed.runs.map(stripRunStyle), [
    { type: 'ruby', baseText: '東', annotationText: 'とう' },
    { type: 'ruby', baseText: '京', annotationText: 'きょう' },
    { type: 'text', text: 'へ' },
  ]);
});

test('inline parser preserves hard breaks, pre whitespace, and nested emphasis', () => {
  const resolver = new StyleResolver(theme);
  const paragraph = parseReaderBlockContent(
    '<p>甲<br><strong>乙</strong><span class="dot">丙</span></p>',
    resolver,
  );
  assert.deepEqual(paragraph.runs.map(stripRunStyle), [
    { type: 'text', text: '甲' },
    { type: 'break', kind: 'hard' },
    { type: 'text', text: '乙' },
    { type: 'text', text: '丙' },
  ]);
  const bold = paragraph.runs.find((run) => run.type === 'text' && run.text === '乙');
  const dotted = paragraph.runs.find((run) => run.type === 'text' && run.text === '丙');
  assert.equal(bold?.style.fontWeight, 'bold');
  assert.equal(dotted?.style.textDecoration, 'underline');
  assert.equal(dotted?.style.textDecorationStyle, 'dotted');

  const pre = parseReaderBlockContent('<pre>  A\n B</pre>', resolver);
  assert.equal(pre.text, '  A\n B');
});

test('inline parser resolves editor underline, strike, subscript and superscript', () => {
  const parsed = parseReaderBlockContent(
    '<p><u>甲</u><s>乙</s><sub>2</sub><sup>3</sup></p>',
    new StyleResolver(theme),
  );
  const textRuns = parsed.runs.filter((run) => run.type === 'text');
  assert.equal(textRuns[0]?.style.textDecoration, 'underline');
  assert.equal(textRuns[1]?.style.textDecoration, 'line-through');
  assert.equal(textRuns[2]?.style.verticalAlign, 'sub');
  assert.equal(textRuns[3]?.style.verticalAlign, 'super');
  assert.equal(textRuns[2]?.style.fontSize, theme.fontSize * 0.75);
});

test('inline parser preserves every top-level inline sibling', () => {
  const parsed = parseReaderBlockContent(
    '<span class="bold">甲</span> 与 <i>乙</i>',
    new StyleResolver(theme),
  );
  assert.equal(parsed.text, '甲 与 乙');
  assert.equal(parsed.runs[0]?.style.fontWeight, 'bold');
  assert.equal(parsed.runs.at(-1)?.style.fontStyle, 'italic');
});

test('inline parser keeps image order and inherited CSS styles', () => {
  const parsed = parseReaderBlockContent(
    '<p align="right">前<img src="/icon.png" width="20" height="10">后</p>',
    new StyleResolver(theme),
    { parseImageTag: (tag) => extractReaderImages(tag)[0] ?? null },
  );
  assert.equal(parsed.rootStyle.textAlign, 'right');
  assert.deepEqual(parsed.runs.map(stripRunStyle), [
    { type: 'text', text: '前' },
    { type: 'image', image: parsed.runs[1]?.type === 'image' ? parsed.runs[1].image : null },
    { type: 'text', text: '后' },
  ]);
  assert.equal(parsed.runs[1]?.type === 'image' ? parsed.runs[1].image.width : null, 20);
});

test('inline parser keeps figure images block-sized before their caption', () => {
  const parsed = parseReaderBlockContent(
    '<figure><img src="/art.png"><figcaption>说明</figcaption></figure>',
    new StyleResolver(theme),
    { parseImageTag: (tag) => extractReaderImages(tag)[0] ?? null },
  );
  const image = parsed.runs.find((run) => run.type === 'image');
  assert.equal(image?.type === 'image' ? image.image.blockDisplay : false, true);
  assert.equal(parsed.runs.some((run) => run.type === 'break'), true);
  assert.equal(parsed.text.endsWith('说明'), true);
});

test('inline parser preserves table rows and cell image order', () => {
  const parsed = parseReaderBlockContent(
    '<table><tr><td>甲</td><td><img src="/a.png" width="10" height="20"></td></tr>' +
      '<tr><td>乙</td><td>丙</td></tr></table>',
    new StyleResolver(theme),
    { parseImageTag: (tag) => extractReaderImages(tag)[0] ?? null },
  );
  assert.equal(parsed.runs.filter((run) => run.type === 'image').length, 1);
  assert.equal(parsed.runs.filter((run) => run.type === 'break').length, 1);
  assert.match(parsed.text, /甲[\s\S]*\n[\s\S]*乙/);
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

  const [floating] = extractReaderImages(
    '<img src="/float.webp" class="fr" style="width: 50%">',
  );
  assert.equal(floating?.float, 'right');
  assert.equal(floating?.widthFraction, 0.5);

  const [unknown] = extractReaderImages('<img src="/unknown.webp" class="no-preview">');
  const fallback = resolveReaderImageFrame(unknown!, 320, {});
  assert.equal(fallback.image.height, 480);
  assert.equal(fallback.image.previewable, false);
});

test('CSS image dimensions preserve authored percentage geometry', () => {
  const [image] = extractReaderImages(
    '<img src="/half.png" style="width: 50%; height: 80px">',
  );
  const frame = resolveReaderImageFrame(image!, 320, {});
  assert.deepEqual(
    { width: frame.image.width, height: frame.image.height, x: frame.x },
    { width: 160, height: 80, x: 80 },
  );
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

test('paged plan combines two pages into one translated spread', () => {
  const layout = createLayout([
    createBlock('a', 20, 100),
    createBlock('b', 132, 100),
    createBlock('c', 244, 100),
  ], 380);
  const result = pageChapter(layout, {
    columnWidth: 200,
    columns: 2,
    pageHeight: 220,
    topPadding: 40,
    bottomPadding: 40,
  });

  assert.deepEqual(result.tiles.map((page) => ({
    ids: page.blocks.map((block) => block.id),
    x: page.blocks.map((block) => block.x),
    y: page.blocks.map((block) => block.y),
  })), [
    { ids: ['a', 'b'], x: [0, 200], y: [20, 20] },
    { ids: ['c'], x: [0], y: [244] },
  ]);
  assert.equal(result.totalHeight, 440);
});

test('translated spreads move inline ruby once with the block origin', () => {
  const rubyStyle = {
    color: '#111827',
    fontFamily: 'System',
    fontSize: 20,
    lineHeight: 1.6,
  };
  const layout = createLayout([
    createBlock('a', 20, 100),
    {
      ...createBlock('b', 132, 100),
      hitRects: [{
        height: 10,
        id: 'note',
        type: 'footnote',
        width: 10,
        x: 3,
        y: 132,
      }],
      ruby: [{
        annotationText: 'かん',
        baseHeight: 20,
        baseText: '漢',
        baseWidth: 20,
        baseY: 8,
        rtHeight: 10,
        rtText: 'かん',
        rtWidth: 20,
        rtY: 0,
        style: rubyStyle,
        totalHeight: 30,
        totalWidth: 20,
        x: 12,
      }],
    },
  ], 244);
  const result = pageChapter(layout, {
    columnWidth: 200,
    columns: 2,
    pageHeight: 220,
    topPadding: 40,
    bottomPadding: 40,
  });
  const translated = result.tiles[0]?.blocks[1];

  assert.equal(translated?.x, 200);
  assert.equal(translated?.y, 20);
  assert.deepEqual(translated?.ruby?.[0], {
    annotationText: 'かん',
    baseHeight: 20,
    baseText: '漢',
    baseWidth: 20,
    baseY: 8,
    rtHeight: 10,
    rtText: 'かん',
    rtWidth: 20,
    rtY: 0,
    style: rubyStyle,
    totalHeight: 30,
    totalWidth: 20,
    x: 12,
  });
  assert.deepEqual(translated?.hitRects[0], {
    height: 10,
    id: 'note',
    type: 'footnote',
    width: 10,
    x: 203,
    y: 20,
  });
});

function stripRunStyle(
  run: ReturnType<typeof parseReaderBlockContent>['runs'][number],
): Omit<typeof run, 'style'> {
  const { style: _style, ...plain } = run;
  return plain;
}

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

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateReaderProgress,
  createComicPageSlots,
  createReaderPagePlan,
  createReaderPositionWriteQueue,
  findReaderBlockIndex,
  getReaderBlockLayout,
  inlineNovelFootnotesAfterBlocks,
  mergeComicPageBatch,
  normalizeNovelBlocks,
  processNovelFootnotes,
  getAdjacentChapterSortNum,
  resolveReaderInitialIndex,
  resolveReaderRestorePosition,
  sanitizeNovelHtml,
} from './index.ts';

test('normalizes nested novel blocks with server-compatible locators', () => {
  const blocks = normalizeNovelBlocks(
    '<head><style>.hidden{display:none}</style></head><div><p>第一段</p><p><ruby>漢<rt>かん</rt></ruby>字</p></div>',
  );

  assert.deepEqual(blocks.map((block) => block.locator), ['//*/div[1]/p[1]', '//*/div[1]/p[2]']);
  assert.equal(blocks[1].imageCount, 0);
  assert.match(blocks[1].html, /ruby/);
  assert.equal(blocks[0].id, 'block://*/div[1]/p[1]');
});

test('preserves quote/center containers and list marker metadata', () => {
  const blocks = normalizeNovelBlocks(
    '<blockquote><p>引用一</p><p>引用二</p></blockquote>' +
      '<center><p>居中</p></center>' +
      '<ol start="3"><li>甲</li><li value="8">乙</li></ol>' +
      '<ul><li>丙</li></ul>',
  );

  assert.equal(blocks[0].locator, '//*/blockquote[1]');
  assert.match(blocks[0].html, /^<blockquote>/);
  assert.equal(blocks[1].locator, '//*/center[1]');
  assert.deepEqual(
    blocks.slice(2).map(({ listDepth, listMarker }) => ({ listDepth, listMarker })),
    [
      { listDepth: 1, listMarker: '3.' },
      { listDepth: 1, listMarker: '8.' },
      { listDepth: 1, listMarker: '•' },
    ],
  );
});

test('preserves standalone illustration containers for native image layout', () => {
  const blocks = normalizeNovelBlocks(
    '<div class="duokan-image-single"><img src="/cover.jpg" width="100" height="160"></div><p>正文</p>',
  );

  assert.equal(blocks[0].locator, '//*/div[1]');
  assert.match(blocks[0].html, /duokan-image-single/);
  assert.equal(blocks[0].imageCount, 1);
  assert.equal(blocks[1].html, '<p>正文</p>');
});

test('keeps figure captions with their authored image block', () => {
  const blocks = normalizeNovelBlocks(
    '<figure><img src="/art.jpg"><figcaption>插图说明</figcaption></figure>',
  );

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].locator, '//*/figure[1]');
  assert.match(blocks[0].html, /figcaption>插图说明/);
});

test('keeps multi-image illustration groups as one styled reader block', () => {
  const blocks = normalizeNovelBlocks(
    '<div class="illus"><img src="/left.jpg"><img src="/right.jpg"></div><p>正文</p>',
  );

  assert.equal(blocks[0].locator, '//*/div[1]');
  assert.equal(blocks[0].imageCount, 2);
  assert.match(blocks[0].html, /right\.jpg/);
});

test('preserves an unknown image-only layout container as one block', () => {
  const images = Array.from(
    { length: 8 },
    (_, index) => `<img src="/${index + 1}.png">`,
  ).join('');
  const blocks = normalizeNovelBlocks(
    `<section class="screens" style="display:grid;grid-template-columns:repeat(4,1fr)">${images}</section>`,
  );

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].imageCount, 8);
  assert.match(blocks[0].html, /^<section class="screens" style="display:grid/);
  assert.match(blocks[0].html, /\/8\.png/);
});

test('keeps an image table as one authored layout block', () => {
  const row = (start) => '<tr>' + Array.from(
    { length: 4 },
    (_, index) => `<td><img src="/${start + index}.png"></td>`,
  ).join('') + '</tr>';
  const blocks = normalizeNovelBlocks(
    `<table><thead><tr><th></th><th></th><th></th><th></th></tr></thead><tbody>${row(1)}${row(5)}</tbody></table>`,
  );

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].locator, '//*/table[1]');
  assert.equal(blocks[0].imageCount, 8);
  assert.match(blocks[0].html, /<table>[\s\S]*<tr>[\s\S]*\/8\.png[\s\S]*<\/table>/);
});

test('drops metadata and explicitly hidden reader nodes', () => {
  const blocks = normalizeNovelBlocks('<meta name="x"/><p hidden>secret</p><p>visible</p><div style="display:none"><p>also hidden</p></div>');
  assert.deepEqual(blocks.map((block) => block.html), ['<p>visible</p>']);
});

test('sanitizes zero-width characters in text without altering tags', () => {
  assert.equal(sanitizeNovelHtml('<p>A\u200B\u200BB &\u200B#160;</p>'), '<p>AB &#160;</p>');
});

test('removes font placeholders encoded as decimal, hexadecimal, and repaired HTML entities', () => {
  const invisibleCodepoints = new Set([0xE001]);

  assert.equal(
    sanitizeNovelHtml(
      '<p>甲&#57345;乙&#xE001;丙&\u200B#X\u200BE001;丁&#8203;戊&#x4E2D;</p>',
      invisibleCodepoints,
    ),
    '<p>甲乙丙丁戊&#x4E2D;</p>',
  );
});

test('extracts Web-Master footnotes and removes hidden note bodies from reader flow', () => {
  const result = processNovelFootnotes(
    '<p>正文。<a class="duokan-footnote" href="#note-1"><sup><img class="footnote" /></sup></a></p>' +
      '<ol id="note-1"><li><b>注释</b>内容</li></ol>',
  );

  assert.equal(result.notesById['note-1'], '<li><b>注释</b>内容</li>');
  assert.match(result.html, /正文。<a/);
  assert.match(result.html, /data-reader-footnote-id="note-1"[^>]*>\*<\/a>/);
  assert.doesNotMatch(result.html, /href=/);
  assert.doesNotMatch(result.html, /<sup|class="footnote"/);
  assert.doesNotMatch(result.html, /<ol/);
});

test('does not confuse data-footnote-id with an id attribute', () => {
  const result = processNovelFootnotes(
    '<p>正文<a class="duokan-footnote" data-footnote-id="note-1" href="#note-1"><sup>[1]</sup></a>段末。</p>' +
      '<pre><code>console.log(1)</code></pre>' +
      '<section class="footnotes"><aside id="note-1"><p>注释内容</p></aside></section>',
    { markerContent: 'placeholder' },
  );

  assert.equal(result.notesById['note-1'], '<p>注释内容</p>');
  assert.match(result.html, /<p>正文<a data-reader-footnote-id="note-1">\*<\/a>段末。<\/p>/);
  assert.match(result.html, /<pre><code>console\.log\(1\)<\/code><\/pre>/);
  assert.doesNotMatch(result.html, /data-footnote-id|<aside|注释内容/);
});

test('can remove source footnote marker content for inline notes', () => {
  const result = processNovelFootnotes(
    '<p>正文。<a class="duokan-footnote" href="#note-1"><sup><img class="footnote" src="marker.png" /></sup></a></p>' +
      '<ol id="note-1"><li><b>注释</b>内容</li></ol>',
    { markerContent: 'empty' },
  );

  assert.equal(result.notesById['note-1'], '<li><b>注释</b>内容</li>');
  assert.match(result.html, /data-reader-footnote-id="note-1"[^>]*><\/a>/);
  assert.doesNotMatch(result.html, /marker\.png|>\*<\/a>|<ol/);
});

test('extracts Web-Master footnote class markers regardless of their element tag', () => {
  const result = processNovelFootnotes(
    '<p>正文<sup class="note duokan-footnote" href="#note-2"><img class="footnote" src="bad-marker.png"></sup>段末。</p>' +
      '<ul id="note-2"><li>注释：原文 QOL</li></ul>' +
      '<p><img class="illustration" src="ordinary.png" alt="ordinary"></p>',
  );

  assert.equal(result.notesById['note-2'], '<li>注释：原文 QOL</li>');
  assert.match(result.html, /正文<a data-reader-footnote-id="note-2">\*<\/a>段末。/);
  assert.doesNotMatch(result.html, /bad-marker\.png|<ul id="note-2"/);
  assert.match(result.html, /<img class="illustration" src="ordinary\.png" alt="ordinary">/);
});

test('replaces a void image footnote marker without touching ordinary images', () => {
  const result = processNovelFootnotes(
    '<p>正文<img class="footnote duokan-footnote" href="#note-3" src="bad-marker.png">。</p>' +
      '<ol id="note-3"><li>注释内容</li></ol>' +
      '<img class="footnote" src="unlinked.png">',
    { markerContent: 'empty' },
  );

  assert.equal(result.notesById['note-3'], '<li>注释内容</li>');
  assert.match(result.html, /正文<a data-reader-footnote-id="note-3"><\/a>。/);
  assert.doesNotMatch(result.html, /bad-marker\.png|<ol id="note-3"/);
  assert.match(result.html, /<img class="footnote" src="unlinked\.png">/);
});

test('recognizes the legacy note image shape without a footnote class', () => {
  const result = processNovelFootnotes(
    '<p>正文<a href="#note-4"><sup><img src="/img/note.png" class=""></sup></a>段末。</p>' +
      '<ol id="note-4"><li>注释内容</li></ol>',
    { markerContent: 'empty' },
  );

  assert.equal(result.notesById['note-4'], '<li>注释内容</li>');
  assert.match(result.html, /正文<a data-reader-footnote-id="note-4"><\/a>段末。/);
  assert.doesNotMatch(result.html, /note\.png|<ol id="note-4"/);
});

test('recognizes a data-line list item after a legacy marker', () => {
  const result = processNovelFootnotes(
    '<p>正文<a href="#note-6"><sup><img src="/img/note.png"></sup></a>段末。</p>' +
      '<ol><li data-line="86"><p>注释内容</p></li></ol><p>后文</p>',
    { markerContent: 'empty' },
  );

  assert.equal(result.notesById['note-6'], '<li data-line="86"><p>注释内容</p></li>');
  assert.match(result.html, /正文<a data-reader-footnote-id="note-6"><\/a>段末。/);
  assert.doesNotMatch(result.html, /data-line="86"|note\.png|注释内容/);
});

test('places extracted footnote content directly after its paragraph', () => {
  const processed = processNovelFootnotes(
    '<p>正文<a href="#note-6"><sup><img src="/img/note.png"></sup></a>段末。</p>' +
      '<ol><li data-line="86"><p>注释内容</p></li></ol><p>后文</p>',
  );
  const blocks = inlineNovelFootnotesAfterBlocks(
    normalizeNovelBlocks(processed.html, undefined, { sanitize: false }),
    processed.notesById,
  );

  assert.equal(blocks.length, 3);
  assert.match(blocks[0].html, /正文<a data-reader-footnote-id="note-6">\*<\/a>段末。/);
  assert.equal(blocks[1].id, `${blocks[0].id}:footnote:note-6`);
  assert.equal(blocks[1].locator, blocks[0].locator);
  assert.match(blocks[1].html, /^<aside class="nv-inline-footnote"/);
  assert.match(blocks[1].html, /<span class="nv-inline-footnote-label">\*<\/span>/);
  assert.match(blocks[1].html, /<p>注释内容<\/p>/);
  assert.match(blocks[2].html, /后文/);
});

test('collapses a marker-only paragraph but keeps its inline note', () => {
  const processed = processNovelFootnotes(
    '<p>：<a class="duokan-footnote" href="#n1"><img class="footnote"></a></p>' +
      '<ol id="n1"><li>独立注释</li></ol>',
  );
  const blocks = inlineNovelFootnotesAfterBlocks(
    normalizeNovelBlocks(processed.html, undefined, { sanitize: false }),
    processed.notesById,
  );

  assert.equal(blocks.length, 1);
  assert.match(blocks[0].html, /nv-inline-footnote/);
  assert.match(blocks[0].html, /独立注释/);
  assert.doesNotMatch(blocks[0].html, /^<p>：/);
});

test('does not treat an ordinary list as a footnote target', () => {
  const result = processNovelFootnotes(
    '<p>正文<a href="#missing"><sup><img src="/img/note.png"></sup></a>段末。</p>' +
      '<ol><li>普通列表</li></ol>',
    { markerContent: 'empty' },
  );

  assert.equal(result.notesById.missing, undefined);
  assert.match(result.html, /普通列表/);
  assert.match(result.html, /<li>普通列表<\/li>/);
});

test('recognizes named-anchor footnote targets inside legacy list items', () => {
  const result = processNovelFootnotes(
    '<p>正文<a href="#note-5"><sup><img src="/img/note.png"></sup></a>段末。</p>' +
      '<ol><li data-line="86"><a name="note-5"></a><p>注释内容</p></li></ol>',
    { markerContent: 'empty' },
  );

  assert.equal(result.notesById['note-5'], '<a name="note-5"></a><p>注释内容</p>');
  assert.match(result.html, /正文<a data-reader-footnote-id="note-5"><\/a>段末。/);
  assert.doesNotMatch(result.html, /name="note-5"|data-line="86"|note\.png/);
});

test('restores an inline Web XPath to its nearest reader block ancestor', () => {
  const blocks = normalizeNovelBlocks(
    '<div><p>第一段</p><p><span>第二段</span></p><p>第三段</p></div>',
  );

  assert.equal(findReaderBlockIndex(blocks, '//*/div[1]/p[2]/span[1]'), 1);
  assert.equal(findReaderBlockIndex(blocks, 'div[1]/p[3]'), 2);
});

test('creates measured page slices and preserves block order', () => {
  const blocks = normalizeNovelBlocks('<p>one</p><p>two</p><p>three</p>');
  const pages = createReaderPagePlan(
    blocks,
    { [blocks[0].id]: 40, [blocks[1].id]: 40, [blocks[2].id]: 40 },
    90,
    10,
  );

  assert.deepEqual(pages.map((page) => [page.start, page.end]), [[0, 2], [2, 3]]);
  assert.deepEqual(getReaderBlockLayout(blocks, { [blocks[0].id]: 40, [blocks[1].id]: 40 }, 2), { index: 2, length: 29, offset: 104 });
});

test('moves a measured illustration to the next page instead of clipping it', () => {
  const blocks = normalizeNovelBlocks(
    '<p>before image</p><div class="illus"><img src="/illustration.jpg"></div>',
  );
  const pages = createReaderPagePlan(
    blocks,
    { [blocks[0].id]: 300, [blocks[1].id]: 500 },
    600,
    12,
  );

  assert.deepEqual(pages.map((page) => [page.start, page.end]), [[0, 1], [1, 2]]);
});

test('preallocates comic pages and fills batches by server skip', () => {
  const slots = createComicPageSlots(4);
  const next = mergeComicPageBatch(slots, 2, [{ url: 'page-3', placeholder: '', width: 2, height: 3 }]);

  assert.equal(next.length, 4);
  assert.equal(next[0].image, null);
  assert.equal(next[2].image?.url, 'page-3');
});

test('clamps reader progress to the chapter bounds', () => {
  assert.deepEqual(calculateReaderProgress(9, 4), { completed: 4, ratio: 1, total: 4 });
  assert.deepEqual(calculateReaderProgress(-1, 0), { completed: 0, ratio: 0, total: 0 });
});

test('opens adjacent chapters at a deterministic boundary', () => {
  assert.equal(getAdjacentChapterSortNum({ sortNum: 2, totalChapters: 3 }, 'previous'), 1);
  assert.equal(getAdjacentChapterSortNum({ sortNum: 3, totalChapters: 3 }, 'next'), null);
  assert.equal(resolveReaderInitialIndex('start', 8, 10), 0);
  assert.equal(resolveReaderInitialIndex('end', 0, 10), 9);
  assert.equal(resolveReaderInitialIndex('saved', 99, 10), 9);
});

test('resolves pending local progress without overriding newer server data after sync', () => {
  const server = { chapterId: 7, position: '//*/p[2]' };
  assert.deepEqual(
    resolveReaderRestorePosition(7, server, {
      chapterId: 7,
      position: '//*/p[8]',
      syncState: 'pending',
    }),
    { chapterId: 7, position: '//*/p[8]', syncState: 'pending' },
  );
  const syncedLocal = {
    chapterId: 7,
    position: '//*/p[1]',
    syncState: 'synced',
  };
  assert.deepEqual(resolveReaderRestorePosition(7, server, syncedLocal), server);
  assert.deepEqual(resolveReaderRestorePosition(7, server, syncedLocal, true), syncedLocal);
  assert.equal(
    resolveReaderRestorePosition(7, null, {
      chapterId: 8,
      position: '//*/p[3]',
      syncState: 'pending',
    }),
    null,
  );
});

test('coalesces rapid reader movement to the latest scheduled position', async () => {
  const writes = [];
  const queue = createReaderPositionWriteQueue((value) => {
    writes.push(value);
  });

  queue.schedule('block-2');
  queue.schedule('block-8');
  queue.schedule('block-13');
  await queue.flush();

  assert.deepEqual(writes, ['block-13']);
});

test('serializes a chapter-boundary save before newer chapter progress', async () => {
  const writes = [];
  let releaseFirst;
  const firstWrite = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const queue = createReaderPositionWriteQueue(async (value) => {
    writes.push(value);
    if (writes.length === 1) await firstWrite;
  }, { delayMs: 1, fingerprint: (value) => value });

  queue.schedule('chapter-1:last-visible');
  const boundary = queue.commit('chapter-1:last-visible');
  queue.schedule('chapter-2:first-visible');
  const drain = queue.flush();
  await Promise.resolve();
  releaseFirst();
  await Promise.all([boundary, drain]);

  assert.deepEqual(writes, ['chapter-1:last-visible', 'chapter-2:first-visible']);
});

test('allows an unsynced position to retry after a failed write', async () => {
  let attempts = 0;
  const queue = createReaderPositionWriteQueue(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('offline');
  });

  await queue.commit('chapter-1:block-4');
  await queue.commit('chapter-1:block-4');

  assert.equal(attempts, 2);
});

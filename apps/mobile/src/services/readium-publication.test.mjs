import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadiumReaderPreferences } from './readium-preferences.ts';
import {
  buildReadiumChapterDocument,
  buildReadiumPublicationResources,
  isReadiumPublicationReady,
  readiumBlockFragment,
  readiumChapterHref,
  readiumPublicationCacheKey,
} from './readium-publication.ts';

const chapters = [
  { id: 101, sortNum: 1, title: 'First & One' },
  { id: 205, sortNum: 2, title: 'Second' },
];

const blocks = [
  { id: 'block://p[1]', locator: '//p[1]', html: '<p>First block</p>', textLength: 11, imageCount: 0 },
  { id: 'block://p[2]', locator: '//p[2]', html: '<p id="server-id">Second block</p>', textLength: 12, imageCount: 0 },
];

test('publication metadata declares a complete stable spine without chapter payloads', () => {
  const publication = buildReadiumPublicationResources(
    { bookId: 9, identifier: 'novella:9', title: 'Book' },
    chapters,
    205,
    true,
  );

  const opf = publication.resources['EPUB/package.opf'];
  assert.ok(opf);
  assert.match(opf, /href="chapters\/101\.xhtml"/);
  assert.match(opf, /href="chapters\/205\.xhtml"/);
  assert.match(opf, /href="fonts\/book\.woff2" media-type="font\/woff2"/);
  assert.equal(publication.targetChapterHref, 'chapters/205.xhtml');
  assert.equal(publication.resources['EPUB/chapters/101.xhtml'], undefined);
  assert.ok(publication.declaredHrefs.includes('EPUB/chapters/101.xhtml'));
  assert.ok(publication.declaredHrefs.includes('EPUB/chapters/205.xhtml'));
});

test('chapter XHTML receives deterministic fragments and a relative font stylesheet', () => {
  const html = buildReadiumChapterDocument({
    blocks,
    chapterId: 101,
    title: 'First',
    useBookFont: true,
  });

  assert.match(html, /<body class="nv-book-font" data-chapter-id="101">/);
  assert.match(html, /<p id="nv-block-0">First block<\/p>/);
  assert.match(html, /<p id="nv-block-1">Second block<\/p>/);
  assert.match(html, /href="\.\.\/styles\/reader\.css"/);
  assert.doesNotMatch(html, /nv-reader-image-interaction/);
  assert.match(html, /e\.stopImmediatePropagation\(\);send\(i,'tap'\)/);
  assert.match(html, /window\.webkit\.messageHandlers\.novellaReader\.postMessage\(p\)/);
  assert.doesNotMatch(html, /preventDefault\(\)/);
});

test('image tables retain their authored rows and columns', () => {
  const row = (start) => '<tr>' + Array.from(
    { length: 4 },
    (_, index) => `<td><img src="images/${start + index}.png"></td>`,
  ).join('') + '</tr>';
  const html = buildReadiumChapterDocument({
    blocks: [{
      id: 'screens',
      locator: '//*/table[1]',
      html: `<table><thead><tr><th></th><th></th><th></th><th></th></tr></thead><tbody>${row(1)}${row(5)}</tbody></table>`,
      textLength: 0,
      imageCount: 8,
    }],
    chapterId: 101,
    imageBaseUrl: 'https://example.test',
    title: 'Screens',
    useBookFont: false,
  });
  const publication = buildReadiumPublicationResources(
    { bookId: 9, identifier: 'novella:9', title: 'Book' },
    chapters,
    101,
    false,
  );

  assert.match(html, /<table id="nv-block-0"><thead>/);
  assert.equal((html.match(/<tr>/gu) ?? []).length, 3);
  assert.equal((html.match(/<td>/gu) ?? []).length, 8);
  assert.equal((html.match(/<img\b/gu) ?? []).length, 8);
  assert.match(publication.resources['EPUB/styles/reader.css'], /table\{width:100%;max-width:100%;table-layout:fixed/);
  assert.match(publication.resources['EPUB/styles/reader.css'], /body>:last-child\{margin-bottom:0!important;\}/);
  assert.match(publication.resources['EPUB/styles/reader.css'], /body>p\{text-indent:var\(--USER__paraIndent\)!important;\}/);
  assert.match(publication.resources['EPUB/styles/reader.css'], /-webkit-user-select:none;user-select:none/);
});

test('chapter HTML is normalized with inline footnotes', () => {
  const html = buildReadiumChapterDocument({
    blocks: [
      { id: 'image', locator: '//div[1]', html: '<div><img src="images/a.jpg?x=1&y=2"></div>', textLength: 0, imageCount: 1 },
      { id: 'break', locator: '//p[1]', html: '<p><br></p>', textLength: 0, imageCount: 0 },
      { id: 'note', locator: '//p[2]', html: '<p>：<a data-reader-footnote-id="n1" href="#old" epub:type="noteref"><sup><img class="footnote" src="marker.png" /></sup></a></p>', textLength: 1, imageCount: 1 },
    ],
    chapterId: 101,
    footnotes: { n1: '<p>Note<br>body</p>' },
    imageBaseUrl: 'https://example.test',
    title: 'First',
    useBookFont: false,
  });

  assert.match(html, /xmlns:epub="http:\/\/www\.idpf\.org\/2007\/ops"/);
  assert.match(html, /<img src="https:\/\/example\.test\/images\/a\.jpg\?x=1&amp;y=2"\/>/);
  assert.match(html, /<br\/>/);
  assert.doesNotMatch(html, /epub:type="noteref"|marker\.png|data-reader-footnote-id|>\*<\/a>/);
  assert.doesNotMatch(html, /nv-block-2|&#xFF1A;/);
  assert.match(html, /<aside class="nv-inline-footnote" data-footnote-id="n1"><span class="nv-inline-footnote-label">\*<\/span>/);
  assert.match(html, /<div class="nv-inline-footnote-content"><p>Note<br\/>body<\/p><\/div>/);
  const scriptIndex = html.indexOf('<script type="text/javascript">');
  const headEndIndex = html.indexOf('</head>');
  const bodyStartIndex = html.indexOf('<body');
  assert.ok(scriptIndex > 0 && scriptIndex < headEndIndex);
  assert.ok(headEndIndex < bodyStartIndex);
  assert.doesNotMatch(html.slice(bodyStartIndex), /<script\b/);
});

test('readiness gates target chapter and required font but not future chapters or images', () => {
  const available = new Set([
    'mimetype',
    'META-INF/container.xml',
    'EPUB/package.opf',
    'EPUB/nav.xhtml',
    'EPUB/styles/reader.css',
    'EPUB/chapters/101.xhtml',
    'EPUB/fonts/book.woff2',
  ]);

  assert.equal(isReadiumPublicationReady({
    availableHrefs: available,
    fontRequired: true,
    targetChapterId: 101,
  }), true);

  available.delete('EPUB/fonts/book.woff2');
  assert.equal(isReadiumPublicationReady({
    availableHrefs: available,
    fontRequired: true,
    targetChapterId: 101,
  }), false);
  assert.equal(isReadiumPublicationReady({
    availableHrefs: available,
    fontRequired: false,
    targetChapterId: 101,
  }), true);
});

test('reader preferences map first-line indentation to Readium rem units', () => {
  const base = {
    backgroundColor: '#ffffff',
    fontSize: 18,
    imagePreviewOpenOnLongPress: false,
    lineHeight: 1.6,
    mode: 'paged',
    sidePadding: 30,
    textColor: '#000000',
  };
  assert.equal(createReadiumReaderPreferences({ ...base, firstLineIndent: true }).paragraphIndent, 2);
  assert.equal(createReadiumReaderPreferences({ ...base, firstLineIndent: false }).paragraphIndent, 0);
});

test('publication cache identity includes the conversion mode', () => {
  assert.equal(readiumPublicationCacheKey(9, undefined), '9-none');
  assert.equal(readiumPublicationCacheKey(9, 't2s'), '9-t2s');
  assert.equal(readiumBlockFragment(3), 'nv-block-3');
  assert.equal(readiumChapterHref(205), 'EPUB/chapters/205.xhtml');
});

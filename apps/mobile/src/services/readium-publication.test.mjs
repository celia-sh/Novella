import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReadiumChapterDocument,
  buildReadiumPublicationResources,
  isReadiumPublicationReady,
  readiumBlockFragment,
  readiumPublicationRevision,
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

test('publication identity includes schema and conversion mode', () => {
  assert.equal(readiumPublicationRevision(9, undefined), '9-v1-none');
  assert.equal(readiumPublicationRevision(9, 't2s'), '9-v1-t2s');
  assert.equal(readiumBlockFragment(3), 'nv-block-3');
});

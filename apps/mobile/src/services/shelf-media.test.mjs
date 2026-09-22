import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseShelfMediaParam,
  projectShelfBrowse,
  projectShelfItems,
  serializeShelfMedia,
  shelfBookRefForMedia,
  shelfBookRouteParams,
  shelfMediaToBookType,
} from './shelf-media.ts';

const novelCard = (id, title) => ({
  id,
  type: 'Novel',
  title,
  seriesTitle: null,
  coverUrl: `https://example.test/${id}.jpg`,
  coverPlaceholder: null,
  authorName: null,
  lastUpdatedAt: '',
  level: null,
  interiorLevel: null,
  category: null,
});

const comicCard = (id, title, seriesTitle = title) => ({
  id,
  type: 'Comic',
  title,
  seriesTitle,
  coverUrl: `https://example.test/${id}.jpg`,
  coverPlaceholder: null,
  authorName: null,
  lastUpdatedAt: '',
  level: null,
  interiorLevel: null,
  category: null,
});

const snapshot = {
  version: '20260921',
  items: [
    { id: 1, index: 0, parents: [], type: 'NOVEL', updatedAt: '' },
    { id: 2, index: 1, parents: [], type: 'COMIC', updatedAt: '' },
    { id: 'mixed', index: 2, parents: [], title: 'Mixed', type: 'FOLDER', updatedAt: '' },
    { id: 'novels', index: 3, parents: [], title: 'Novels', type: 'FOLDER', updatedAt: '' },
    { id: 'comics', index: 4, parents: [], title: 'Comics', type: 'FOLDER', updatedAt: '' },
    { id: 'empty', index: 5, parents: [], title: 'Empty', type: 'FOLDER', updatedAt: '' },
    { id: 3, index: 0, parents: ['mixed'], type: 'NOVEL', updatedAt: '' },
    { id: 4, index: 1, parents: ['mixed'], type: 'COMIC', updatedAt: '' },
    { id: 'nested', index: 2, parents: ['mixed'], title: 'Nested comics', type: 'FOLDER', updatedAt: '' },
    { id: 5, index: 0, parents: ['mixed', 'nested'], type: 'COMIC', updatedAt: '' },
    { id: 6, index: 0, parents: ['novels'], type: 'NOVEL', updatedAt: '' },
    { id: 7, index: 0, parents: ['comics'], type: 'COMIC', updatedAt: '' },
  ],
  books: [
    { ref: { id: 2, type: 'COMIC' }, book: comicCard(2, 'Root comic') },
    { ref: { id: 4, type: 'COMIC' }, book: comicCard(4, 'Direct comic') },
    { ref: { id: 5, type: 'COMIC' }, book: comicCard(5, 'Nested comic') },
    { ref: { id: 6, type: 'NOVEL' }, book: novelCard(6, 'Folder novel') },
    { ref: { id: 7, type: 'COMIC' }, book: comicCard(7, 'Folder comic') },
  ],
};

test('shelf media route state defaults to Novel and accepts only lowercase route values', () => {
  assert.equal(parseShelfMediaParam(undefined), 'Novel');
  assert.equal(parseShelfMediaParam('novel'), 'Novel');
  assert.equal(parseShelfMediaParam('comic'), 'Comic');
  assert.equal(parseShelfMediaParam(['comic']), 'Comic');
  assert.equal(parseShelfMediaParam('Comic'), 'Novel');
  assert.equal(parseShelfMediaParam('all'), 'Novel');
  assert.equal(serializeShelfMedia('Novel'), 'novel');
  assert.equal(serializeShelfMedia('Comic'), 'comic');
  assert.equal(shelfMediaToBookType('Novel'), 'NOVEL');
  assert.equal(shelfMediaToBookType('Comic'), 'COMIC');
  assert.deepEqual(shelfBookRefForMedia(42, 'Novel'), { id: 42, type: 'NOVEL' });
  assert.deepEqual(shelfBookRefForMedia(42, 'Comic'), { id: 42, type: 'COMIC' });
});

test('browse projection filters typed books and recursively hides type-empty folders', () => {
  const novels = projectShelfBrowse(snapshot, [], 'Novel');
  const comics = projectShelfBrowse(snapshot, [], 'Comic');

  assert.deepEqual(novels.items.map((item) => `${item.type}:${item.id}`), [
    'NOVEL:1',
    'FOLDER:mixed',
    'FOLDER:novels',
  ]);
  assert.deepEqual(comics.items.map((item) => `${item.type}:${item.id}`), [
    'COMIC:2',
    'FOLDER:mixed',
    'FOLDER:comics',
  ]);
  assert.equal(novels.folderProjections.get('FOLDER:mixed').bookCount, 1);
  assert.equal(comics.folderProjections.get('FOLDER:mixed').bookCount, 2);
  assert.equal(novels.folderProjections.get('FOLDER:mixed').childFolderCount, 0);
  assert.equal(comics.folderProjections.get('FOLDER:mixed').childFolderCount, 1);
  assert.deepEqual(comics.folderProjections.get('FOLDER:mixed').previewBooks.map((book) => book.id), [4, 5]);
});

test('projection applies the same recursive rule at nested paths and keeps unresolved matches', () => {
  const novels = projectShelfBrowse(snapshot, ['mixed'], 'Novel');
  const comics = projectShelfBrowse(snapshot, ['mixed'], 'Comic');
  const nestedComics = projectShelfBrowse(snapshot, ['mixed', 'nested'], 'Comic');

  assert.deepEqual(novels.items.map((item) => `${item.type}:${item.id}`), ['NOVEL:3']);
  assert.deepEqual(comics.items.map((item) => `${item.type}:${item.id}`), [
    'COMIC:4',
    'FOLDER:nested',
  ]);
  assert.deepEqual(nestedComics.items.map((item) => `${item.type}:${item.id}`), ['COMIC:5']);
  assert.equal(novels.folderProjections.get('FOLDER:mixed').bookCount, 1);
  assert.deepEqual(novels.folderProjections.get('FOLDER:mixed').previewBooks, []);
});

test('edit projection remains complete and uses the complete tree for folder summaries', () => {
  const projection = projectShelfItems(snapshot, [], null);

  assert.deepEqual(projection.items.map((item) => `${item.type}:${item.id}`), [
    'NOVEL:1',
    'COMIC:2',
    'FOLDER:mixed',
    'FOLDER:novels',
    'FOLDER:comics',
    'FOLDER:empty',
  ]);
  assert.equal(projection.folderProjections.get('FOLDER:mixed').bookCount, 3);
  assert.equal(projection.folderProjections.get('FOLDER:mixed').childFolderCount, 1);
});

test('shelf cards map typed items to the correct detail route type and comic series hint', () => {
  assert.deepEqual(shelfBookRouteParams(
    { id: 10, index: 0, parents: [], type: 'NOVEL', updatedAt: '' },
    novelCard(10, 'Novel title'),
  ), {
    cover: 'https://example.test/10.jpg',
    id: '10',
    placeholder: '',
    title: 'Novel title',
    type: 'Novel',
  });
  assert.deepEqual(shelfBookRouteParams(
    { id: 11, index: 0, parents: [], type: 'COMIC', updatedAt: '' },
    comicCard(11, 'Volume title', 'Series title'),
  ), {
    cover: 'https://example.test/11.jpg',
    id: '11',
    placeholder: '',
    seriesTitle: 'Series title',
    title: 'Volume title',
    type: 'Comic',
  });
  assert.equal(
    shelfBookRouteParams(
      { id: 12, index: 0, parents: [], type: 'NOVEL', updatedAt: '' },
      comicCard(12, 'Card type must not win'),
    ).type,
    'Novel',
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeSeriesSearchMode,
  hasSearchableQuickSearchTags,
  isJapaneseOriginalCategory,
  normalizeQuickSearchTags,
  resolveBookQuickSearch,
  resolveSeriesSearchKeyword,
  resolveTagQuickSearch,
  toBookSearchRouteParams,
} from './book-quick-search.ts';

const category = (name = '', shortName = '') => ({ color: '', name, shortName });
const classification = (seriesName = null, seriesNameCn = null) => ({
  author: null,
  seriesName,
  seriesNameCn,
  tags: [],
});
const book = ({
  authorName = 'Author',
  bookCategory = null,
  seriesName = null,
  seriesNameCn = null,
  title = 'Book title',
} = {}) => ({
  authorName,
  category: bookCategory,
  classification: classification(seriesName, seriesNameCn),
  title,
});

test('series search mode follows Flutter original/display/system precedence', () => {
  const japanese = category('日文原版', '日文');
  const nonJapanese = category('Fantasy', 'FAN');
  const classifiedBook = book({
    bookCategory: japanese,
    seriesName: 'Original series',
    seriesNameCn: '展示系列',
  });

  assert.equal(
    resolveSeriesSearchKeyword(classifiedBook.classification, japanese, 'system'),
    'Original series',
  );
  assert.equal(
    resolveSeriesSearchKeyword(classifiedBook.classification, nonJapanese, 'system'),
    '展示系列',
  );
  assert.equal(
    resolveSeriesSearchKeyword(classifiedBook.classification, nonJapanese, 'original'),
    'Original series',
  );
  assert.equal(
    resolveSeriesSearchKeyword(classifiedBook.classification, nonJapanese, 'display'),
    '展示系列',
  );
});

test('series search mode falls back when one name is missing or blank', () => {
  const japanese = category('日文原版', '');
  assert.equal(
    resolveSeriesSearchKeyword(
      classification('  ', 'Displayed fallback'),
      japanese,
      'original',
    ),
    'Displayed fallback',
  );
  assert.equal(
    resolveSeriesSearchKeyword(
      classification('Original fallback', '  '),
      japanese,
      'display',
    ),
    'Original fallback',
  );
  assert.equal(
    resolveSeriesSearchKeyword(classification(null, null), null, 'system'),
    null,
  );
});

test('invalid series search settings fall back to system', () => {
  assert.equal(decodeSeriesSearchMode(undefined), 'system');
  assert.equal(decodeSeriesSearchMode('legacy'), 'system');
  assert.equal(decodeSeriesSearchMode('original'), 'original');
  assert.equal(decodeSeriesSearchMode('display'), 'display');
});

test('Japanese original category recognizes Flutter name and short-name aliases', () => {
  assert.equal(isJapaneseOriginalCategory(category('日文原版', '')), true);
  assert.equal(isJapaneseOriginalCategory(category('', '日文')), true);
  assert.equal(isJapaneseOriginalCategory(category('', '日原')), true);
  assert.equal(isJapaneseOriginalCategory(category('', '日文原版')), true);
  assert.equal(isJapaneseOriginalCategory(category(' Japanese ', 'JP')), false);
  assert.equal(isJapaneseOriginalCategory(null), false);
});

test('title quick search uses series name or fuzzy title, and author uses author mode', () => {
  const classifiedBook = book({ seriesName: 'Original series', seriesNameCn: 'Displayed series' });

  assert.deepEqual(
    resolveBookQuickSearch(classifiedBook, 'title', 'display'),
    { mode: 'name', query: 'Displayed series' },
  );
  assert.deepEqual(
    resolveBookQuickSearch(book({ seriesName: null, seriesNameCn: null, title: '  Book title  ' }), 'title', 'system'),
    { mode: 'fuzzy', query: 'Book title' },
  );
  assert.deepEqual(
    resolveBookQuickSearch(book({ authorName: '  An author  ' }), 'author', 'system'),
    { mode: 'author', query: 'An author' },
  );
  assert.equal(resolveBookQuickSearch(book({ authorName: '  ' }), 'author', 'system'), null);
  assert.equal(resolveBookQuickSearch(book({ title: '  ' }), 'title', 'system'), null);
});

test('tag quick search trims and rejects empty tags', () => {
  assert.deepEqual(resolveTagQuickSearch('  tag  '), { mode: 'tags', query: 'tag' });
  assert.equal(resolveTagQuickSearch('  '), null);
  assert.deepEqual(normalizeQuickSearchTags([' tag ', 'tag', '  ', 'other']), ['tag', 'other']);
  assert.equal(hasSearchableQuickSearchTags(['  ', '\n']), false);
  assert.equal(hasSearchableQuickSearchTags(['  tag  ']), true);
});

test('quick search route params preserve target mode and detail format', () => {
  assert.deepEqual(
    toBookSearchRouteParams({ mode: 'author', query: 'Author' }, 'Comic'),
    { format: 'Comic', mode: 'author', query: 'Author' },
  );
});

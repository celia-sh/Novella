import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOOK_BADGE_LEGEND_DEFINITIONS,
  resolveBookCategoryBadge,
  resolveBookLevelBadge,
} from './book-badge-definitions.ts';

const category = (name, shortName) => ({ color: '', name, shortName });

test('book badge legend contains every supported preview', () => {
  assert.deepEqual(
    BOOK_BADGE_LEGEND_DEFINITIONS.map(({ id }) => id),
    [
      'recorded',
      'translated',
      'repost',
      'original',
      'japanese',
      'ai',
      'recording',
      'translating',
      'level',
      'interior-level',
    ],
  );
});

test('book category badges match trimmed names and short names', () => {
  assert.equal(
    resolveBookCategoryBadge(category('Other', ' 日文原版 '))?.id,
    'japanese',
  );
  assert.equal(
    resolveBookCategoryBadge(category('Other', ' AI翻译 '))?.id,
    'ai',
  );
  assert.equal(
    resolveBookCategoryBadge(category('  转载  ', ''))?.id,
    'repost',
  );
  assert.equal(resolveBookCategoryBadge(category('Other', 'unknown')), null);
});

test('interior level takes precedence and clamps the preview level', () => {
  assert.deepEqual(resolveBookLevelBadge({ interiorLevel: 9, level: 2 }), {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0A106',
    icon: 'hexagon',
    iconColor: '#E0A106',
    id: 'interior-level',
    level: 6,
    names: [],
    shortNames: [],
  });
  assert.equal(resolveBookLevelBadge({ interiorLevel: null, level: 0 }), null);
});

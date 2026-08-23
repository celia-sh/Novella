import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateNovelPageCount,
  resolveComicPageProgress,
  resolveNovelPageProgress,
} from './reader-page-progress.ts';

test('novel scroll progress estimates pages from chapter height', () => {
  assert.equal(estimateNovelPageCount(2400, 800), 3);
  assert.deepEqual(resolveNovelPageProgress({
    mode: 'scroll',
    offset: { x: 0, y: 800 },
    pagedPageCount: 1,
    totalHeight: 2400,
    viewportHeight: 800,
    viewportWidth: 400,
  }), { current: 2, progress: 0.5, total: 3 });
});

test('novel paged progress uses measured page tiles', () => {
  assert.deepEqual(resolveNovelPageProgress({
    mode: 'paged',
    offset: { x: 800, y: 0 },
    pagedPageCount: 4,
    totalHeight: 3200,
    viewportHeight: 800,
    viewportWidth: 400,
  }), { current: 3, progress: 2 / 3, total: 4 });
});

test('comic progress clamps to the available image range', () => {
  assert.deepEqual(resolveComicPageProgress(20, 5), {
    current: 5,
    progress: 1,
    total: 5,
  });
  assert.deepEqual(resolveComicPageProgress(-1, 0), {
    current: 0,
    progress: 0,
    total: 0,
  });
});

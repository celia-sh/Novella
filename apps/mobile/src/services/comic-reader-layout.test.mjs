import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampComicPageIndex,
  clampComicScrollOffset,
  createComicPrefetchPlan,
  doesComicBatchContainPage,
  fitComicPage,
  getComicPageBatchStart,
  getContinuousComicContentWidth,
  resolveComicTapDirection,
} from './comic-reader-layout.ts';

test('comic tap edges follow the active reading axis', () => {
  assert.equal(resolveComicTapDirection('paged', 20, 400, 400, 800), -1);
  assert.equal(resolveComicTapDirection('paged', 380, 400, 400, 800), 1);
  assert.equal(resolveComicTapDirection('paged', 200, 20, 400, 800), null);
  assert.equal(resolveComicTapDirection('scroll', 200, 20, 400, 800), -1);
  assert.equal(resolveComicTapDirection('scroll', 200, 780, 400, 800), 1);
  assert.equal(resolveComicTapDirection('scroll', 20, 400, 400, 800), null);
});

test('comic tap scrolling clamps to content bounds', () => {
  assert.equal(clampComicScrollOffset(500, 700, 3000, 800), 1200);
  assert.equal(clampComicScrollOffset(100, -700, 3000, 800), 0);
  assert.equal(clampComicScrollOffset(2100, 700, 2600, 800), 1800);
});

test('comic page indexes and batches clamp to chapter bounds', () => {
  assert.equal(clampComicPageIndex(-4, 100), 0);
  assert.equal(clampComicPageIndex(105, 100), 99);
  assert.equal(clampComicPageIndex(Number.NaN, 100), 0);
  assert.equal(clampComicPageIndex(8, 0), 0);
  assert.equal(getComicPageBatchStart(8, 100, 6), 6);
  assert.equal(getComicPageBatchStart(83, 100, 12), 72);
  assert.equal(getComicPageBatchStart(105, 100, 12), 96);
  assert.equal(getComicPageBatchStart(5, 100, 0), 5);
});

test('comic batches report whether they contain the requested page', () => {
  assert.equal(doesComicBatchContainPage(12, 12, 12), true);
  assert.equal(doesComicBatchContainPage(23, 12, 12), true);
  assert.equal(doesComicBatchContainPage(24, 12, 12), false);
  assert.equal(doesComicBatchContainPage(12, 12, 0), false);
});

test('comic prefetch combines one immediate page with three farther pages', () => {
  assert.deepEqual(createComicPrefetchPlan(5, 12, 1, 3), {
    immediate: [4, 5, 6],
    directional: [7, 8, 9],
  });
  assert.deepEqual(createComicPrefetchPlan(10, 12, 1), {
    immediate: [9, 10, 11],
    directional: [],
  });
});

test('comic prefetch follows backward movement without leaving bounds', () => {
  assert.deepEqual(createComicPrefetchPlan(5, 12, -1), {
    immediate: [4, 5, 6],
    directional: [3, 2, 1, 0],
  });
  assert.deepEqual(createComicPrefetchPlan(0, 12, -1), {
    immediate: [0, 1],
    directional: [],
  });
});

test('paged comic images are contained without changing aspect ratio', () => {
  assert.deepEqual(fitComicPage(1000, 2000, 400, 600), {
    width: 300,
    height: 600,
  });
  assert.deepEqual(fitComicPage(2000, 1000, 400, 600), {
    width: 400,
    height: 200,
  });
  assert.deepEqual(fitComicPage(0, 0, 300, 300), {
    width: 200,
    height: 300,
  });
});

test('continuous comic width changes only on wide viewports', () => {
  assert.equal(getContinuousComicContentWidth(390, 750), 390);
  assert.ok(Math.abs(getContinuousComicContentWidth(1024, 700) - 490) < 0.001);
  assert.ok(Math.abs(getContinuousComicContentWidth(768, 1024) - 716.8) < 0.001);
});

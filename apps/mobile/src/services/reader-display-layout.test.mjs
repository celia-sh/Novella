import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createComicPageDisplaySlots,
  fitComicPageSpread,
  resolveComicDisplayIndex,
  shouldUseReaderDoublePage,
} from './reader-display-layout.ts';

test('double-page layout is reserved for large landscape viewports', () => {
  assert.equal(shouldUseReaderDoublePage(1366, 1024), true);
  assert.equal(shouldUseReaderDoublePage(844, 390), false);
  assert.equal(shouldUseReaderDoublePage(1024, 1366), false);
});

test('comic double-page sizing fills height without adding a center gap', () => {
  const sizes = fitComicPageSpread([
    { index: 0, image: { width: 2, height: 3, placeholder: '', url: 'a' } },
    { index: 1, image: { width: 2, height: 3, placeholder: '', url: 'b' } },
  ], 1366, 1024);
  assert.equal(sizes.length, 2);
  assert.equal(sizes[0].height, 1024);
  assert.equal(sizes[1].height, 1024);
  assert.ok(Math.abs(sizes[0].width + sizes[1].width - 1366) < 1);

  const constrained = fitComicPageSpread([
    { index: 0, image: { width: 2, height: 3, placeholder: '', url: 'a' } },
    { index: 1, image: { width: 2, height: 3, placeholder: '', url: 'b' } },
  ], 1000, 1000);
  assert.ok(Math.abs(constrained[0].width + constrained[1].width - 1000) < 1);
  assert.equal(constrained[0].height, 750);
});

test('comic display slots group adjacent pages without changing page indexes', () => {
  const slots = createComicPageDisplaySlots([
    { index: 0, image: null },
    { index: 1, image: null },
    { index: 2, image: null },
  ], 2);
  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [[0, 1], [2]]);
  assert.equal(resolveComicDisplayIndex(0, 3, 2), 0);
  assert.equal(resolveComicDisplayIndex(1, 3, 2), 0);
  assert.equal(resolveComicDisplayIndex(2, 3, 2), 1);
});

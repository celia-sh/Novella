import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createComicPageDisplaySlots,
  resolveComicDisplayIndex,
  shouldUseReaderDoublePage,
} from './reader-display-layout.ts';

test('double-page layout is reserved for large landscape viewports', () => {
  assert.equal(shouldUseReaderDoublePage(1366, 1024), true);
  assert.equal(shouldUseReaderDoublePage(844, 390), false);
  assert.equal(shouldUseReaderDoublePage(1024, 1366), false);
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

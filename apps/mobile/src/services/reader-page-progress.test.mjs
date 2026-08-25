import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readerProgressStep,
  resolveComicPageProgress,
  snapReaderProgress,
} from './reader-page-progress.ts';

test('reader progress snaps to page positions', () => {
  assert.equal(readerProgressStep(5), 0.25);
  assert.equal(snapReaderProgress(0.12, 5), 0);
  assert.equal(snapReaderProgress(0.14, 5), 0.25);
  assert.equal(snapReaderProgress(0.94, 5), 1);
  assert.equal(snapReaderProgress(0.5, 1), 1);
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

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  communityImageFileName,
  editorImageSize,
  fitImageWithin,
} from './community-image-sizing.ts';

test('fits large images within the upload limit and leaves small ones alone', () => {
  assert.deepEqual(fitImageWithin({ width: 4032, height: 3024 }, 2048), { width: 2048, height: 1536 });
  assert.deepEqual(fitImageWithin({ width: 1000, height: 4000 }, 2048), { width: 512, height: 2048 });
  assert.deepEqual(fitImageWithin({ width: 800, height: 600 }, 2048), { width: 800, height: 600 });
});

test('inserts images at the editor width, never wider than the image', () => {
  assert.deepEqual(editorImageSize({ width: 2048, height: 1536 }, 343.5), { width: 343, height: 257 });
  assert.deepEqual(editorImageSize({ width: 200, height: 100 }, 343), { width: 200, height: 100 });
  assert.deepEqual(editorImageSize({ width: 0, height: 100 }, 343), { width: 1, height: 1 });
});

test('names uploads after the original file with the encoded extension', () => {
  assert.equal(communityImageFileName('IMG_0001.HEIC', 'jpg'), 'IMG_0001.jpg');
  assert.equal(communityImageFileName('/tmp/a b/截图 1.png', 'jpg'), '截图-1.jpg');
  assert.equal(communityImageFileName(null, 'gif', 42), 'image-42.gif');
  assert.equal(communityImageFileName('...', 'jpg', 7), 'image-7.jpg');
});

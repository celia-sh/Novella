import assert from 'node:assert/strict';
import test from 'node:test';

import { ReaderSkiaScrollParagraphCache } from './reader-skia-scroll-paragraph-cache.ts';

const waitForDisposal = () => new Promise((resolve) => setTimeout(resolve, 100));

function createBundle(paragraph) {
  return { items: [{ blockId: 'block', paragraph, xOffset: 0, yOffset: 0, width: 100 }] };
}

test('delays paragraph disposal and cancels it when a block re-enters the cache', async () => {
  const cache = new ReaderSkiaScrollParagraphCache();
  let disposed = 0;
  const paragraph = { dispose: () => { disposed += 1; } };

  cache.getOrCreate('block', () => createBundle(paragraph));
  cache.prune(new Set());
  cache.getOrCreate('block', () => createBundle(paragraph));
  await waitForDisposal();

  assert.equal(disposed, 0);
  cache.prune(new Set());
  await waitForDisposal();
  assert.equal(disposed, 1);
});

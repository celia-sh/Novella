import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOOK_COVER_BLURHASH_SIZE,
  BOOK_COVER_COLOR_SAMPLE_SIZE,
  createBookCoverBlurHashPlaceholder,
  sampleBlurHashColors,
} from './blurhash.ts';

const VALID_HASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';

function hex(argb) {
  return `#${(argb >>> 0).toString(16).padStart(8, '0').slice(2).toUpperCase()}`;
}

test('samples all BlurHash components at the cover color grid', () => {
  const samples = sampleBlurHashColors(VALID_HASH);

  assert.equal(samples?.length, BOOK_COVER_COLOR_SAMPLE_SIZE.width * BOOK_COVER_COLOR_SAMPLE_SIZE.height);
  assert.equal(hex(samples?.[0] ?? 0), '#87A4B1');
  assert.ok(new Set(samples).size > 1);
});

test('rejects invalid hashes and sample dimensions before sampling', () => {
  assert.equal(sampleBlurHashColors('invalid'), null);
  assert.equal(sampleBlurHashColors(VALID_HASH, 0, 18), null);
  assert.equal(sampleBlurHashColors(VALID_HASH, 12, 65), null);
});

test('keeps the rendered placeholder contract at 32x48', () => {
  assert.deepEqual(createBookCoverBlurHashPlaceholder(VALID_HASH), {
    blurhash: VALID_HASH,
    height: BOOK_COVER_BLURHASH_SIZE.height,
    width: BOOK_COVER_BLURHASH_SIZE.width,
  });
});

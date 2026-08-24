import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  coverImageCacheKey,
  coverImageRecyclingKey,
} from './cover-image-keys.ts';
import {
  IMAGE_HEIGHT_STEP,
  MAX_IMAGE_HEIGHT_REQUEST,
  imageHeightBucketFor,
  sizedImageUrl,
  withImageHeight,
} from './image-sizing.ts';

test('rounds display heights to supported physical-pixel buckets', () => {
  assert.equal(imageHeightBucketFor(180, 3), 512);
  assert.equal(imageHeightBucketFor(150, 3.5), 512);
  assert.equal(imageHeightBucketFor(300, 3), 1024);
  assert.equal(imageHeightBucketFor(1, 1), IMAGE_HEIGHT_STEP);
  assert.equal(imageHeightBucketFor(Number.NaN, 3), IMAGE_HEIGHT_STEP);
  assert.equal(imageHeightBucketFor(2_000, 3), MAX_IMAGE_HEIGHT_REQUEST);
});

test('adds a height variant while preserving existing query parameters', () => {
  assert.equal(
    withImageHeight('https://img.example/cover.webp', 512),
    'https://img.example/cover.webp?height=512',
  );
  assert.equal(
    withImageHeight('https://img.example/cover.webp?placeholder=abc&t=sig', 512),
    'https://img.example/cover.webp?placeholder=abc&t=sig&height=512',
  );
  assert.equal(
    withImageHeight('https://img.example/cover.webp?height=256&w=200', 512),
    'https://img.example/cover.webp?height=512&w=200',
  );
  assert.equal(
    withImageHeight('https://img.example/cover.webp?#fragment', 512),
    'https://img.example/cover.webp?height=512#fragment',
  );
});

test('cache keys retain signed and sized request identity', () => {
  const first = 'https://img.example/cover.webp?placeholder=one&t=sig-a&height=512';
  const second = 'https://img.example/cover.webp?placeholder=two&t=sig-b&height=1024';

  assert.equal(
    coverImageCacheKey(first),
    'https://img.example/cover.webp?t=sig-a&height=512',
  );
  assert.notEqual(coverImageCacheKey(first), coverImageCacheKey(second));
  assert.notEqual(coverImageRecyclingKey(first), coverImageRecyclingKey(second));
});

test('sized URL keeps the selected variant stable for display and prefetch', () => {
  assert.equal(
    sizedImageUrl('https://img.example/cover.webp?placeholder=abc', {
      logicalHeight: 180,
      devicePixelRatio: 3,
    }),
    'https://img.example/cover.webp?placeholder=abc&height=512',
  );
});

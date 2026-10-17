import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  READER_IMAGE_VIEWER_INSET,
  readerImageFrame,
} from './reader-image-frame.ts';

const viewport = {
  bottomInset: 34,
  height: 874,
  topInset: 62,
  width: 402,
};

test('fits a portrait image inside the viewer box without changing its aspect', () => {
  const frame = readerImageFrame({ height: 1500, width: 1000 }, viewport);

  assert.equal(frame.x, READER_IMAGE_VIEWER_INSET);
  assert.equal(frame.width, 370);
  assert.ok(Math.abs(frame.height - 555) < 0.0001);
  assert.ok(Math.abs(frame.y - 159.5) < 0.0001);
  assert.ok(Math.abs(frame.width / frame.height - 1000 / 1500) < 0.0001);
});

test('fits a landscape image by width and centres it vertically', () => {
  const frame = readerImageFrame({ height: 1000, width: 2000 }, viewport);

  assert.equal(frame.width, 370);
  assert.ok(Math.abs(frame.height - 185) < 0.0001);
  assert.ok(Math.abs(frame.y - 344.5) < 0.0001);
});

test('uses the larger safe-area inset on both sides', () => {
  const frame = readerImageFrame(
    { height: 1500, width: 1000 },
    { ...viewport, bottomInset: 90, topInset: 10 },
  );

  const vertical = 90 + READER_IMAGE_VIEWER_INSET;
  const boxHeight = viewport.height - vertical * 2;
  const fittedHeight = (frame.width / 1000) * 1500;
  assert.equal(frame.y, vertical + (boxHeight - fittedHeight) / 2);
  assert.ok(Math.abs(frame.height - fittedHeight) < 0.0001);
});

test('falls back to the whole box when the picture has no known size', () => {
  assert.deepEqual(readerImageFrame({}, viewport), {
    x: READER_IMAGE_VIEWER_INSET,
    y: 78,
    width: 370,
    height: 718,
  });
  assert.deepEqual(readerImageFrame({ height: 0, width: 100 }, viewport), {
    x: READER_IMAGE_VIEWER_INSET,
    y: 78,
    width: 370,
    height: 718,
  });
});

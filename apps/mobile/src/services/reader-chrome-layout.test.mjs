import assert from 'node:assert/strict';
import test from 'node:test';

import { createReaderChromeInsets } from './reader-chrome-layout.ts';

test('reader chrome insets include overlay controls and safe areas', () => {
  assert.deepEqual(createReaderChromeInsets('ios', 59, 34), {
    top: 119,
    bottom: 94,
  });
  assert.deepEqual(createReaderChromeInsets('android', 24, 24), {
    top: 96,
    bottom: 96,
  });
});

test('reader chrome insets clamp invalid safe areas and skip web overlays', () => {
  assert.deepEqual(createReaderChromeInsets('android', -10, -20), {
    top: 72,
    bottom: 72,
  });
  assert.deepEqual(createReaderChromeInsets('web', 20, 20), {
    top: 0,
    bottom: 0,
  });
});

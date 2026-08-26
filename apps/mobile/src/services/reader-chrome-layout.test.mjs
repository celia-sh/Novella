import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createReaderChromeInsets,
  resolveReaderChapterBarOrder,
} from './reader-chrome-layout.ts';

test('reader chapter bar follows physical reading direction', () => {
  assert.deepEqual(resolveReaderChapterBarOrder('ltr'), {
    left: 'previous',
    right: 'next',
  });
  assert.deepEqual(resolveReaderChapterBarOrder('rtl'), {
    left: 'next',
    right: 'previous',
  });
});

test('reader chrome insets include iOS overlay controls and safe areas', () => {
  assert.deepEqual(createReaderChromeInsets(59, 34), {
    top: 119,
    bottom: 94,
  });
});

test('reader chrome insets clamp invalid safe areas', () => {
  assert.deepEqual(createReaderChromeInsets(-10, -20), {
    top: 60,
    bottom: 60,
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createReaderChromeInsets,
  resolveReaderChapterBarOrder,
  shouldRenderReaderEdgeBlur,
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

test('reader edge blur supports comic pagination while remaining gated by content readiness', () => {
  assert.equal(shouldRenderReaderEdgeBlur('scroll'), true);
  assert.equal(shouldRenderReaderEdgeBlur('scroll', false), false);
  assert.equal(shouldRenderReaderEdgeBlur('paged'), false);
  assert.equal(shouldRenderReaderEdgeBlur('paged', true, true), true);
  assert.equal(shouldRenderReaderEdgeBlur('paged', false, true), false);
});

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

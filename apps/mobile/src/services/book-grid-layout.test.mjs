import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bookGridColumns, bookGridListKey } from './book-grid-layout.ts';

test('book grid columns adapt to window width', () => {
  assert.equal(bookGridColumns(320), 3, 'small phone stays at 3 columns');
  assert.equal(bookGridColumns(479), 3, 'below 480 stays at 3 columns');
  assert.equal(bookGridColumns(480), 4, 'large phone gets 4 columns');
  assert.equal(bookGridColumns(599), 4);
  assert.equal(bookGridColumns(600), 5, 'phone landscape gets 5 columns');
  assert.equal(bookGridColumns(767), 5);
  assert.equal(bookGridColumns(768), 6, 'iPad portrait gets 6 columns');
  assert.equal(bookGridColumns(1023), 6);
  assert.equal(bookGridColumns(1024), 7, 'iPad landscape gets 7 columns');
  assert.equal(bookGridColumns(1279), 7);
  assert.equal(bookGridColumns(1280), 8, 'wide windows get 8 columns');
  assert.equal(bookGridColumns(1600), 8, '8 is the maximum');
});

test('book grid list key changes with the responsive column count', () => {
  assert.equal(bookGridListKey(bookGridColumns(479)), 'book-grid-3');
  assert.equal(bookGridListKey(bookGridColumns(480)), 'book-grid-4');
  assert.notEqual(
    bookGridListKey(bookGridColumns(767)),
    bookGridListKey(bookGridColumns(768)),
  );
});

test('tile widths stay in a sane range across breakpoints', () => {
  const columnGap = 10;
  const horizontalPadding = 20;
  for (let width = 320; width <= 1600; width += 8) {
    const contentWidth = width - horizontalPadding * 2;
    const columns = bookGridColumns(contentWidth);
    const tileWidth = Math.floor((contentWidth - (columns - 1) * columnGap) / columns);
    assert.ok(tileWidth >= 80, `tile too narrow at width ${width}: ${tileWidth}`);
    assert.ok(tileWidth <= 200, `tile too wide at width ${width}: ${tileWidth}`);
  }
});

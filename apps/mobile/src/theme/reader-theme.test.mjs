import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_NOVEL_READER_DARK_BACKGROUND,
  DEFAULT_NOVEL_READER_LIGHT_BACKGROUND,
  normalizeReaderBackgroundColor,
  resolveNovelReaderBackgroundColor,
  resolveNovelReaderTextColor,
} from './reader-theme.ts';

test('reader background colors normalize supported hex values', () => {
  assert.equal(normalizeReaderBackgroundColor('#aBc123'), '#ABC123');
  assert.equal(normalizeReaderBackgroundColor('#aBc12380'), '#ABC12380');
  assert.equal(normalizeReaderBackgroundColor('#abc12'), null);
  assert.equal(normalizeReaderBackgroundColor('white'), null);
  assert.equal(normalizeReaderBackgroundColor(null), null);
});

test('unset reader background follows the effective app appearance', () => {
  assert.equal(
    resolveNovelReaderBackgroundColor(null, 'light'),
    DEFAULT_NOVEL_READER_LIGHT_BACKGROUND,
  );
  assert.equal(
    resolveNovelReaderBackgroundColor(undefined, 'dark'),
    DEFAULT_NOVEL_READER_DARK_BACKGROUND,
  );
});

test('custom reader backgrounds choose the higher contrast foreground', () => {
  assert.equal(resolveNovelReaderTextColor('#FFFFFF'), '#000000');
  assert.equal(resolveNovelReaderTextColor('#000000'), '#FFFFFF');
  assert.equal(resolveNovelReaderTextColor('#FFCC00'), '#000000');
  assert.equal(resolveNovelReaderTextColor('#333333'), '#FFFFFF');
});

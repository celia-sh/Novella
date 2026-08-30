import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeAppSettings } from './app-settings.ts';

test('comic double-page offset is opt-in and survives settings decoding', () => {
  assert.equal(decodeAppSettings(null).comicDoublePageOffset, false);
  assert.equal(decodeAppSettings({ comicDoublePageOffset: true }).comicDoublePageOffset, true);
  assert.equal(decodeAppSettings({ comicDoublePageOffset: 'true' }).comicDoublePageOffset, false);
});

test('legacy appearance fields are ignored without losing current settings', () => {
  const settings = decodeAppSettings({
    fontSize: 22,
    oledBlack: false,
    unrelatedFutureField: 'ignored',
    useSystemColor: true,
  });

  assert.equal(settings.fontSize, 22);
  assert.equal('oledBlack' in settings, false);
  assert.equal('useSystemColor' in settings, false);
  assert.equal('unrelatedFutureField' in settings, false);
  assert.doesNotMatch(JSON.stringify(settings), /oledBlack|useSystemColor/);
});

test('invalid or missing settings fall back to current defaults', () => {
  const defaults = decodeAppSettings(null);
  const settings = decodeAppSettings({
    fontSize: 'large',
    language: 'en-US',
    theme: 'invalid',
  });

  assert.equal(defaults.fontSize, 18);
  assert.equal(settings.fontSize, 18);
  assert.equal(settings.language, 'system');
  assert.equal(settings.theme, 'system');
});

test('legacy reader mode fields remain compatible while removed fields stay absent', () => {
  const settings = decodeAppSettings({
    oledBlack: true,
    readerViewMode: 'scroll',
    useSystemColor: false,
  });

  assert.equal(settings.novelReaderViewMode, 'scroll');
  assert.equal(settings.comicReaderViewMode, 'scroll');
  assert.equal('oledBlack' in settings, false);
  assert.equal('useSystemColor' in settings, false);
});

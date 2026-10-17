import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadiumContentInsets } from './readium-preferences.ts';

test('readium content insets keep asymmetric side safe areas', () => {
  assert.deepEqual(createReadiumContentInsets(10, 20, 30, 40), {
    bottom: 20,
    left: 30,
    right: 40,
    top: 10,
  });
});

test('readium content insets clamp negative values', () => {
  assert.deepEqual(createReadiumContentInsets(-1, -2, -3, -4), {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  });
});

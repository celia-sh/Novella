import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAppColorScheme } from './theme-mode.ts';

test('fixed app appearances override the system appearance', () => {
  assert.equal(resolveAppColorScheme('light', 'dark'), 'light');
  assert.equal(resolveAppColorScheme('dark', 'light'), 'dark');
});

test('system appearance resolves dark only for an explicit dark system value', () => {
  assert.equal(resolveAppColorScheme('system', 'dark'), 'dark');
  assert.equal(resolveAppColorScheme('system', 'light'), 'light');
  assert.equal(resolveAppColorScheme('system', null), 'light');
});

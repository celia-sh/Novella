import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBookColorProfile } from './book-detail-profile.ts';

test('book details use the active appearance profile directly', () => {
  assert.equal(resolveBookColorProfile('dark'), 'dark');
  assert.equal(resolveBookColorProfile('light'), 'light');
});

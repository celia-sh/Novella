import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBookColorProfile } from './book-detail-profile.ts';

test('dark iOS book details keep the internal OLED profile without a setting', () => {
  assert.equal(resolveBookColorProfile('dark'), 'oledBlack');
  assert.equal(resolveBookColorProfile('light'), 'light');
});

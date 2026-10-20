import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldShowWhatsNew } from './whats-new.ts';

const releaseVersion = '2.6.0';

function visible(currentVersion, lastSeenVersion) {
  return shouldShowWhatsNew({ currentVersion, lastSeenVersion, releaseVersion });
}

test('a release is announced until it has been seen once', () => {
  assert.equal(visible('2.6.0', null), true);
  assert.equal(visible('2.6.0', '2.5.0'), true);
  assert.equal(visible('2.6.0', '2.6.0'), false);
  assert.equal(visible('2.6.0', '2.6.1'), false);
});

test('a patch build announces the minor release it skipped', () => {
  assert.equal(visible('2.6.1', null), true);
  assert.equal(visible('2.6.1', '2.5.0'), true);
});

test('a build older than the release never announces it', () => {
  assert.equal(visible('2.5.0', null), false);
  assert.equal(visible('2.5.9', '2.5.0'), false);
});

test('corrupted versions fail closed for the build and open for the record', () => {
  assert.equal(visible('not-a-version', null), false);
  assert.equal(visible('2.6.0', 'not-a-version'), true);
});

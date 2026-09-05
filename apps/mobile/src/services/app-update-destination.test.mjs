import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APP_UPDATE_DESTINATIONS,
  isAppUpdateDestination,
  resolveAppUpdateDestinationURL,
} from './app-update-destination.ts';

test('app update destinations expose GitHub and the supported sideload apps', () => {
  assert.deepEqual(APP_UPDATE_DESTINATIONS, ['github', 'altstore', 'sidestore', 'feather']);
  assert.equal(isAppUpdateDestination('github'), true);
  assert.equal(isAppUpdateDestination('altstore'), true);
  assert.equal(isAppUpdateDestination('sidestore'), true);
  assert.equal(isAppUpdateDestination('feather'), true);
  assert.equal(isAppUpdateDestination('altstore-classic'), false);
  assert.equal(isAppUpdateDestination('unknown'), false);
});

test('app update destinations resolve to the release page or app URL scheme', () => {
  const releaseURL = 'https://github.com/celia-sh/Novella/releases/tag/v2.3.0';
  assert.equal(resolveAppUpdateDestinationURL('github', releaseURL), releaseURL);
  assert.equal(resolveAppUpdateDestinationURL('altstore', releaseURL), 'altstore://');
  assert.equal(resolveAppUpdateDestinationURL('sidestore', releaseURL), 'sidestore://');
  assert.equal(resolveAppUpdateDestinationURL('feather', releaseURL), 'feather://');
});

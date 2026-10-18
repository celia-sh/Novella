import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAppUpdateDestinationURL } from './app-update-destination.ts';

test('app update destinations resolve to the release page or app URL scheme', () => {
  const releaseURL = 'https://github.com/celia-sh/Novella/releases/tag/v2.3.0';
  assert.equal(resolveAppUpdateDestinationURL('github', releaseURL), releaseURL);
  assert.equal(resolveAppUpdateDestinationURL('altstore', releaseURL), 'altstore://');
  assert.equal(resolveAppUpdateDestinationURL('sidestore', releaseURL), 'sidestore://');
  assert.equal(resolveAppUpdateDestinationURL('feather', releaseURL), 'feather://');
});

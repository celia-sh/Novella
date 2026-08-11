import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkForAppUpdate,
  compareAppVersions,
} from './app-update.ts';

test('app version comparison follows SemVer precedence', () => {
  assert.equal(compareAppVersions('1.9.0', '1.10.0'), -1);
  assert.equal(compareAppVersions('v2.0.0-preview.1', '2.0.0'), -1);
  assert.equal(compareAppVersions('2.0.0-preview.2', '2.0.0-preview.10'), -1);
  assert.equal(compareAppVersions('2.0.0', '2.0.0-preview.1'), 1);
  assert.equal(compareAppVersions('2.0.0+12', 'v2.0.0+99'), 0);
});

test('update check returns the GitHub release URL without consuming release notes', async () => {
  let requestedUrl = '';
  const result = await checkForAppUpdate('1.9.0', {
    async fetchImpl(url) {
      requestedUrl = String(url);
      return new Response(JSON.stringify({
        body: 'This content must not be surfaced by the app.',
        html_url: 'https://github.com/celia-sh/Novella/releases/tag/v1.10.0',
        tag_name: 'v1.10.0',
      }), { status: 200 });
    },
  });

  assert.equal(
    requestedUrl,
    'https://api.github.com/repos/celia-sh/Novella/releases/latest',
  );
  assert.deepEqual(result, {
    currentVersion: '1.9.0',
    latestVersion: '1.10.0',
    releaseUrl: 'https://github.com/celia-sh/Novella/releases/tag/v1.10.0',
    status: 'available',
  });
});

test('update check treats equal or newer local builds as current', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    html_url: 'https://github.com/celia-sh/Novella/releases/tag/v1.10.0',
    tag_name: 'v1.10.0',
  }), { status: 200 });

  assert.equal((await checkForAppUpdate('1.10.0', { fetchImpl })).status, 'current');
  assert.equal((await checkForAppUpdate('2.0.0', { fetchImpl })).status, 'current');
});

test('update check rejects HTTP failures and unsafe release URLs', async () => {
  await assert.rejects(
    () => checkForAppUpdate('1.0.0', {
      fetchImpl: async () => new Response('', { status: 403 }),
    }),
    /HTTP 403/,
  );
  await assert.rejects(
    () => checkForAppUpdate('1.0.0', {
      fetchImpl: async () => new Response(JSON.stringify({
        html_url: 'https://example.com/malicious',
        tag_name: 'v2.0.0',
      }), { status: 200 }),
    }),
    /Invalid GitHub release response/,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeAppAnnouncementManifest,
  stripMarkdownFrontMatter,
} from './app-announcements.ts';

test('app announcement manifest keeps valid entries and resolves content from the site root', () => {
  assert.deepEqual(decodeAppAnnouncementManifest({
    announcements: [
      {
        id: 'release-notes',
        path: 'assets/announcements/release-notes.md',
        publishedAt: '2026-05-28T00:00:00.000Z',
        summary: 'Release summary',
        title: 'Release notes',
      },
      { id: '', path: 'missing.md', publishedAt: 'invalid', title: '' },
    ],
    version: 1,
  }), [{
    contentUrl: 'https://novella.celia.sh/assets/announcements/release-notes.md',
    id: 'release-notes',
    publishedAt: '2026-05-28T00:00:00.000Z',
    summary: 'Release summary',
    title: 'Release notes',
  }]);
});

test('app announcement content removes only a complete leading front matter block', () => {
  assert.equal(stripMarkdownFrontMatter('---\nid: release-notes\n---\n# Body'), '# Body');
  assert.equal(stripMarkdownFrontMatter('---\nid: release-notes\n# Body'), '---\nid: release-notes\n# Body');
});

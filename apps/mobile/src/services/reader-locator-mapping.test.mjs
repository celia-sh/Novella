import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readiumLocatorToReaderPosition,
  readerPositionToReadiumLocator,
} from './reader-locator-mapping.ts';

const blocks = [
  { id: 'first', locator: '//body/p[1]', html: '<p>Alpha text</p>', textLength: 10, imageCount: 0 },
  { id: 'second', locator: '//body/p[2]', html: '<p>Beta anchor text</p>', textLength: 16, imageCount: 0 },
  { id: 'third', locator: '//body/p[3]', html: '<p>Gamma text</p>', textLength: 10, imageCount: 0 },
];

test('server position restores through a deterministic block fragment', () => {
  const locator = readerPositionToReadiumLocator('//body/p[2]', 42, blocks);

  assert.equal(locator.href, 'chapters/42.xhtml');
  assert.deepEqual(locator.locations.fragments, ['nv-block-1']);
  assert.ok((locator.locations.progression ?? 0) > 0);
});

test('Readium fragment maps directly to the canonical server locator', () => {
  const position = readiumLocatorToReaderPosition({
    href: 'chapters/42.xhtml',
    type: 'application/xhtml+xml',
    locations: { fragments: ['nv-block-2'], progression: 0 },
  }, 42, blocks);

  assert.deepEqual(position, { chapterId: 42, position: '//body/p[3]' });
});

test('text context is preferred when no stable fragment is available', () => {
  const position = readiumLocatorToReaderPosition({
    href: 'chapters/42.xhtml',
    type: 'application/xhtml+xml',
    locations: { progression: 0 },
    text: { highlight: 'Beta anchor text' },
  }, 42, blocks);

  assert.deepEqual(position, { chapterId: 42, position: '//body/p[2]' });
});

test('a locator for another chapter is rejected', () => {
  const position = readiumLocatorToReaderPosition({
    href: 'chapters/99.xhtml',
    type: 'application/xhtml+xml',
    locations: { progression: 0.5 },
  }, 42, blocks);

  assert.equal(position, null);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findVisibleReaderLayoutBlock,
  resolveReaderReflowOpenPosition,
} from './reader-reflow-position.ts';

const blocks = [
  { id: 'first', locator: '//p[1]', y: 20, height: 80 },
  { id: 'middle', locator: '//p[2]', y: 100, height: 120 },
  { id: 'last', locator: '//p[3]', y: 220, height: 100 },
];

test('reflow uses the live locator instead of replaying chapter-start intent', () => {
  assert.equal(resolveReaderReflowOpenPosition('start', '//p[8]'), 'saved');
  assert.equal(resolveReaderReflowOpenPosition('end', '//p[8]'), 'saved');
  assert.equal(resolveReaderReflowOpenPosition('start', null), 'start');
});

test('scroll reflow captures the top block with visible content', () => {
  const block = findVisibleReaderLayoutBlock({
    layout: { blocks },
    mode: 'scroll',
    offset: { x: 0, y: 145 },
    tiles: [],
    viewportWidth: 390,
  });

  assert.equal(block?.locator, '//p[2]');
});

test('paged reflow captures the current page instead of chapter start', () => {
  const block = findVisibleReaderLayoutBlock({
    layout: { blocks },
    mode: 'paged',
    offset: { x: 780, y: 0 },
    tiles: [
      { blocks: [blocks[0]] },
      { blocks: [blocks[1]] },
      { blocks: [blocks[2]] },
    ],
    viewportWidth: 390,
  });

  assert.equal(block?.locator, '//p[3]');
});

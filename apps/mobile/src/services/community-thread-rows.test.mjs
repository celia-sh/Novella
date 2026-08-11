import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findCommunityThreadRowIndex,
  flattenCommunityThreadRows,
} from './community-thread-rows.ts';

function reply(id, childReplies = [], hasMore = false) {
  return {
    childPage: { hasMore },
    childReplies,
    id,
  };
}

test('thread rows virtualize children and child pagination in parent order', () => {
  const rows = flattenCommunityThreadRows([
    reply(1, [reply(10), reply(11)], true),
    reply(2),
    reply(3, [reply(30)]),
  ]);

  assert.deepEqual(rows.map((row) => row.key), [
    'parent:1',
    'child:1:10',
    'child:1:11',
    'more:1',
    'parent:2',
    'parent:3',
    'child:3:30',
  ]);
  assert.equal(rows[1].kind === 'child' && rows[1].isFirst, true);
  assert.equal(rows[2].kind === 'child' && rows[2].closesGroup, false);
  assert.equal(rows[6].kind === 'child' && rows[6].closesGroup, true);
  assert.equal(findCommunityThreadRowIndex(rows, 11), 2);
  assert.equal(findCommunityThreadRowIndex(rows, 99), -1);
});

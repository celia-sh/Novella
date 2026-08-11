import assert from 'node:assert/strict';
import test from 'node:test';

import { flattenCommentRows } from './comment-list-rows.ts';

const user = { avatarUrl: '', id: 1, userName: 'reader' };

function reply(id) {
  return {
    canEdit: false,
    content: `reply ${id}`,
    createdAt: '2026-01-01T00:00:00Z',
    id,
    replyToUser: null,
    user,
  };
}

function comment(id, replies = []) {
  return {
    canEdit: false,
    content: `comment ${id}`,
    createdAt: '2026-01-01T00:00:00Z',
    id,
    replies,
    user,
  };
}

test('comment rows keep each reply directly after its parent', () => {
  const rows = flattenCommentRows([
    comment(1, [reply(10), reply(11)]),
    comment(2, [reply(10)]),
  ]);

  assert.deepEqual(rows.map((row) => row.key), [
    'comment:1',
    'reply:1:10',
    'reply:1:11',
    'comment:2',
    'reply:2:10',
  ]);
  assert.deepEqual(
    rows.filter((row) => row.kind === 'reply').map(({ isFirst, isLast, parentId }) => ({
      isFirst,
      isLast,
      parentId,
    })),
    [
      { isFirst: true, isLast: false, parentId: 1 },
      { isFirst: false, isLast: true, parentId: 1 },
      { isFirst: true, isLast: true, parentId: 2 },
    ],
  );
});

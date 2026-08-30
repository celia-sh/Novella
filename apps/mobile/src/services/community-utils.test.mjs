import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findCommunityReply,
  mergeCommunityItems,
  notificationTargetParams,
  removeCommunityReply,
  updateCommunityReply,
} from './community-utils.ts';

test('Community pagination append keeps order and removes duplicate ids', () => {
  assert.deepEqual(
    mergeCommunityItems([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]),
    [{ id: 1 }, { id: 2 }, { id: 3 }],
  );
});

test('Community nested reply helpers find and update a child reply', () => {
  const replies = [{
    id: 1,
    childReplies: [{ id: 2, childReplies: [], likes: 1 }],
    likes: 0,
  }];
  assert.equal(findCommunityReply(replies, 2).likes, 1);
  const updated = updateCommunityReply(replies, 2, (reply) => ({ ...reply, likes: 5 }));
  assert.equal(findCommunityReply(updated, 2).likes, 5);
  assert.equal(findCommunityReply(updated, 99), null);
});

test('Community reply removal updates root and child collections', () => {
  const replies = [{
    id: 1,
    childReplies: [{ id: 2, childReplies: [], childPage: { total: 0 } }],
    childPage: { total: 1 },
  }, {
    id: 3,
    childReplies: [],
    childPage: { total: 0 },
  }];

  const childRemoved = removeCommunityReply(replies, 2);
  assert.equal(childRemoved.removedRoot, false);
  assert.deepEqual(childRemoved.replies.map((reply) => reply.id), [1, 3]);
  assert.deepEqual(childRemoved.replies[0].childReplies, []);
  assert.equal(childRemoved.replies[0].childPage.total, 0);

  const rootRemoved = removeCommunityReply(replies, 1);
  assert.equal(rootRemoved.removedRoot, true);
  assert.deepEqual(rootRemoved.replies.map((reply) => reply.id), [3]);
  const unchanged = removeCommunityReply(replies, 99);
  assert.equal(unchanged.changed, false);
  assert.deepEqual(unchanged.replies, replies);
});

test('Community notification target prefers decoded Extra ids', () => {
  assert.deepEqual(notificationTargetParams({
    objectId: 4,
    extra: { objectId: 9, replyId: 11, parentReplyId: 10 },
  }), {
    id: 9,
    replyId: 11,
    parentReplyId: 10,
  });
});

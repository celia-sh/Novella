import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findCommunityReply,
  mergeCommunityItems,
  notificationTargetParams,
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

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findCommunityReply,
  mergeCommunityItems,
  resolveNotificationAction,
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

test('Community notification actions validate supported targets', () => {
  assert.deepEqual(resolveNotificationAction({
    type: 'open_community_thread',
    data: { thread_id: 4, reply_id: 9 },
  }), {
    kind: 'communityThread',
    replyId: 9,
    threadId: 4,
  });
  assert.deepEqual(resolveNotificationAction({
    type: 'open_series',
    data: { series_title: 'Series name' },
  }), { kind: 'series', seriesTitle: 'Series name' });
  assert.deepEqual(resolveNotificationAction({
    type: 'open_announcement',
    data: { announcement_id: 7 },
  }), { announcementId: 7, kind: 'announcement' });
  assert.deepEqual(resolveNotificationAction({
    type: 'open_book',
    data: { book_id: 8 },
  }), { bookId: 8, kind: 'book' });
  assert.equal(resolveNotificationAction(null), null);
  assert.equal(resolveNotificationAction({
    type: 'open_book',
    data: { book_id: 0 },
  }), null);
  assert.equal(resolveNotificationAction({
    type: 'future_action',
    data: {},
  }), null);
});

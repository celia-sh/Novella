import assert from 'node:assert/strict';
import test from 'node:test';

import { formatUnreadBadge, getUnreadCounts } from './unread-counts.ts';

test('private-message unread counts contribute to Community even without unread notifications', () => {
  assert.deepEqual(getUnreadCounts(null), { directMessages: 0, notifications: 0, total: 0 });
  assert.deepEqual(getUnreadCounts({ unreadDirectMessageCount: 50, unreadNotificationCount: 0 }), {
    directMessages: 50, notifications: 0, total: 50,
  });
});

test('reading notifications and private messages clears only its own part of the aggregate', () => {
  const profile = { unreadDirectMessageCount: 3, unreadNotificationCount: 5 };
  assert.deepEqual(getUnreadCounts(profile), { directMessages: 3, notifications: 5, total: 8 });
  assert.deepEqual(getUnreadCounts({ ...profile, unreadNotificationCount: 0 }), {
    directMessages: 3, notifications: 0, total: 3,
  });
  assert.deepEqual(getUnreadCounts({ ...profile, unreadDirectMessageCount: 0 }), {
    directMessages: 0, notifications: 5, total: 5,
  });
});

test('empty badges disappear and unread totals above 99 use the same cap at every entry', () => {
  assert.equal(formatUnreadBadge(0), undefined);
  assert.equal(formatUnreadBadge(-1), undefined);
  assert.equal(formatUnreadBadge(3), '3');
  assert.equal(formatUnreadBadge(99), '99');
  const unread = getUnreadCounts({ unreadDirectMessageCount: 80, unreadNotificationCount: 30 });
  assert.equal(formatUnreadBadge(unread.directMessages), '80');
  assert.equal(formatUnreadBadge(unread.total), '99+');
});

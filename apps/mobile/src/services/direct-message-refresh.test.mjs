import assert from 'node:assert/strict';
import test from 'node:test';

import { createDirectMessageRefresh } from './direct-message-refresh.ts';

test('messages arriving during a refresh get a later query while burst requests coalesce', async () => {
  const firstRequest = deferred();
  let serverUnread = 1;
  let displayedUnread = 0;
  let profileCalls = 0;
  let conversationCalls = 0;
  const refresh = createDirectMessageRefresh({
    async refresh() {
      profileCalls += 1;
      const unread = serverUnread;
      if (profileCalls === 1) await firstRequest.promise;
      displayedUnread = unread;
    },
  }, {
    async loadConversations() { conversationCalls += 1; },
    async resync() { assert.fail('ordinary messages should not reload every chat'); },
  });

  const pending = refresh();
  serverUnread = 7;
  for (let index = 0; index < 5; index += 1) assert.equal(refresh(), pending);
  firstRequest.resolve();
  await pending;
  assert.equal(displayedUnread, 7);
  assert.equal(profileCalls, 2);
  assert.equal(conversationCalls, 2);
});

test('reconnection during a message refresh also resyncs loaded chats', async () => {
  const firstRequest = deferred();
  let profileCalls = 0;
  let conversationCalls = 0;
  let resyncCalls = 0;
  const refresh = createDirectMessageRefresh({
    async refresh() {
      profileCalls += 1;
      if (profileCalls === 1) await firstRequest.promise;
    },
  }, {
    async loadConversations() { conversationCalls += 1; },
    async resync() { resyncCalls += 1; },
  });

  const pending = refresh();
  assert.equal(refresh(true), pending);
  assert.equal(refresh(), pending);
  firstRequest.resolve();
  await pending;
  assert.equal(profileCalls, 2);
  assert.equal(conversationCalls, 1);
  assert.equal(resyncCalls, 1);
});

test('a failed unread query does not block conversation refresh or a later retry', async () => {
  let profileCalls = 0;
  let conversationCalls = 0;
  let resyncCalls = 0;
  const refresh = createDirectMessageRefresh({
    async refresh() {
      profileCalls += 1;
      if (profileCalls === 1) throw new Error('profile unavailable');
    },
  }, {
    async loadConversations() { conversationCalls += 1; },
    async resync() { resyncCalls += 1; },
  });

  await refresh();
  await refresh(true);
  assert.equal(profileCalls, 2);
  assert.equal(conversationCalls, 1);
  assert.equal(resyncCalls, 1);
});

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

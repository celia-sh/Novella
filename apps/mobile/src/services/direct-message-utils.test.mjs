import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDirectMessagePreview,
  findDirectMessageReceiptId,
  resolveDirectMessagePeerName,
} from './direct-message-utils.ts';

test('falls back to the deleted label for a removed peer', () => {
  assert.equal(
    resolveDirectMessagePeerName({ avatarUrl: '', id: 1, isDeleted: true, userName: 'Someone' }, '已注销'),
    '已注销',
  );
});

test('falls back to the deleted label when the remaining name is blank', () => {
  assert.equal(
    resolveDirectMessagePeerName({ avatarUrl: '', id: 1, isDeleted: false, userName: '   ' }, '已注销'),
    '已注销',
  );
});

test('trims the peer name when one is present', () => {
  assert.equal(
    resolveDirectMessagePeerName({ avatarUrl: '', id: 1, isDeleted: false, userName: '  Aki  ' }, '已注销'),
    'Aki',
  );
});

test('collapses whitespace in a conversation preview', () => {
  assert.equal(createDirectMessagePreview('  hello\n\n  there \t '), 'hello there');
});

test('returns no receipt while an outgoing message is still pending', () => {
  const messages = [
    { clientMessageId: 'a', content: 'hi', createdAt: '2026-01-01T00:00:00.000Z', id: 7, senderId: 5 },
  ];
  assert.equal(findDirectMessageReceiptId(messages, 1, 5), 0);
});

test('returns no receipt without a current user id', () => {
  const messages = [
    { clientMessageId: 'a', content: 'hi', createdAt: '2026-01-01T00:00:00.000Z', id: 7, senderId: 5 },
  ];
  assert.equal(findDirectMessageReceiptId(messages, 0, 0), 0);
});

test('points the receipt at my newest message, skipping theirs', () => {
  const messages = [
    { clientMessageId: 'a', content: 'mine', createdAt: '2026-01-01T00:00:00.000Z', id: 3, senderId: 5 },
    { clientMessageId: 'b', content: 'theirs', createdAt: '2026-01-01T00:00:01.000Z', id: 4, senderId: 9 },
  ];
  assert.equal(findDirectMessageReceiptId(messages, 0, 5), 3);
});

test('returns no receipt when I have never sent a message', () => {
  const messages = [
    { clientMessageId: 'b', content: 'theirs', createdAt: '2026-01-01T00:00:01.000Z', id: 4, senderId: 9 },
  ];
  assert.equal(findDirectMessageReceiptId(messages, 0, 5), 0);
});

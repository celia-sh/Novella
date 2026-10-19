import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDirectMessagePreview,
  findDirectMessageReceiptId,
  getDirectMessageBottomInset,
  getDirectMessageScrollEndOffset,
  getDirectMessageScrollProps,
  layoutDirectMessageRows,
  resolveDirectMessagePeerName,
  updateDirectMessageKeyboardHeights,
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

test('reaches the chat bottom including the composer and iOS safe area', () => {
  // The scroll view owns all 88 points: 54 for the input plus 34 for the safe area.
  const metrics = { contentHeight: 1_100, viewportHeight: 800, bottomInset: 88 };
  assert.equal(getDirectMessageScrollEndOffset(metrics), 388);
  assert.equal(getDirectMessageScrollEndOffset({ ...metrics, bottomInset: 54 }), 354);
});

test('uses the current keyboard and composer inset after the input grows', () => {
  const metrics = { contentHeight: 1_100, viewportHeight: 800, bottomInset: 384 };
  assert.equal(getDirectMessageScrollEndOffset(metrics), 684);
});

test('moves the chat bottom by exactly one input line without a second safe-area correction', () => {
  const metrics = { contentHeight: 1_100, viewportHeight: 800, bottomInset: 88 };
  const wrapped = { ...metrics, bottomInset: 109 };
  assert.equal(getDirectMessageScrollEndOffset(wrapped) - getDirectMessageScrollEndOffset(metrics), 21);
});

test('does not create an extra scroll range for a short chat', () => {
  const metrics = { contentHeight: 120, viewportHeight: 800, bottomInset: 88 };
  assert.equal(getDirectMessageScrollEndOffset(metrics), 0);
});

test('counts the keyboard or resting safe area once throughout keyboard movement', () => {
  const frames = [
    [0, 88],
    [20, 88],
    [60, 114],
    [160, 214],
    [320, 374],
    [160, 214],
    [20, 88],
    [0, 88],
  ];
  for (const [keyboardHeight, expectedInset] of frames) {
    assert.equal(getDirectMessageBottomInset(54, keyboardHeight, 34), expectedInset);
  }
});

test('sets the iOS bottom target at keyboard start without waiting for move or end', () => {
  let heights = updateDirectMessageKeyboardHeights(
    { inset: 0, presentation: 0 }, 'start', { height: 320, duration: 250 }, true,
  );
  const target = () => getDirectMessageScrollProps({
    contentHeight: 1_100,
    viewportHeight: 800,
    bottomInset: getDirectMessageBottomInset(54, heights.inset, 34),
  }, true, 0).contentOffset.y;
  assert.equal(target(), 674);
  assert.equal(heights.presentation, 0);

  for (const height of [20, 80, 160, 280, 320]) {
    heights = updateDirectMessageKeyboardHeights(
      heights, 'move', { height, duration: 250 }, true,
    );
    // Presentation frames keep commits moving without rewinding the native target.
    assert.equal(target(), 674);
    assert.equal(heights.presentation, height);
  }
  const beforeEnd = target();
  heights = updateDirectMessageKeyboardHeights(
    heights, 'end', { height: 320, duration: 250 }, true,
  );
  assert.equal(target(), beforeEnd);
});

test('starts the iOS closing target immediately and does not reset it on movement frames', () => {
  let heights = updateDirectMessageKeyboardHeights(
    { inset: 320, presentation: 320 }, 'start', { height: 0, duration: 250 }, true,
  );
  assert.deepEqual(heights, { inset: 0, presentation: 320 });
  for (const height of [280, 160, 60, 0]) {
    heights = updateDirectMessageKeyboardHeights(
      heights, 'move', { height, duration: 250 }, true,
    );
    assert.equal(getDirectMessageBottomInset(54, heights.inset, 34), 88);
    assert.equal(heights.presentation, height);
  }
  heights = updateDirectMessageKeyboardHeights(
    heights, 'end', { height: 0, duration: 250 }, true,
  );
  assert.deepEqual(heights, { inset: 0, presentation: 0 });
});

test('updates both iOS heights when the keyboard changes without an animation', () => {
  const heights = updateDirectMessageKeyboardHeights(
    { inset: 320, presentation: 160 }, 'start', { height: 0, duration: 0 }, true,
  );
  assert.deepEqual(heights, { inset: 0, presentation: 0 });
});

test('follows interactive dismissal and a cancelled dismissal using the actual height', () => {
  let heights = { inset: 320, presentation: 320 };
  for (const height of [280, 160, 220, 320]) {
    heights = updateDirectMessageKeyboardHeights(
      heights, 'interactive', { height, duration: 0 }, true,
    );
    assert.deepEqual(heights, { inset: height, presentation: height });
  }
  heights = updateDirectMessageKeyboardHeights(
    heights, 'end', { height: 320, duration: 250 }, true,
  );
  assert.deepEqual(heights, { inset: 320, presentation: 320 });
});

test('keeps reading history during iOS keyboard opening instead of forcing the bottom', () => {
  const heights = updateDirectMessageKeyboardHeights(
    { inset: 0, presentation: 0 }, 'start', { height: 320, duration: 250 }, true,
  );
  const props = getDirectMessageScrollProps({
    contentHeight: 1_100,
    viewportHeight: 800,
    bottomInset: getDirectMessageBottomInset(54, heights.inset, 34),
  }, false, 125);
  assert.equal(props.contentInset.bottom, 374);
  assert.equal(props.contentOffset.y, 125);
});

test('uses presentation frames on platforms that do not animate an iOS native target', () => {
  let heights = updateDirectMessageKeyboardHeights(
    { inset: 0, presentation: 0 }, 'start', { height: 320, duration: 250 }, false,
  );
  assert.deepEqual(heights, { inset: 0, presentation: 0 });
  for (const height of [60, 160, 280, 320]) {
    heights = updateDirectMessageKeyboardHeights(
      heights, 'move', { height, duration: 250 }, false,
    );
    assert.deepEqual(heights, { inset: height, presentation: height });
  }
});

test('keeps the last message above a growing composer even without intervening scroll reports', () => {
  const composerHeights = [75, 77, 84, 97, 115, 134, 150, 159];
  const offsets = [];
  for (const composerHeight of composerHeights) {
    const bottomInset = getDirectMessageBottomInset(composerHeight, 320, 34);
    const props = getDirectMessageScrollProps({
      contentHeight: 1_100, viewportHeight: 800, bottomInset,
    }, true, 0);
    assert.equal(props.contentInset.bottom, bottomInset);
    assert.equal(1_100 - props.contentOffset.y, 800 - bottomInset);
    offsets.push(props.contentOffset.y);
  }
  // Six-line growth moves by all 84 points, regardless of native event cadence.
  assert.equal(offsets.at(-1) - offsets[0], 84);
});

test('tracks an appended multiline message while the cleared composer shrinks', () => {
  const frames = [
    { contentHeight: 1_100, composerHeight: 159, expectedOffset: 779 },
    { contentHeight: 1_230, composerHeight: 150, expectedOffset: 900 },
    { contentHeight: 1_230, composerHeight: 115, expectedOffset: 865 },
    { contentHeight: 1_230, composerHeight: 75, expectedOffset: 825 },
    { contentHeight: 1_230, composerHeight: 54, expectedOffset: 804 },
  ];
  for (const { contentHeight, composerHeight, expectedOffset } of frames) {
    const bottomInset = getDirectMessageBottomInset(composerHeight, 320, 34);
    const offset = getDirectMessageScrollEndOffset({
      contentHeight, viewportHeight: 800, bottomInset,
    });
    assert.equal(offset, expectedOffset);
    assert.equal(contentHeight - offset, 800 - bottomInset);
  }
});

test('registers inset and offset together from the first render through measurement', () => {
  const initial = getDirectMessageScrollProps({
    contentHeight: 0, viewportHeight: 0, bottomInset: 0,
  }, false, 0);
  const measured = getDirectMessageScrollProps({
    contentHeight: 1_100, viewportHeight: 800, bottomInset: 88,
  }, true, 0);
  assert.deepEqual(Object.keys(initial), Object.keys(measured));
  assert.deepEqual(initial.contentOffset, { x: 0, y: 0 });
  assert.equal(measured.contentInset.bottom, 88);
  assert.equal(measured.contentOffset.y, 388);
});

test('retains the history position when the keyboard or composer inset changes', () => {
  for (const bottomInset of [88, 374, 479, 88]) {
    const props = getDirectMessageScrollProps({
      contentHeight: 1_100, viewportHeight: 800, bottomInset,
    }, false, 125);
    assert.equal(props.contentInset.bottom, bottomInset);
    assert.equal(props.contentOffset.y, 125);
  }
});

test('starts a short chat at the top and scrolls only when the growing input leaves too little room', () => {
  const metrics = { contentHeight: 420, viewportHeight: 800, bottomInset: 374 };
  assert.equal(getDirectMessageScrollEndOffset(metrics), 0);
  assert.equal(getDirectMessageScrollEndOffset({ ...metrics, bottomInset: 479 }), 99);
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

test('groups a transcript into runs with one tail and timestamps after long pauses', () => {
  const at = (minutes) => new Date(2026, 9, 19, 10, minutes).toISOString();
  const layout = layoutDirectMessageRows([
    { createdAt: at(0), isMine: false },
    { createdAt: at(1), isMine: false },
    { createdAt: at(2), isMine: true },
    { createdAt: at(3), isMine: true },
    { createdAt: at(45), isMine: true },
  ]);
  assert.deepEqual(layout, [
    { startsRun: true, tail: false, timestamp: true },
    { startsRun: false, tail: true, timestamp: false },
    { startsRun: true, tail: false, timestamp: false },
    // The pause before the next message closes this run, so it gets the tail.
    { startsRun: false, tail: true, timestamp: false },
    { startsRun: true, tail: true, timestamp: true },
  ]);
});

test('starts a timestamped block on a new day even after a short pause', () => {
  const layout = layoutDirectMessageRows([
    { createdAt: new Date(2026, 9, 18, 23, 58).toISOString(), isMine: true },
    { createdAt: new Date(2026, 9, 19, 0, 2).toISOString(), isMine: true },
  ]);
  assert.equal(layout[1]?.timestamp, true);
  assert.equal(layout[0]?.tail, true);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consumeCommentsChanged,
  markCommentsChanged,
} from './comment-events.ts';
import {
  getCommentTargetKey,
  resolveBookCommentTarget,
  toBookCommentRouteParams,
  toCommentTargetRouteParams,
} from './comment-target.ts';

test('comic comments route to the official series target', () => {
  const routeParams = toBookCommentRouteParams({
    bookId: 42,
    bookType: 'Comic',
    seriesTitle: '  Comic series  ',
  });
  assert.deepEqual(routeParams, {
    commentType: 'Series',
    id: '42',
    seriesTitle: 'Comic series',
  });

  const target = resolveBookCommentTarget({
    bookId: Number(routeParams.id),
    commentType: routeParams.commentType,
    seriesTitle: routeParams.seriesTitle,
  });
  assert.deepEqual(target, {
    type: 'Series',
    id: 0,
    seriesTitle: 'Comic series',
  });
  assert.equal(getCommentTargetKey(target), 'Series:0:Comic series');
  assert.deepEqual(toCommentTargetRouteParams(target), {
    commentType: 'Series',
    seriesTitle: 'Comic series',
  });
});

test('series comment refresh signals cannot cross series namespaces', () => {
  const firstSeries = { type: 'Series', id: 0, seriesTitle: 'First series' };
  const secondSeries = { type: 'Series', id: 0, seriesTitle: 'Second series' };

  markCommentsChanged(firstSeries);
  assert.equal(consumeCommentsChanged(secondSeries), false);
  assert.equal(consumeCommentsChanged(firstSeries), true);
  assert.equal(consumeCommentsChanged(firstSeries), false);
});

test('novel comments retain their positive book target', () => {
  const routeParams = toBookCommentRouteParams({
    bookId: 17,
    bookType: 'Novel',
    seriesTitle: 'Ignored series',
  });
  assert.deepEqual(routeParams, { commentType: 'Book', id: '17' });
  assert.deepEqual(resolveBookCommentTarget({
    bookId: Number(routeParams.id),
    commentType: routeParams.commentType,
  }), { type: 'Book', id: 17 });
});

test('malformed series route params cannot silently enter the book namespace', () => {
  assert.deepEqual(resolveBookCommentTarget({
    bookId: 9,
    commentType: 'Series',
    seriesTitle: ' ',
  }), { type: 'Series', id: 0 });
  assert.throws(
    () => resolveBookCommentTarget({ bookId: 9, commentType: 'series' }),
    /unknown comment target type/i,
  );
});

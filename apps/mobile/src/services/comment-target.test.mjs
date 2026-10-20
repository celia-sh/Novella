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

test('comic comments use the Book target namespace', () => {
  const routeParams = toBookCommentRouteParams({ bookId: 42 });
  assert.deepEqual(routeParams, { commentType: 'Book', id: '42' });

  const target = resolveBookCommentTarget({
    bookId: Number(routeParams.id),
    commentType: routeParams.commentType,
  });
  assert.deepEqual(target, { type: 'Book', id: 42 });
  assert.equal(getCommentTargetKey(target), 'Book:42');
  assert.deepEqual(toCommentTargetRouteParams(target), { commentType: 'Book' });
});

test('comment refresh signals are scoped by book id', () => {
  const firstBook = { type: 'Book', id: 41 };
  const secondBook = { type: 'Book', id: 42 };

  markCommentsChanged(firstBook);
  assert.equal(consumeCommentsChanged(secondBook), false);
  assert.equal(consumeCommentsChanged(firstBook), true);
  assert.equal(consumeCommentsChanged(firstBook), false);
});

test('removed series comment route params are rejected', () => {
  assert.throws(
    () => resolveBookCommentTarget({ bookId: 9, commentType: 'Series' }),
    /unknown comment target type/i,
  );
});

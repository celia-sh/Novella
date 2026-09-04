import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendCommentPage,
  nextCommentPage,
  normalizeCommentPage,
} from './comment-pagination.ts';

function item(id) {
  return {
    canEdit: false,
    content: `comment ${id}`,
    createdAt: '2026-01-01T00:00:00Z',
    id,
    replies: [],
    user: { avatarUrl: '', id: 1, userName: 'reader' },
  };
}

function page(pageNumber, totalPages, ids) {
  return { items: ids.map(item), page: pageNumber, totalPages };
}

test('comment pagination advances from the requested page, not the response page', () => {
  const current = page(1, 1, [1]);
  const incoming = page(1, 1, [2]);
  const result = appendCommentPage(current, incoming, 2);

  assert.equal(result.page.page, 2);
  assert.deepEqual(result.page.items.map(({ id }) => id), [1, 2]);
  assert.equal(result.hasNewItems, true);
  assert.equal(result.hasMore, true);
  assert.equal(nextCommentPage(result.page, result.page.page), 3);
});

test('a non-empty page can continue when TotalPages is stale or under-reported', () => {
  assert.equal(nextCommentPage(page(1, 1, [1, 2]), 1), 2);
  assert.equal(nextCommentPage(page(2, 2, [3]), 2), 3);
  assert.equal(nextCommentPage(page(3, 3, []), 3), null);
});

test('a repeated page stops pagination instead of re-requesting forever', () => {
  const result = appendCommentPage(page(1, 3, [1, 2]), page(1, 3, [1, 2]), 2);

  assert.deepEqual(result.page.items.map(({ id }) => id), [1, 2]);
  assert.equal(result.hasNewItems, false);
  assert.equal(result.hasMore, false);
});

test('normalization preserves server totals while making the requested cursor authoritative', () => {
  assert.deepEqual(normalizeCommentPage(page(1, 1, [1]), 2), {
    items: [item(1)],
    page: 2,
    totalPages: 2,
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createComicBookDetailParams,
  findPreviousBookDetailRoute,
  updateComicVersionInDetail,
} from './book-version-navigation.ts';

test('version params target the selected comic detail', () => {
  assert.deepEqual(createComicBookDetailParams({
    coverPlaceholder: null,
    coverUrl: 'https://example.com/cover.jpg',
    seriesTitle: 'Series',
    title: 'Volume 2',
    versionId: 42,
  }), {
    cover: 'https://example.com/cover.jpg',
    id: '42',
    placeholder: '',
    seriesTitle: 'Series',
    title: 'Volume 2',
    type: 'Comic',
  });
});

test('version switching finds the nearest detail route below the picker', () => {
  const detailRoute = findPreviousBookDetailRoute({
    index: 3,
    routes: [
      { key: 'tabs', name: '(tabs)' },
      { key: 'older-detail', name: 'book/[id]' },
      { key: 'current-detail', name: 'book/[id]' },
      { key: 'versions', name: 'book/[id]/versions' },
    ],
  });

  assert.deepEqual(detailRoute, { key: 'current-detail', name: 'book/[id]' });
});

test('version switching updates the existing detail route before going back', () => {
  const actions = [];
  const navigation = {
    getState: () => ({
      index: 2,
      routes: [
        { key: 'detail', name: 'book/[id]' },
        { key: 'versions', name: 'book/[id]/versions' },
      ],
    }),
    dispatch: (action) => actions.push(action),
    goBack: () => actions.push('goBack'),
  };
  const params = createComicBookDetailParams({
    coverPlaceholder: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    coverUrl: 'https://example.com/cover.jpg',
    seriesTitle: 'Series',
    title: 'Volume 2',
    versionId: 42,
  });

  assert.equal(updateComicVersionInDetail(navigation, params), true);
  assert.deepEqual(actions, [
    {
      payload: { params },
      source: 'detail',
      type: 'SET_PARAMS',
    },
    'goBack',
  ]);
});

test('version switching has no detail target for a standalone picker route', () => {
  assert.equal(findPreviousBookDetailRoute({
    index: 1,
    routes: [{ key: 'versions', name: 'book/[id]/versions' }],
  }), undefined);
  assert.equal(findPreviousBookDetailRoute(undefined), undefined);

  const actions = [];
  assert.equal(updateComicVersionInDetail({
    getState: () => ({
      index: 1,
      routes: [{ key: 'versions', name: 'book/[id]/versions' }],
    }),
    dispatch: (action) => actions.push(action),
    goBack: () => actions.push('goBack'),
  }, createComicBookDetailParams({
    coverPlaceholder: null,
    coverUrl: 'https://example.com/cover.jpg',
    seriesTitle: 'Series',
    title: 'Volume 2',
    versionId: 42,
  })), false);
  assert.deepEqual(actions, []);
});

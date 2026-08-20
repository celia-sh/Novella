import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getShelfMoveDestinations,
  resolveShelfSelectionActions,
} from './shelf-editing.ts';

const snapshot = {
  books: [],
  items: [
    { id: 'first', index: 0, parents: [], title: 'First', type: 'FOLDER', updatedAt: 'a' },
    { id: 'second', index: 1, parents: [], title: 'Second', type: 'FOLDER', updatedAt: 'a' },
    { id: 'nested', index: 0, parents: ['first'], title: 'Nested', type: 'FOLDER', updatedAt: 'a' },
  ],
  version: 'v1',
};

test('root shelf moves only into root folders', () => {
  assert.deepEqual(getShelfMoveDestinations(snapshot, [], 'Root'), [
    { id: 'first', label: 'First', path: ['first'] },
    { id: 'second', label: 'Second', path: ['second'] },
  ]);
});

test('folder shelf moves out to root or directly into another root folder', () => {
  assert.deepEqual(getShelfMoveDestinations(snapshot, ['first'], 'Root'), [
    { id: null, label: 'Root', path: [] },
    { id: 'second', label: 'Second', path: ['second'] },
  ]);
});

test('selection actions reject folder moves and require a destination', () => {
  assert.deepEqual(resolveShelfSelectionActions({
    destinationCount: 1,
    selectedBookCount: 2,
    selectedFolderCount: 0,
  }), { canDelete: true, canMove: true });
  assert.deepEqual(resolveShelfSelectionActions({
    destinationCount: 1,
    selectedBookCount: 2,
    selectedFolderCount: 1,
  }), { canDelete: true, canMove: false });
  assert.deepEqual(resolveShelfSelectionActions({
    destinationCount: 0,
    selectedBookCount: 2,
    selectedFolderCount: 0,
  }), { canDelete: true, canMove: false });
  assert.deepEqual(resolveShelfSelectionActions({
    destinationCount: 1,
    selectedBookCount: 0,
    selectedFolderCount: 0,
  }), { canDelete: false, canMove: false });
});

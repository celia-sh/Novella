import assert from 'node:assert/strict';
import test from 'node:test';

import { createDebouncedCommit } from './debounced-commit.ts';

function createManualScheduler() {
  let nextHandle = 0;
  let pending = null;
  return {
    clear() {
      pending = null;
    },
    run() {
      const callback = pending;
      pending = null;
      callback?.();
    },
    set(callback) {
      pending = callback;
      nextHandle += 1;
      return nextHandle;
    },
  };
}

test('debounced commit keeps only the latest rapid value', () => {
  const scheduler = createManualScheduler();
  const committed = [];
  const debounced = createDebouncedCommit(
    (value) => committed.push(value),
    180,
    scheduler,
  );

  debounced.schedule('#111111');
  debounced.schedule('#222222');
  assert.deepEqual(committed, []);

  scheduler.run();
  assert.deepEqual(committed, ['#222222']);
});

test('disposing a debounced commit flushes the pending value once', () => {
  const scheduler = createManualScheduler();
  const committed = [];
  const debounced = createDebouncedCommit(
    (value) => committed.push(value),
    180,
    scheduler,
  );

  debounced.schedule('#ABCDEF');
  debounced.dispose();
  debounced.dispose();
  debounced.schedule('#000000');

  assert.deepEqual(committed, ['#ABCDEF']);
});

test('flush commits immediately and replaces the pending timer', () => {
  const scheduler = createManualScheduler();
  const committed = [];
  const debounced = createDebouncedCommit(
    (value) => committed.push(value),
    180,
    scheduler,
  );

  debounced.schedule('#123456');
  debounced.flush();
  scheduler.run();

  assert.deepEqual(committed, ['#123456']);
});

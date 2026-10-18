import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readerProgressStep,
  resolveComicPageProgress,
  resolveReaderProgressSliderState,
  resolveReaderSideProgressInfo,
  snapReaderProgress,
} from './reader-page-progress.ts';

test('reader progress snaps to page positions', () => {
  assert.equal(readerProgressStep(5), 0.25);
  assert.equal(snapReaderProgress(0.12, 5), 0);
  assert.equal(snapReaderProgress(0.14, 5), 0.25);
  assert.equal(snapReaderProgress(0.94, 5), 1);
  assert.equal(snapReaderProgress(0.5, 1), 1);
});

test('two-page chapters only have their two endpoints', () => {
  assert.equal(readerProgressStep(2), 1);
  assert.equal(snapReaderProgress(0.49, 2), 0);
  assert.equal(snapReaderProgress(0.5, 2), 1);
  assert.equal(snapReaderProgress(0.99, 2), 1);
});

test('paged novel chapters step by their measured pages', () => {
  assert.deepEqual(
    resolveReaderProgressSliderState({
      displayMode: 'percentage',
      pageStepped: true,
      pageTotal: 2,
      progress: 0.4,
    }),
    { disabled: false, progress: 0, step: 1, stepped: true },
  );
  assert.deepEqual(
    resolveReaderProgressSliderState({
      displayMode: 'percentage',
      pageStepped: true,
      pageTotal: 3,
      progress: 0.7,
    }),
    { disabled: false, progress: 0.5, step: 0.5, stepped: true },
  );
});

test('scroll mode keeps percentage progress continuous above one screen', () => {
  assert.deepEqual(
    resolveReaderProgressSliderState({
      displayMode: 'percentage',
      pageStepped: false,
      pageTotal: 4,
      progress: 0.42,
    }),
    { disabled: false, progress: 0.42, step: 0.01, stepped: false },
  );
  assert.deepEqual(
    resolveReaderProgressSliderState({
      displayMode: 'percentage',
      pageStepped: false,
      pageTotal: 1,
      progress: 0.42,
    }),
    { disabled: true, progress: 1, step: 0.01, stepped: false },
  );
});

test('an unmeasured percentage chapter falls back to 1% steps', () => {
  assert.deepEqual(
    resolveReaderProgressSliderState({
      displayMode: 'percentage',
      pageStepped: true,
      pageTotal: 0,
      progress: 0.42,
    }),
    { disabled: false, progress: 0.42, step: 0.01, stepped: false },
  );
});

test('comic pages always step by page and lock a single page', () => {
  assert.deepEqual(
    resolveReaderProgressSliderState({
      displayMode: 'pages',
      pageStepped: false,
      pageTotal: 2,
      progress: 0.7,
    }),
    { disabled: false, progress: 1, step: 1, stepped: true },
  );
  assert.deepEqual(
    resolveReaderProgressSliderState({
      displayMode: 'pages',
      pageStepped: false,
      pageTotal: 1,
      progress: 0,
    }),
    { disabled: true, progress: 1, step: 1, stepped: false },
  );
});

test('side-bar progress combines percentage and page count', () => {
  assert.deepEqual(
    resolveReaderSideProgressInfo({
      displayMode: 'percentage',
      pageCurrent: 0,
      pageStepped: true,
      pageTotal: 5,
      progress: 0.5,
    }),
    { pageLabel: '3/5', percent: 50 },
  );
  assert.deepEqual(
    resolveReaderSideProgressInfo({
      displayMode: 'pages',
      pageCurrent: 4,
      pageTotal: 10,
      progress: 0.3,
    }),
    { pageLabel: '4/10', percent: 33 },
  );
  assert.deepEqual(
    resolveReaderSideProgressInfo({
      displayMode: 'percentage',
      pageCurrent: 0,
      pageTotal: 0,
      progress: 0.42,
    }),
    { pageLabel: '', percent: 42 },
  );
});

test('comic progress clamps to the available image range', () => {
  assert.deepEqual(resolveComicPageProgress(20, 5), {
    current: 5,
    progress: 1,
    total: 5,
  });
  assert.deepEqual(resolveComicPageProgress(-1, 0), {
    current: 0,
    progress: 0,
    total: 0,
  });
});

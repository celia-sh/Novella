import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveReaderBoundaryAxis,
  resolveReaderBoundaryChapterAction,
  resolveReaderPagedBoundaryChapterAction,
} from './reader-boundary-gesture.ts';

test('boundary gestures require an outward release at the chapter edge', () => {
  const base = {
    axis: 'vertical',
    contentExtent: 2400,
    viewportExtent: 800,
    threshold: 24,
    velocityThreshold: 0.35,
  };
  assert.equal(resolveReaderBoundaryChapterAction({ ...base, offset: 0, velocity: -0.8 }), 'previous');
  assert.equal(resolveReaderBoundaryChapterAction({ ...base, offset: 0, velocity: 0.2 }), null);
  assert.equal(resolveReaderBoundaryChapterAction({ ...base, offset: 1600, velocity: 0.8 }), 'next');
  assert.equal(resolveReaderBoundaryChapterAction({ ...base, offset: 800, velocity: 0.8 }), null);
});

test('short content never turns a boundary swipe into a chapter change', () => {
  assert.equal(resolveReaderBoundaryChapterAction({
    axis: 'horizontal',
    contentExtent: 400,
    offset: 0,
    velocity: -1,
    viewportExtent: 800,
  }), null);
});

test('paged boundary gestures reverse physical direction in RTL', () => {
  const base = {
    displayCount: 5,
    threshold: 24,
  };
  assert.equal(resolveReaderPagedBoundaryChapterAction({
    ...base,
    deltaX: -80,
    direction: 'ltr',
    displayIndex: 0,
  }), null);
  assert.equal(resolveReaderPagedBoundaryChapterAction({
    ...base,
    deltaX: -80,
    direction: 'ltr',
    displayIndex: 4,
  }), 'next');
  assert.equal(resolveReaderPagedBoundaryChapterAction({
    ...base,
    deltaX: -80,
    direction: 'rtl',
    displayIndex: 0,
  }), 'previous');
  assert.equal(resolveReaderPagedBoundaryChapterAction({
    ...base,
    deltaX: 80,
    direction: 'rtl',
    displayIndex: 4,
  }), 'next');
});

test('paged boundary gestures ignore swipes away from the matching edge', () => {
  assert.equal(resolveReaderPagedBoundaryChapterAction({
    deltaX: 80,
    direction: 'ltr',
    displayCount: 5,
    displayIndex: 4,
  }), null);
  assert.equal(resolveReaderPagedBoundaryChapterAction({
    deltaX: -80,
    direction: 'rtl',
    displayCount: 5,
    displayIndex: 4,
  }), null);
});

test('reader mode selects the matching native scroll axis', () => {
  assert.equal(resolveReaderBoundaryAxis('paged'), 'horizontal');
  assert.equal(resolveReaderBoundaryAxis('scroll'), 'vertical');
});

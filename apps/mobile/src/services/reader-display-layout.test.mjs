import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createComicPageDisplaySlots,
  fitComicPageSpread,
  isComicPagePairable,
  resolveComicDisplayIndex,
  resolveComicDisplayItemIndex,
  resolveComicDisplaySlotIndex,
  resolveComicSourceSegmentIndex,
  resolveComicViewportRestoreTarget,
  shouldSplitLongComicPages,
  shouldUseReaderDoublePage,
} from './reader-display-layout.ts';

test('double-page layout is reserved for large landscape viewports', () => {
  assert.equal(shouldUseReaderDoublePage(1366, 1024), true);
  assert.equal(shouldUseReaderDoublePage(844, 390), false);
  assert.equal(shouldUseReaderDoublePage(1024, 1366), false);
});

test('comic double-page sizing fills height without adding a center gap', () => {
  const sizes = fitComicPageSpread([
    { index: 0, image: { width: 2, height: 3, placeholder: '', url: 'a' } },
    { index: 1, image: { width: 2, height: 3, placeholder: '', url: 'b' } },
  ], 1366, 1024);
  assert.equal(sizes.length, 2);
  assert.equal(sizes[0].height, 1024);
  assert.equal(sizes[1].height, 1024);
  assert.ok(Math.abs(sizes[0].width + sizes[1].width - 1366) < 1);

  const constrained = fitComicPageSpread([
    { index: 0, image: { width: 2, height: 3, placeholder: '', url: 'a' } },
    { index: 1, image: { width: 2, height: 3, placeholder: '', url: 'b' } },
  ], 1000, 1000);
  assert.ok(Math.abs(constrained[0].width + constrained[1].width - 1000) < 1);
  assert.equal(constrained[0].height, 750);
});

test('wide pages stay isolated while portrait pages continue pairing', () => {
  const wide = { index: 1, image: { width: 1600, height: 900, placeholder: '', url: 'wide' } };
  const slots = createComicPageDisplaySlots([
    { index: 0, image: { width: 1000, height: 1500, placeholder: '', url: 'a' } },
    wide,
    { index: 2, image: { width: 1000, height: 1500, placeholder: '', url: 'c' } },
    { index: 3, image: { width: 1000, height: 1500, placeholder: '', url: 'd' } },
  ], 2);
  assert.equal(isComicPagePairable(wide), false);
  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [
    [0],
    [1],
    [2, 3],
  ]);
  assert.equal(resolveComicDisplaySlotIndex(0, slots), 0);
  assert.equal(resolveComicDisplaySlotIndex(1, slots), 1);
  assert.equal(resolveComicDisplaySlotIndex(3, slots), 2);
  assert.deepEqual(fitComicPageSpread([wide], 1366, 1024)[0], {
    width: 1366,
    height: 768.375,
  });
});

test('consecutive wide pages do not form a compressed spread', () => {
  const slots = createComicPageDisplaySlots([
    { index: 0, image: { width: 2400, height: 1600, placeholder: '', url: 'a' } },
    { index: 1, image: { width: 2400, height: 1600, placeholder: '', url: 'b' } },
  ], 2);
  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [[0], [1]]);
});

test('missing dimensions remain pairable until metadata is authoritative', () => {
  const slots = createComicPageDisplaySlots([
    { index: 0, image: null },
    { index: 1, image: { width: 0, height: 900, placeholder: '', url: 'b' } },
    { index: 2, image: { width: 1600, height: 900, placeholder: '', url: 'wide' } },
  ], 2);
  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [[0, 1], [2]]);
});

test('comic viewport restore uses metadata-aware display slots', () => {
  const slots = createComicPageDisplaySlots([
    { index: 0, image: { width: 1000, height: 1500, placeholder: '', url: 'a' } },
    { index: 1, image: { width: 1600, height: 900, placeholder: '', url: 'wide' } },
    { index: 2, image: { width: 1000, height: 1500, placeholder: '', url: 'c' } },
    { index: 3, image: { width: 1000, height: 1500, placeholder: '', url: 'd' } },
  ], 2);
  assert.deepEqual(resolveComicViewportRestoreTarget(3, 4, 2, slots), {
    displayIndex: 2,
    pageIndex: 3,
  });
});

test('phone paged mode splits a known wide spread into horizontal segments', () => {
  const wideSpread = {
    index: 0,
    image: { width: 1854, height: 1500, placeholder: '', url: 'spread' },
  };
  const slots = createComicPageDisplaySlots([wideSpread], 1, {
    splitLongPages: true,
    viewportHeight: 844,
    viewportWidth: 390,
  });
  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [[0], [0]]);
  assert.deepEqual(slots.map((slot) => slot.items[0]?.segmentAxis), ['horizontal', 'horizontal']);
  assert.deepEqual(slots.map((slot) => slot.items[0]?.segmentIndex), [0, 1]);
  assert.deepEqual(slots.map((slot) => slot.items[0]?.segmentCount), [2, 2]);
  assert.equal(slots[0]?.items[0]?.segmentWidth, 390);
  assert.ok(Math.abs((slots[0]?.items[0]?.segmentHeight ?? 0) - 631.067) < 0.01);
  assert.equal(slots[0]?.items[0]?.renderedImageWidth, 780);
  assert.equal(slots[0]?.items[0]?.segmentOffset, 0);
  assert.equal(slots[1]?.items[0]?.segmentOffset, 390);
  assert.equal(resolveComicDisplayItemIndex(0, slots, 1), 1);
  assert.equal(resolveComicSourceSegmentIndex(0, 2, 'horizontal', 'ltr'), 0);
  assert.equal(resolveComicSourceSegmentIndex(0, 2, 'horizontal', 'rtl'), 1);
  assert.equal(resolveComicSourceSegmentIndex(1, 2, 'horizontal', 'rtl'), 0);
  assert.equal(resolveComicSourceSegmentIndex(1, 2, 'vertical', 'rtl'), 1);
});

test('phone paged mode splits a known very tall page into virtual segments', () => {
  const longPage = {
    index: 0,
    image: { width: 1000, height: 3000, placeholder: '', url: 'long' },
  };
  const slots = createComicPageDisplaySlots([longPage], 1, {
    splitLongPages: true,
    viewportHeight: 844,
    viewportWidth: 390,
  });
  assert.equal(shouldSplitLongComicPages(390, 844, 1), true);
  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [[0], [0]]);
  assert.deepEqual(slots.map((slot) => slot.items[0]?.segmentIndex), [0, 1]);
  assert.deepEqual(slots.map((slot) => slot.items[0]?.segmentCount), [2, 2]);
  assert.equal(slots[1]?.items[0]?.segmentOffset, 844);
  assert.equal(slots[0]?.items[0]?.renderedImageHeight, 1170);
  assert.equal(resolveComicDisplaySlotIndex(0, slots), 0);
  assert.equal(resolveComicDisplayItemIndex(0, slots, 1), 1);
  assert.deepEqual(resolveComicViewportRestoreTarget(0, 1, 1, slots, 1), {
    displayIndex: 1,
    pageIndex: 0,
  });
});

test('long-page splitting is scoped to single-column phone-sized viewports', () => {
  const longPage = {
    index: 0,
    image: { width: 1000, height: 3000, placeholder: '', url: 'long' },
  };
  const options = { splitLongPages: true, viewportHeight: 844, viewportWidth: 390 };
  assert.equal(shouldSplitLongComicPages(1366, 1024, 2), false);
  assert.equal(shouldSplitLongComicPages(1024, 1366, 1), false);
  assert.equal(createComicPageDisplaySlots([longPage], 2, options).length, 1);
  assert.equal(createComicPageDisplaySlots([longPage], 1, {
    splitLongPages: true,
    viewportHeight: 844,
    viewportWidth: 390,
  }).length, 2);
});

test('unknown dimensions and ordinary portrait pages are not split', () => {
  const slots = createComicPageDisplaySlots([
    { index: 0, image: null },
    { index: 1, image: { width: 0, height: 3000, placeholder: '', url: 'invalid' } },
    { index: 2, image: { width: 1000, height: 1500, placeholder: '', url: 'portrait' } },
  ], 1, {
    splitLongPages: true,
    viewportHeight: 844,
    viewportWidth: 390,
  });
  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [[0], [1], [2]]);
  assert.deepEqual(slots.map((slot) => slot.items[0]?.segmentCount), [1, 1, 1]);
});

test('comic viewport restore keeps the live page while changing spread columns', () => {
  assert.deepEqual(resolveComicViewportRestoreTarget(5, 12, 1), {
    displayIndex: 5,
    pageIndex: 5,
  });
  assert.deepEqual(resolveComicViewportRestoreTarget(5, 12, 2), {
    displayIndex: 2,
    pageIndex: 5,
  });
  assert.deepEqual(resolveComicViewportRestoreTarget(999, 3, 2), {
    displayIndex: 1,
    pageIndex: 2,
  });
});

test('comic double-page offset leaves the opening page alone before pairing', () => {
  const slots = createComicPageDisplaySlots([
    { index: 0, image: null },
    { index: 1, image: null },
    { index: 2, image: null },
    { index: 3, image: null },
    { index: 4, image: null },
  ], 2, { doublePageOffset: true });

  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [
    [0],
    [1, 2],
    [3, 4],
  ]);
});

test('comic double-page offset keeps oversized pages isolated', () => {
  const slots = createComicPageDisplaySlots([
    { index: 0, image: { width: 1000, height: 1500, placeholder: '', url: 'cover' } },
    { index: 1, image: { width: 1600, height: 900, placeholder: '', url: 'wide' } },
    { index: 2, image: { width: 1000, height: 1500, placeholder: '', url: 'c' } },
    { index: 3, image: { width: 1000, height: 1500, placeholder: '', url: 'd' } },
  ], 2, { doublePageOffset: true });

  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [
    [0],
    [1],
    [2, 3],
  ]);
});

test('comic display slots group adjacent pages without changing page indexes', () => {
  const slots = createComicPageDisplaySlots([
    { index: 0, image: null },
    { index: 1, image: null },
    { index: 2, image: null },
  ], 2);
  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [[0, 1], [2]]);
  assert.equal(resolveComicDisplayIndex(0, 3, 2), 0);
  assert.equal(resolveComicDisplayIndex(1, 3, 2), 0);
  assert.equal(resolveComicDisplayIndex(2, 3, 2), 1);
});

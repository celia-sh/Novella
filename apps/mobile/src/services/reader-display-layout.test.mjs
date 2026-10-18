import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createComicPageDisplaySlots,
  fitComicPageSpread,
  isComicPagePairable,
  resolveComicDisplayIndex,
  resolveComicDisplaySlotIndex,
  resolveComicViewportRestoreTarget,
  shouldUseReaderDoublePage,
  shouldUseReaderSideChrome,
} from './reader-display-layout.ts';

test('double-page layout is reserved for large landscape viewports', () => {
  assert.equal(shouldUseReaderDoublePage(1366, 1024), true);
  assert.equal(shouldUseReaderDoublePage(844, 390), false);
  assert.equal(shouldUseReaderDoublePage(1024, 1366), false);
});

test('side chrome fallback matches the Duo inner display only', () => {
  assert.equal(shouldUseReaderSideChrome(951, 669, false), true);
  assert.equal(shouldUseReaderSideChrome(1366, 1024, true), false);
  assert.equal(shouldUseReaderSideChrome(844, 390, false), false);
  assert.equal(shouldUseReaderSideChrome(678, 466, false), false);
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

test('a tall page stays on one display slot in width-fit mode', () => {
  const longPage = {
    index: 0,
    image: { width: 1000, height: 3000, placeholder: '', url: 'long' },
  };
  const slots = createComicPageDisplaySlots([longPage], 1);
  assert.deepEqual(slots, [{ index: 0, pages: [longPage] }]);
  // The page keeps its full height; the paged reader pans it vertically instead
  // of moving the cropped remainder to a virtual next page.
  assert.deepEqual(fitComicPageSpread([longPage], 1000, 800, 'width'), [
    { width: 1000, height: 3000 },
  ]);
});

test('a wide page stays on one display slot in height-fit mode', () => {
  const widePage = {
    index: 0,
    image: { width: 4000, height: 1000, placeholder: '', url: 'wide' },
  };
  const slots = createComicPageDisplaySlots([widePage], 1);
  assert.deepEqual(slots, [{ index: 0, pages: [widePage] }]);
  // Height fit scales the page back to the viewport width rather than cropping.
  assert.deepEqual(fitComicPageSpread([widePage], 1000, 800, 'height'), [
    { width: 1000, height: 250 },
  ]);
});

test('width-fit comics keep wide pages isolated like screen fit', () => {
  const slots = createComicPageDisplaySlots([
    { index: 0, image: { width: 2000, height: 1000, placeholder: '', url: 'a' } },
    { index: 1, image: { width: 2000, height: 1000, placeholder: '', url: 'b' } },
  ], 2);
  assert.deepEqual(slots.map((slot) => slot.pages.map((page) => page.index)), [[0], [1]]);
});

test('height-fit spreads fill the viewport height', () => {
  const sizes = fitComicPageSpread([
    { index: 0, image: { width: 1000, height: 1500, placeholder: '', url: 'a' } },
    { index: 1, image: { width: 1000, height: 1500, placeholder: '', url: 'b' } },
  ], 1200, 800, 'height');
  assert.deepEqual(sizes, [
    { width: 533.3333333333334, height: 800 },
    { width: 533.3333333333334, height: 800 },
  ]);
});

test('width-fit spreads divide the viewport width between pages', () => {
  const sizes = fitComicPageSpread([
    { index: 0, image: { width: 1000, height: 1500, placeholder: '', url: 'a' } },
    { index: 1, image: { width: 1000, height: 1500, placeholder: '', url: 'b' } },
  ], 1000, 800, 'width');
  assert.deepEqual(sizes, [
    { width: 500, height: 750 },
    { width: 500, height: 750 },
  ]);
});

import type { NovelReaderBlock } from '@novella/reader-engine';

import { chapterHrefFor } from './reader-xhtml-builder.ts';
import { readiumBlockFragment } from './readium-publication.ts';

export interface ReadiumLocator {
  href: string;
  type: string;
  locations: {
    fragments?: string[];
    progression?: number;
  };
  text?: {
    after?: string;
    before?: string;
    highlight?: string;
  };
}

const MAX_ANCHOR_LENGTH = 80;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function blockTexts(blocks: readonly NovelReaderBlock[]): string[] {
  return blocks.map((block) => stripHtmlToText(block.html));
}

/** Finds the block whose text contains the longest suffix of `anchor`. */
function findBlockForAnchor(
  blocks: readonly NovelReaderBlock[],
  anchor: string,
): number {
  const needle = anchor.trim();
  if (!needle) return -1;
  const suffix = needle.length > MAX_ANCHOR_LENGTH
    ? needle.slice(-MAX_ANCHOR_LENGTH)
    : needle;
  const texts = blockTexts(blocks);
  let bestIndex = -1;
  let bestScore = -1;
  for (let index = 0; index < texts.length; index += 1) {
    const text = texts[index];
    if (!text) continue;
    if (text.includes(suffix)) {
      bestIndex = index;
      bestScore = suffix.length;
      break;
    }
    // Tolerate small punctuation drift at the anchor edges.
    const compactNeedle = suffix.replace(/[^\p{L}\p{N}]/gu, '');
    if (compactNeedle.length >= 12) {
      const compactText = text.replace(/[^\p{L}\p{N}]/gu, '');
      if (compactText.includes(compactNeedle)) {
        bestIndex = index;
        bestScore = compactNeedle.length;
        break;
      }
    }
  }
  return bestIndex;
}

/**
 * Maps a chapter scroll position (0-1 progression + visible-text anchor)
 * reported by the WebView back to the Novella server position format
 * ({ chapterId, position: block locator }). The anchor is matched against the
 * block texts; when it does not match, the progression is used as a fallback.
 */
export function readerPositionToBlock(
  progression: number,
  anchor: string | undefined,
  chapterId: number,
  blocks: readonly NovelReaderBlock[],
): { chapterId: number; position: string } | null {
  if (blocks.length === 0) return null;

  const blockIndex = anchor
    ? findBlockForAnchor(blocks, anchor)
    : -1;
  const resolved = blockIndex >= 0
    ? blockIndex
    : Math.floor(Math.max(0, Math.min(1, progression)) * blocks.length);

  const clamped = Math.max(0, Math.min(resolved, blocks.length - 1));
  const block = blocks[clamped];
  if (!block) return null;
  return { chapterId, position: block.locator };
}

/**
 * Maps a Novella server position (block locator) to a 0-1 scroll progression.
 * Progression is approximated by the block's text offset over the chapter's
 * total text length.
 */
export function readerPositionToProgression(
  position: string | null | undefined,
  chapterId: number,
  blocks: readonly NovelReaderBlock[],
): number {
  if (blocks.length === 0) return 0;

  if (!position) return 0;

  let index = blocks.findIndex((block) => block.locator === position);
  if (index < 0) {
    // Fall back to prefix matching (parent node paths) like the old renderer.
    let candidate = position;
    while (candidate.length > 0) {
      const slash = candidate.lastIndexOf('/');
      if (slash <= 0) break;
      candidate = candidate.slice(0, slash);
      index = blocks.findIndex((block) => block.locator === candidate);
      if (index >= 0) break;
    }
  }
  if (index < 0) return 0;

  const texts = blockTexts(blocks);
  let offset = 0;
  let total = 0;
  for (let blockIndex = 0; blockIndex < texts.length; blockIndex += 1) {
    const length = Math.max(1, (texts[blockIndex] ?? '').length);
    if (blockIndex < index) offset += length;
    total += length;
  }
  offset += Math.floor((texts[index] ?? '').length / 2);
  return Math.min(1, Math.max(0, offset / total));
}

/** Maps a canonical server block position to a stable Readium locator. */
export function readerPositionToReadiumLocator(
  position: string | null | undefined,
  chapterId: number,
  blocks: readonly NovelReaderBlock[],
): ReadiumLocator {
  const progression = readerPositionToProgression(position, chapterId, blocks);
  const blockIndex = findBlockIndexForPosition(position, blocks);
  const locations: ReadiumLocator['locations'] = { progression };
  if (blockIndex >= 0) locations.fragments = [readiumBlockFragment(blockIndex)];
  return {
    href: chapterHrefFor(chapterId),
    type: 'application/xhtml+xml',
    locations,
  };
}

/** Maps a Readium locator back to Novella's canonical server position. */
export function readiumLocatorToReaderPosition(
  locator: ReadiumLocator,
  chapterId: number,
  blocks: readonly NovelReaderBlock[],
): { chapterId: number; position: string } | null {
  if (blocks.length === 0 || locator.href !== chapterHrefFor(chapterId)) return null;

  const fragment = locator.locations.fragments?.find((value) => /^nv-block-\d+$/u.test(value));
  if (fragment) {
    const index = Number.parseInt(fragment.slice('nv-block-'.length), 10);
    const block = blocks[index];
    if (block) return { chapterId, position: block.locator };
  }

  const anchor = locator.text?.highlight || locator.text?.after || locator.text?.before;
  return readerPositionToBlock(
    locator.locations.progression ?? 0,
    anchor,
    chapterId,
    blocks,
  );
}

/** Kept for callers that need the chapter href (used as a stable key). */
export function chapterHrefForChapter(chapterId: number): string {
  return chapterHrefFor(chapterId);
}

function findBlockIndexForPosition(
  position: string | null | undefined,
  blocks: readonly NovelReaderBlock[],
): number {
  if (!position) return -1;
  let candidate = position;
  while (candidate.length > 0) {
    const index = blocks.findIndex((block) => block.locator === candidate);
    if (index >= 0) return index;
    const slash = candidate.lastIndexOf('/');
    if (slash <= 0) break;
    candidate = candidate.slice(0, slash);
  }
  return -1;
}

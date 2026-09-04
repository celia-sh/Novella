export type ReaderMode = 'scroll' | 'paged';
export type ReaderOpenPosition = 'saved' | 'start' | 'end';

export interface ReaderPosition {
  bookId: number;
  chapterId: number;
  locator: string;
  offset: number;
  updatedAt: string;
}

export interface ReaderRestorePosition {
  chapterId: number;
  position: string;
}

export interface CachedReaderRestorePosition extends ReaderRestorePosition {
  syncState: 'pending' | 'synced';
}

export interface ReaderProgress {
  completed: number;
  ratio: number;
  total: number;
}

export interface NovelFootnoteProcessingResult {
  html: string;
  notesById: Readonly<Record<string, string>>;
}

export interface NovelReaderBlock {
  id: string;
  locator: string;
  html: string;
  textLength: number;
  imageCount: number;
  listMarker?: string;
  listDepth?: number;
}

export interface ReaderPageSlice {
  start: number;
  end: number;
  firstBlockId: string;
}

export interface ComicPageSlot {
  index: number;
  image: ComicPageImage | null;
}

export interface ComicPageImage {
  url: string;
  placeholder: string;
  width: number;
  height: number;
}

export interface ReaderPositionWriteQueue<T> {
  commit(value: T): Promise<void>;
  dispose(): Promise<void>;
  flush(): Promise<void>;
  schedule(value: T): void;
}

export interface ReaderPositionWriteQueueOptions<T> {
  delayMs?: number;
  fingerprint?: (value: T) => string;
}

/**
 * Serializes reader-position writes so a slow older request can never finish
 * after and overwrite a newer chapter/position. Scheduled updates coalesce,
 * while commit preserves chapter-boundary snapshots in queue order.
 */
export function createReaderPositionWriteQueue<T>(
  persist: (value: T) => void | Promise<void>,
  options: ReaderPositionWriteQueueOptions<T> = {},
): ReaderPositionWriteQueue<T> {
  const delayMs = Math.max(0, options.delayMs ?? 450);
  const fingerprint = options.fingerprint ?? ((value: T) => JSON.stringify(value));
  let pending: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tail = Promise.resolve();
  let lastSuccessfulFingerprint: string | null = null;

  function clearTimer(): void {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function enqueue(value: T): Promise<void> {
    const valueFingerprint = fingerprint(value);
    const operation = tail.then(async () => {
      if (valueFingerprint === lastSuccessfulFingerprint) return;
      await persist(value);
      lastSuccessfulFingerprint = valueFingerprint;
    });
    tail = operation.catch(() => undefined);
    return operation;
  }

  function takePending(): Promise<void> | null {
    clearTimer();
    if (pending === null) return null;
    const value = pending;
    pending = null;
    return enqueue(value);
  }

  const queue: ReaderPositionWriteQueue<T> = {
    async commit(value) {
      takePending();
      const operation = enqueue(value);
      await operation.catch(() => undefined);
    },
    async dispose() {
      await queue.flush();
    },
    async flush() {
      const operation = takePending();
      if (operation) await operation.catch(() => undefined);
      await tail;
    },
    schedule(value) {
      pending = value;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        const valueToPersist = pending;
        pending = null;
        if (valueToPersist !== null) void enqueue(valueToPersist).catch(() => undefined);
      }, delayMs);
    },
  };

  return queue;
}

const EMPTY_INVISIBLE_CODEPOINTS: ReadonlySet<number> = new Set();
const ALWAYS_INVISIBLE_CODEPOINTS = new Set([0x200B, 0x200C, 0x200D, 0xFEFF]);
const HTML_ENTITY_PATTERN = /&(#(?:[xX][0-9A-Fa-f]+|[0-9]+)|[A-Za-z]+);/g;

export interface ReaderChapterCursor {
  sortNum: number;
  totalChapters: number;
}

export function getAdjacentChapterSortNum(
  cursor: ReaderChapterCursor,
  direction: 'next' | 'previous',
): number | null {
  const next = direction === 'next' ? cursor.sortNum + 1 : cursor.sortNum - 1;
  return next >= 1 && next <= cursor.totalChapters ? next : null;
}

export function resolveReaderInitialIndex(
  openPosition: ReaderOpenPosition,
  savedIndex: number,
  totalItems: number,
): number {
  const lastIndex = Math.max(0, Math.trunc(totalItems) - 1);
  if (openPosition === 'start') return 0;
  if (openPosition === 'end') return lastIndex;
  return Math.min(lastIndex, Math.max(0, Math.trunc(savedIndex)));
}

/**
 * Pending local data represents a user action not yet acknowledged by the
 * server. Acknowledged local data is only a fallback; the server then remains
 * authoritative for cross-device progress.
 */
export function resolveReaderRestorePosition(
  chapterId: number,
  server: ReaderRestorePosition | null,
  cached: CachedReaderRestorePosition | null,
  preferCached = false,
): ReaderRestorePosition | null {
  const localForChapter = cached?.chapterId === chapterId ? cached : null;
  const serverForChapter = server?.chapterId === chapterId ? server : null;
  if (localForChapter && (localForChapter.syncState === 'pending' || preferCached)) {
    return localForChapter;
  }
  return serverForChapter ?? localForChapter;
}

export function calculateReaderProgress(
  completed: number,
  total: number,
): ReaderProgress {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeCompleted = Math.min(
    safeTotal,
    Math.max(0, Math.trunc(completed)),
  );

  return {
    completed: safeCompleted,
    ratio: safeTotal === 0 ? 0 : safeCompleted / safeTotal,
    total: safeTotal,
  };
}

export interface NormalizeNovelBlocksOptions {
  /**
   * Skip invisible-codepoint stripping and entity repair so the block text
   * stays byte-identical with the WebView-rendered DOM.
   * The web master renders the raw server HTML the same way. Default: true
   * (legacy RN/Flutter text-layout behavior).
   */
  sanitize?: boolean;
}

/** Normalize server HTML into stable render units without importing a DOM runtime. */
export function normalizeNovelBlocks(
  html: string,
  invisibleCodepoints: ReadonlySet<number> = EMPTY_INVISIBLE_CODEPOINTS,
  options: NormalizeNovelBlocksOptions = {},
): NovelReaderBlock[] {
  const source = removeReaderMetadata(
    options.sanitize === false ? html : sanitizeNovelHtml(html, invisibleCodepoints),
  );
  const nodes = parseHtmlBlockNodes(source);
  const blocks = selectLeafBlockNodes(nodes, source);
  const result = blocks.map((node) => createNovelBlock(
    node.path,
    source.slice(node.start, node.end),
    readListMetadata(node),
  ));

  if (result.length > 0) return result;

  const fallback = source.trim();
  return fallback.length === 0 ? [] : [createNovelBlock('//*', fallback)];
}

export function sanitizeNovelHtml(
  html: string,
  invisibleCodepoints: ReadonlySet<number> = EMPTY_INVISIBLE_CODEPOINTS,
): string {
  return html.replace(/([^<]+)(?=<|$)/g, (text) => {
    const repaired = text
      .replace(/&(?:\u200B*[#A-Za-z0-9xX]+)+\u200B*;/g, (entity) => entity.replace(/\u200B/g, ''))
      .replace(HTML_ENTITY_PATTERN, (entity, token: string) => {
        const codepoint = decodeNumericHtmlEntity(token);
        return codepoint !== null && isInvisibleReaderCodepoint(codepoint, invisibleCodepoints)
          ? ''
          : entity;
      });
    return Array.from(repaired).filter((character) => {
      const codepoint = character.codePointAt(0);
      return codepoint === undefined || !isInvisibleReaderCodepoint(codepoint, invisibleCodepoints);
    }).join('');
  });
}

export interface ProcessNovelFootnotesOptions {
  /** Content retained inside extracted footnote anchors. */
  markerContent?: 'empty' | 'placeholder';
}

export function processNovelFootnotes(
  html: string,
  options: ProcessNovelFootnotesOptions = {},
): NovelFootnoteProcessingResult {
  const notesById: Record<string, string> = {};
  const elements = parseHtmlElementRanges(html);
  const markers = selectOutermostFootnoteMarkers(elements, html);
  const markerContent = options.markerContent === 'empty' ? '' : '*';
  const replacements: HtmlReplacement[] = [];
  const removedTargets = new Set<string>();

  for (const marker of markers) {
    const existingId = readHtmlAttribute(marker.openingTag, 'data-reader-footnote-id')
      ?? readHtmlAttribute(marker.openingTag, 'data-footnote-id');
    const href = readHtmlAttribute(marker.openingTag, 'href');
    const id = existingId ?? footnoteFragmentId(href);
    if (!id) continue;

    replacements.push({
      start: marker.start,
      end: marker.end,
      value: `<a data-reader-footnote-id="${escapeHtmlAttribute(id)}">${markerContent}</a>`,
    });

    const note = findFootnoteTarget(elements, id)
      ?? findFollowingLegacyFootnoteTarget(elements, marker, markers);
    if (!note || removedTargets.has(`${note.start}:${note.end}`)) continue;
    notesById[id] = html.slice(note.openingEnd, note.closingStart);
    removedTargets.add(`${note.start}:${note.end}`);
    replacements.push({ start: note.start, end: note.end, value: '' });
  }

  return { html: applyHtmlReplacements(html, replacements), notesById };
}

/**
 * Restores extracted footnote bodies to chapter flow immediately after the
 * block containing their marker. This is the native-reader equivalent of the
 * former Readium chapter materialization step; it deliberately does not depend
 * on a React Native sheet or another interaction layer.
 */
export function inlineNovelFootnotesAfterBlocks(
  blocks: readonly NovelReaderBlock[],
  notesById: Readonly<Record<string, string>>,
): NovelReaderBlock[] {
  return blocks.flatMap((block) => {
    const noteIds: string[] = [];
    const withoutMarkers = block.html.replace(
      /<a\b[^>]*\bdata-reader-footnote-id=(?:"([^"]+)"|'([^']+)')[^>]*>[\s\S]*?<\/a\s*>/giu,
      (match, doubleId: string | undefined, singleId: string | undefined) => {
        const id = doubleId ?? singleId;
        if (!id || notesById[id] === undefined) return match;
        if (!noteIds.includes(id)) noteIds.push(id);
        return '';
      },
    );
    if (noteIds.length === 0) return [block];

    const visibleText = withoutMarkers
      .replace(/<[^>]*>/gu, ' ')
      .replace(/&nbsp;|&#160;/giu, ' ')
      .replace(/\s+/gu, ' ')
      .trim();
    const isMarkerOnlyBlock = /^[\s:：;；,，.。·•—–-]*$/u.test(visibleText);
    const result: NovelReaderBlock[] = isMarkerOnlyBlock ? [] : [block];

    noteIds.forEach((id) => {
      const noteHtml = notesById[id];
      if (noteHtml === undefined) return;
      const inlineHtml = [
        `<aside class="nv-inline-footnote" data-footnote-id="${escapeHtmlAttribute(id)}">`,
        '<span class="nv-inline-footnote-label">*</span>',
        `<div class="nv-inline-footnote-content">${noteHtml}</div>`,
        '</aside>',
      ].join('');
      const noteBlock = createNovelBlock(block.locator, inlineHtml);
      result.push({
        ...noteBlock,
        id: `${block.id}:footnote:${id}`,
        locator: block.locator,
      });
    });

    return result;
  });
}

function findFootnoteTarget(
  elements: readonly HtmlElementRange[],
  id: string,
): HtmlElementRange | undefined {
  const target = elements.find((element) => readHtmlAttribute(element.openingTag, 'id') === id);
  if (target) return target;

  const namedTarget = elements.find((element) =>
    element.tag === 'a' && readHtmlAttribute(element.openingTag, 'name') === id
  );
  if (!namedTarget) return undefined;

  const containingListItem = elements
    .filter((element) =>
      element.tag === 'li'
      && element.start <= namedTarget.start
      && element.end >= namedTarget.end,
    )
    .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
  return containingListItem ?? namedTarget;
}

function findFollowingLegacyFootnoteTarget(
  elements: readonly HtmlElementRange[],
  marker: HtmlElementRange,
  markers: readonly HtmlElementRange[],
): HtmlElementRange | undefined {
  const nextMarkerStart = markers
    .filter((candidate) => candidate.start > marker.start)
    .map((candidate) => candidate.start)
    .sort((left, right) => left - right)[0] ?? Number.POSITIVE_INFINITY;
  const candidate = elements.find((element) =>
    element.tag === 'li'
    && element.start > marker.end
    && element.start < nextMarkerStart
    && /^\d+$/u.test(readHtmlAttribute(element.openingTag, 'data-line') ?? ''),
  );
  if (!candidate) return undefined;

  const containingList = elements
    .filter((element) =>
      (element.tag === 'ol' || element.tag === 'ul')
      && element.start <= candidate.start
      && element.end >= candidate.end,
    )
    .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
  if (!containingList) return candidate;

  const listItems = elements.filter((element) =>
    element.tag === 'li'
    && element.start >= containingList.start
    && element.end <= containingList.end,
  );
  return listItems.length === 1 ? containingList : candidate;
}

function footnoteFragmentId(href: string | undefined): string {
  if (!href) return '';
  const hash = href.indexOf('#');
  if (hash < 0 || hash === href.length - 1) return '';
  const fragment = href.slice(hash + 1);
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

interface HtmlElementRange {
  closingStart: number;
  end: number;
  openingEnd: number;
  openingTag: string;
  start: number;
  tag: string;
}

interface HtmlReplacement {
  end: number;
  start: number;
  value: string;
}

interface OpenHtmlElement {
  openingEnd: number;
  openingTag: string;
  start: number;
  tag: string;
}

const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

function parseHtmlElementRanges(html: string): HtmlElementRange[] {
  const elements: HtmlElementRange[] = [];
  const stack: OpenHtmlElement[] = [];
  const tagPattern = /<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b[^>]*>/giu;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    const token = match[0];
    const tag = match[1]?.toLowerCase();
    if (!tag || token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      const reverseIndex = [...stack].reverse().findIndex((element) => element.tag === tag);
      if (reverseIndex < 0) continue;
      const index = stack.length - 1 - reverseIndex;
      const opening = stack[index];
      if (!opening) continue;
      stack.splice(index, 1);
      elements.push({
        ...opening,
        closingStart: match.index,
        end: match.index + token.length,
      });
      continue;
    }

    const opening: OpenHtmlElement = {
      openingEnd: match.index + token.length,
      openingTag: token,
      start: match.index,
      tag,
    };
    if (token.endsWith('/>') || VOID_HTML_TAGS.has(tag)) {
      elements.push({
        ...opening,
        closingStart: opening.openingEnd,
        end: opening.openingEnd,
      });
    } else {
      stack.push(opening);
    }
  }
  return elements.sort((left, right) => left.start - right.start || right.end - left.end);
}

function selectOutermostFootnoteMarkers(
  elements: readonly HtmlElementRange[],
  html: string,
): HtmlElementRange[] {
  const markers = elements.filter((element) => {
    const classes = readHtmlAttribute(element.openingTag, 'class')?.split(/\s+/u) ?? [];
    if (classes.includes('duokan-footnote')) return true;
    if (element.tag !== 'a') return false;
    const href = readHtmlAttribute(element.openingTag, 'href');
    if (!href?.startsWith('#')) return false;
    const innerHtml = html.slice(element.openingEnd, element.closingStart);
    return /<img\b[^>]*\bsrc\s*=\s*(?:"[^"]*note\.png(?:[?#][^"]*)?"|'[^']*note\.png(?:[?#][^']*)?'|[^\s>]*note\.png(?:[?#\s>]))/iu.test(innerHtml);
  });
  return markers.filter((candidate, index) => !markers.some((other, otherIndex) =>
    otherIndex < index
    && other.start <= candidate.start
    && other.end >= candidate.end
  ));
}

function applyHtmlReplacements(html: string, replacements: readonly HtmlReplacement[]): string {
  return [...replacements]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (output, replacement) =>
        `${output.slice(0, replacement.start)}${replacement.value}${output.slice(replacement.end)}`,
      html,
    );
}

function decodeNumericHtmlEntity(token: string): number | null {
  if (!token.startsWith('#')) return null;
  const hexadecimal = token[1] === 'x' || token[1] === 'X';
  const value = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
  return Number.isInteger(value) && value > 0 && value <= 0x10FFFF ? value : null;
}

function isInvisibleReaderCodepoint(
  codepoint: number,
  invisibleCodepoints: ReadonlySet<number>,
): boolean {
  return ALWAYS_INVISIBLE_CODEPOINTS.has(codepoint) || invisibleCodepoints.has(codepoint);
}

function readHtmlAttribute(tag: string, name: string): string | undefined {
  const escapedName = escapeRegExp(name);
  const match = tag.match(new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'iu',
  ));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Build a page model from measured block heights. Measurement stays in RN. */
export function createReaderPagePlan(
  blocks: readonly NovelReaderBlock[],
  measuredHeights: Readonly<Record<string, number>>,
  pageHeight: number,
  blockGap = 12,
): ReaderPageSlice[] {
  const safeHeight = Math.max(1, pageHeight);
  const pages: ReaderPageSlice[] = [];
  let start = 0;
  let height = 0;

  blocks.forEach((block, index) => {
    const blockHeight = Math.max(
      1,
      measuredHeights[block.id] ?? estimateReaderBlockHeight(block),
    );
    const nextHeight = height === 0 ? blockHeight : height + blockGap + blockHeight;
    if (index > start && nextHeight > safeHeight) {
      pages.push({ start, end: index, firstBlockId: blocks[start]!.id });
      start = index;
      height = blockHeight;
    } else {
      height = nextHeight;
    }
  });

  if (start < blocks.length) {
    pages.push({ start, end: blocks.length, firstBlockId: blocks[start]!.id });
  }
  return pages;
}

export function estimateReaderBlockHeight(block: NovelReaderBlock): number {
  const lines = Math.max(1, Math.ceil(block.textLength / 42));
  return lines * 29 + (block.imageCount > 0 ? 180 : 0);
}

export function getReaderBlockLayout(
  blocks: readonly NovelReaderBlock[],
  measuredHeights: Readonly<Record<string, number>>,
  index: number,
  blockGap = 12,
): { length: number; offset: number; index: number } {
  let offset = 0;
  for (let current = 0; current < index; current += 1) {
    const block = blocks[current];
    if (block) offset += (measuredHeights[block.id] ?? estimateReaderBlockHeight(block)) + blockGap;
  }
  const block = blocks[index];
  const length = block ? measuredHeights[block.id] ?? estimateReaderBlockHeight(block) : 1;
  return { index, length, offset };
}

export function findReaderBlockIndex(
  blocks: readonly NovelReaderBlock[],
  locator: string | null | undefined,
): number {
  if (!locator) return 0;
  const exact = blocks.findIndex((block) => block.locator === locator || block.id === locator);
  if (exact >= 0) return exact;

  const indexByLocator = new Map(
    blocks.map((block, index) => [cleanReaderLocator(block.locator), index]),
  );
  let candidate = cleanReaderLocator(locator);
  while (candidate.length > 0) {
    const index = indexByLocator.get(candidate);
    if (index !== undefined) return index;
    const slash = candidate.lastIndexOf('/');
    if (slash < 0) break;
    candidate = candidate.slice(0, slash);
  }
  return 0;
}

function cleanReaderLocator(locator: string): string {
  return locator.replace(/^\/?\/?\*?\/?/u, '').replace(/^\/+|\/+$/gu, '');
}

export function createComicPageSlots(
  total: number,
  images: readonly (ComicPageImage & { index: number })[] = [],
): ComicPageSlot[] {
  const count = Math.max(0, Math.trunc(total));
  const byIndex = new Map(images.map((image) => [image.index, image]));
  return Array.from({ length: count }, (_, index) => ({
    index,
    image: byIndex.get(index) ?? null,
  }));
}

export function mergeComicPageBatch(
  slots: readonly ComicPageSlot[],
  skip: number,
  images: readonly ComicPageImage[],
): ComicPageSlot[] {
  const next = slots.map((slot) => ({ ...slot }));
  images.forEach((image, offset) => {
    const index = skip + offset;
    if (index >= 0 && index < next.length) next[index] = { index, image };
  });
  return next;
}

function createNovelBlock(
  locator: string,
  html: string,
  metadata: Pick<NovelReaderBlock, 'listDepth' | 'listMarker'> = {},
): NovelReaderBlock {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    id: `block:${locator}`,
    locator,
    html,
    textLength: Array.from(text).length,
    imageCount: (html.match(/<img\b/gi) ?? []).length,
    ...metadata,
  };
}

function readListMetadata(
  node: BlockNode,
): Pick<NovelReaderBlock, 'listDepth' | 'listMarker'> {
  if (node.tag !== 'li') return {};
  let list = node.parent;
  while (list && list.tag !== 'ol' && list.tag !== 'ul') list = list.parent;
  if (!list) return {};

  let depth = 0;
  let ancestor: BlockNode | undefined = list;
  while (ancestor) {
    if (ancestor.tag === 'ol' || ancestor.tag === 'ul') depth += 1;
    ancestor = ancestor.parent;
  }
  if (list.tag === 'ul') return { listDepth: depth, listMarker: '•' };

  const siblings = list.children.filter((child) => child.tag === 'li');
  const siblingIndex = Math.max(0, siblings.indexOf(node));
  const listStart = Number.parseInt(readHtmlAttribute(list.openingTag, 'start') ?? '1', 10);
  const itemValue = Number.parseInt(readHtmlAttribute(node.openingTag, 'value') ?? '', 10);
  const ordinal = Number.isFinite(itemValue)
    ? itemValue
    : (Number.isFinite(listStart) ? listStart : 1) + siblingIndex;
  return { listDepth: depth, listMarker: `${ordinal}.` };
}

function removeReaderMetadata(html: string): string {
  const withoutMetadata = html
    .replace(
    /<(?:base|head|link|meta|noscript|script|style|template|title)\b[^>]*>[\s\S]*?<\/(?:base|head|link|meta|noscript|script|style|template|title)>/gi,
    '',
    )
    .replace(/<(?:base|link|meta|noscript|script|style|template|title)\b[^>]*\/?>/gi, '');
  return withoutMetadata.replace(
    /<([a-z][\w:-]*)\b[^>]*(?:\bhidden\b|aria-hidden\s*=\s*["']true["']|display\s*:\s*none|visibility\s*:\s*hidden)[^>]*>[\s\S]*?<\/\1>/gi,
    '',
  );
}

interface BlockNode {
  tag: string;
  path: string;
  start: number;
  end: number;
  openingTag: string;
  parent?: BlockNode;
  children: BlockNode[];
}

const BLOCK_TAGS = new Set([
  'article', 'blockquote', 'center', 'div', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'hr', 'img', 'li', 'ol', 'p', 'pre', 'section', 'table', 'ul',
]);

function parseHtmlBlockNodes(source: string): BlockNode[] {
  const roots: BlockNode[] = [];
  const stack: BlockNode[] = [];
  const tagPattern = /<!--[^>]*-->|<\/?([a-z][\w:-]*)\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source)) !== null) {
    const token = match[0];
    const tag = match[1]?.toLowerCase();
    if (!tag || !BLOCK_TAGS.has(tag) || token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      const nodeIndex = [...stack].reverse().findIndex((node) => node.tag === tag);
      if (nodeIndex < 0) continue;
      const index = stack.length - 1 - nodeIndex;
      const node = stack[index];
      if (!node) continue;
      node.end = match.index + token.length;
      stack.splice(index, 1);
      continue;
    }
    const parent = stack.at(-1);
    const siblingCount = (parent?.children ?? roots).filter((node) => node.tag === tag).length + 1;
    const path = parent ? `${parent.path}/${tag}[${siblingCount}]` : `//*/${tag}[${siblingCount}]`;
    const node: BlockNode = {
      tag,
      path,
      start: match.index,
      end: match.index + token.length,
      openingTag: token,
      ...(parent ? { parent } : {}),
      children: [],
    };
    if (parent) parent.children.push(node);
    else roots.push(node);
    if (!token.endsWith('/>') && tag !== 'img' && tag !== 'hr') stack.push(node);
  }
  return roots.filter((node) => node.end > node.start);
}

function selectLeafBlockNodes(nodes: readonly BlockNode[], source: string): BlockNode[] {
  const output: BlockNode[] = [];
  const visit = (node: BlockNode) => {
    const blockChildren = node.children.filter((child) => BLOCK_TAGS.has(child.tag));
    if (
      isStandaloneImageContainer(node, source) ||
      blockChildren.length === 0 ||
      ['p', 'li', 'blockquote', 'center', 'figure', 'pre', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img'].includes(node.tag)
    ) {
      if (source.slice(node.start, node.end).trim()) output.push(node);
      return;
    }
    blockChildren.forEach(visit);
  };
  nodes.forEach(visit);
  return output.sort((left, right) => left.start - right.start);
}

function isStandaloneImageContainer(node: BlockNode, source: string): boolean {
  if (node.tag === 'img') return false;
  const html = source.slice(node.start, node.end);
  const imageCount = (html.match(/<img\b/gi) ?? []).length;
  if (imageCount === 0) return false;
  const text = html
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|\s/gi, '');
  if (text.length > 0) return false;
  // An image-only parent is an authored media group even when its class is
  // unknown. Keep the parent so its layout attributes and image ordering are
  // not lost by leaf-block normalization.
  return true;
}

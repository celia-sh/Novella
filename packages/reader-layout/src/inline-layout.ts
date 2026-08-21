import { DomUtils, parseDocument } from 'htmlparser2';

import type { ParsedReaderImage } from './image-layout';
import type { StyleResolver } from './style-resolver';
import type { HTMLNode, TextStyle } from './types';

export interface ReaderInlineTextRun {
  type: 'text';
  text: string;
  style: TextStyle;
}

export interface ReaderInlineBreakRun {
  type: 'break';
  kind: 'hard' | 'block';
  style: TextStyle;
}

export interface ReaderInlineRubyRun {
  type: 'ruby';
  baseText: string;
  annotationText: string;
  style: TextStyle;
}

export interface ReaderInlineImageRun {
  type: 'image';
  image: ParsedReaderImage;
  style: TextStyle;
}

export type ReaderInlineRun =
  | ReaderInlineTextRun
  | ReaderInlineBreakRun
  | ReaderInlineRubyRun
  | ReaderInlineImageRun;

export interface ParseReaderBlockContentOptions {
  decodeText?: (text: string) => string;
  parseImageTag?: (tag: string) => ParsedReaderImage | null;
}

export interface ParsedReaderBlockContent {
  attributes: Record<string, string>;
  classes: string[];
  rootStyle: TextStyle;
  runs: ReaderInlineRun[];
  tag: string;
  text: string;
}

type HtmlNode = ReturnType<typeof parseDocument>['children'][number];
type HtmlElement = NonNullable<ReturnType<typeof DomUtils.findOne>>;

const METADATA_TAGS = new Set([
  'base', 'head', 'link', 'meta', 'noscript', 'script', 'style', 'template', 'title',
]);
const NESTED_BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'figcaption', 'footer', 'header',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'p', 'pre', 'section', 'tr',
]);
const ASCII_WHITESPACE = /[\t\n\f\r ]/u;

interface AppendState {
  atLineStart: boolean;
  pendingSpace: boolean;
  runs: ReaderInlineRun[];
}

/**
 * Parse one normalized reader block into styled inline runs. The result is pure
 * data and is replayed by both temporary measurement and mounted Skia paint.
 */
export function parseReaderBlockContent(
  html: string,
  styleResolver: StyleResolver,
  options: ParseReaderBlockContentOptions = {},
): ParsedReaderBlockContent {
  const document = parseDocument(html, {
    decodeEntities: true,
    recognizeSelfClosing: true,
  });
  const renderableRoots = document.children.filter((node) => {
    if (DomUtils.isText(node)) return node.data.trim().length > 0;
    return DomUtils.isTag(node) && !METADATA_TAGS.has(node.name.toLowerCase());
  });
  const soleRoot = renderableRoots[0];
  const root = renderableRoots.length === 1 && soleRoot && DomUtils.isTag(soleRoot)
    ? soleRoot
    : null;
  const attributes = root ? { ...root.attribs } : {};
  const tag = root ? root.name.toLowerCase() : 'p';
  const classes = attributes.class?.split(/\s+/u).filter(Boolean) ?? [];
  const rootStyle = styleResolver.resolve(createHtmlNode(tag, attributes));
  const state: AppendState = { atLineStart: true, pendingSpace: false, runs: [] };

  if (root) {
    appendElement(root, rootStyle, styleResolver, state, options, true);
  } else {
    appendNodes(document.children, rootStyle, styleResolver, state, options);
  }

  const runs = trimBlockBoundaryRuns(state.runs);
  return {
    attributes,
    classes,
    rootStyle,
    runs,
    tag,
    text: runs.map((run) => {
      if (run.type === 'text') return run.text;
      if (run.type === 'ruby') return run.baseText;
      if (run.type === 'break') return '\n';
      return '';
    }).join(''),
  };
}

function appendNodes(
  nodes: readonly HtmlNode[],
  parentStyle: TextStyle,
  resolver: StyleResolver,
  state: AppendState,
  options: ParseReaderBlockContentOptions,
): void {
  for (const node of nodes) appendNode(node, parentStyle, resolver, state, options);
}

function appendNode(
  node: HtmlNode,
  parentStyle: TextStyle,
  resolver: StyleResolver,
  state: AppendState,
  options: ParseReaderBlockContentOptions,
): void {
  if (DomUtils.isText(node)) {
    appendText(node.data, parentStyle, state, options.decodeText);
    return;
  }
  if (!DomUtils.isTag(node)) return;
  appendElement(node, parentStyle, resolver, state, options, false);
}

function appendElement(
  element: HtmlElement,
  parentStyle: TextStyle,
  resolver: StyleResolver,
  state: AppendState,
  options: ParseReaderBlockContentOptions,
  styleAlreadyResolved: boolean,
): void {
  const tag = element.name.toLowerCase();
  if (METADATA_TAGS.has(tag) || isHidden(element)) return;
  const style = styleAlreadyResolved
    ? parentStyle
    : resolver.resolve(createHtmlNode(tag, element.attribs), parentStyle);

  if (tag === 'br') {
    appendBreak('hard', style, state);
    return;
  }
  if (tag === 'wbr') {
    appendText('\u200B', style, state, options.decodeText);
    return;
  }
  if (tag === 'ruby') {
    appendRuby(element, style, state, options.decodeText);
    return;
  }
  if (tag === 'rp' || tag === 'rt') return;
  if (tag === 'img') {
    const parsedImage = options.parseImageTag?.(DomUtils.getOuterHTML(element));
    if (parsedImage) {
      const image = hasBlockImageAncestor(element)
        ? { ...parsedImage, blockDisplay: true }
        : parsedImage;
      flushPendingSpace(style, state);
      state.runs.push({ type: 'image', image, style: { ...style } });
      state.atLineStart = false;
    }
    return;
  }

  const nestedBlock = NESTED_BLOCK_TAGS.has(tag);
  if (nestedBlock && hasVisibleRun(state.runs) && !state.atLineStart) {
    appendBreak('block', style, state);
  }
  appendNodes(element.children, style, resolver, state, options);
  if (nestedBlock && !state.atLineStart) appendBreak('block', style, state);

  if (tag === 'td' || tag === 'th') {
    appendText('\u2003', style, state, options.decodeText);
  }
}

function appendRuby(
  ruby: HtmlElement,
  style: TextStyle,
  state: AppendState,
  decodeText: ParseReaderBlockContentOptions['decodeText'],
): void {
  let pendingBase: HtmlNode[] = [];

  const flush = (annotationNodes: readonly HtmlNode[] = []) => {
    const baseText = normalizeRubyText(pendingBase, decodeText);
    pendingBase = [];
    const annotationText = normalizeRubyText(annotationNodes, decodeText);
    if (!baseText) return;
    flushPendingSpace(style, state);
    if (!annotationText) {
      appendText(baseText, style, state, decodeText);
      return;
    }
    state.runs.push({
      type: 'ruby',
      baseText,
      annotationText,
      style: { ...style },
    });
    state.atLineStart = false;
  };

  for (const child of ruby.children) {
    if (DomUtils.isTag(child) && child.name.toLowerCase() === 'rp') continue;
    if (DomUtils.isTag(child) && child.name.toLowerCase() === 'rt') {
      flush(child.children);
      continue;
    }
    pendingBase.push(child);
  }
  flush();
}

function appendText(
  rawText: string,
  style: TextStyle,
  state: AppendState,
  decodeText: ParseReaderBlockContentOptions['decodeText'],
): void {
  const text = (decodeText?.(rawText) ?? rawText).replace(/\r\n?/gu, '\n');
  if (style.whiteSpace === 'pre' || style.whiteSpace === 'pre-wrap') {
    flushPendingSpace(style, state);
    appendTextRun(text, style, state);
    state.atLineStart = text.endsWith('\n');
    return;
  }

  let pending = '';
  const flushPending = () => {
    if (!pending) return;
    appendTextRun(pending, style, state);
    pending = '';
  };

  for (const character of text) {
    if (ASCII_WHITESPACE.test(character)) {
      flushPending();
      if (!state.atLineStart) state.pendingSpace = true;
      continue;
    }
    flushPendingSpace(style, state);
    pending += character;
    state.atLineStart = false;
  }
  flushPending();
}

function appendBreak(
  kind: ReaderInlineBreakRun['kind'],
  style: TextStyle,
  state: AppendState,
): void {
  state.pendingSpace = false;
  state.runs.push({ type: 'break', kind, style: { ...style } });
  state.atLineStart = true;
}

function flushPendingSpace(style: TextStyle, state: AppendState): void {
  if (!state.pendingSpace || state.atLineStart) {
    state.pendingSpace = false;
    return;
  }
  appendTextRun(' ', style, state);
  state.pendingSpace = false;
}

function appendTextRun(text: string, style: TextStyle, state: AppendState): void {
  if (!text) return;
  const previous = state.runs.at(-1);
  if (
    previous?.type === 'text'
    && textStylesEqual(previous.style, style)
  ) {
    previous.text += text;
  } else {
    state.runs.push({ type: 'text', text, style: { ...style } });
  }
}

function trimBlockBoundaryRuns(runs: readonly ReaderInlineRun[]): ReaderInlineRun[] {
  const output = [...runs];
  while (true) {
    const last = output.at(-1);
    if (last?.type !== 'break' || last.kind !== 'block') break;
    output.pop();
  }
  return output;
}

function normalizeRubyText(
  nodes: readonly HtmlNode[],
  decodeText: ParseReaderBlockContentOptions['decodeText'],
): string {
  const text = nodes.map((node) => {
    if (DomUtils.isText(node)) return node.data;
    if (!DomUtils.isTag(node)) return '';
    const tag = node.name.toLowerCase();
    if (tag === 'rp') return '';
    if (tag === 'br') return '\n';
    return DomUtils.textContent(node);
  }).join('');
  return (decodeText?.(text) ?? text)
    .replace(/[\t\n\f\r ]+/gu, ' ')
    .trim();
}

function hasVisibleRun(runs: readonly ReaderInlineRun[]): boolean {
  return runs.some((run) => run.type !== 'break');
}

function createHtmlNode(tag: string, attributes: Record<string, string>): HTMLNode {
  return {
    tag,
    classes: attributes.class?.split(/\s+/u).filter(Boolean) ?? [],
    attributes: { ...attributes },
    children: [],
  };
}

function hasBlockImageAncestor(element: HtmlElement): boolean {
  let current = element.parent;
  while (current && DomUtils.isTag(current)) {
    const tag = current.name.toLowerCase();
    const classes = current.attribs.class?.split(/\s+/u) ?? [];
    if (
      tag === 'figure'
      || classes.includes('illus')
      || classes.includes('illu')
      || classes.includes('duokan-image-single')
      || classes.includes('image-preview')
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isHidden(element: HtmlElement): boolean {
  if ('hidden' in element.attribs || element.attribs['aria-hidden'] === 'true') return true;
  const style = element.attribs.style?.toLowerCase() ?? '';
  return /(?:display\s*:\s*none|visibility\s*:\s*hidden)/u.test(style);
}

function textStylesEqual(left: TextStyle, right: TextStyle): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

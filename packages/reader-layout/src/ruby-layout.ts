import { DomUtils, parseDocument } from 'htmlparser2';

export interface ReaderInlineTextRun {
  type: 'text';
  text: string;
}

export interface ReaderInlineRubyRun {
  type: 'ruby';
  baseText: string;
  annotationText: string;
}

export type ReaderInlineRun = ReaderInlineTextRun | ReaderInlineRubyRun;

export interface ParsedReaderInlineContent {
  runs: ReaderInlineRun[];
  text: string;
}

type HtmlNode = ReturnType<typeof parseDocument>['children'][number];
type HtmlElement = NonNullable<ReturnType<typeof DomUtils.findOne>>;

/** Parse valid HTML ruby pairs while dropping fallback rp parentheses. */
export function parseReaderRubyContent(html: string): ParsedReaderInlineContent | null {
  if (!/<ruby\b/iu.test(html)) return null;

  const rawRuns: ReaderInlineRun[] = [];
  const document = parseDocument(html, {
    decodeEntities: true,
    recognizeSelfClosing: true,
  });
  appendNodes(document.children, rawRuns);
  const runs = normalizeInlineRuns(rawRuns);
  if (runs.length === 0) return null;
  return {
    runs,
    text: runs.map((run) => run.type === 'text' ? run.text : run.baseText).join(''),
  };
}

function appendNodes(nodes: readonly HtmlNode[], runs: ReaderInlineRun[]): void {
  for (const node of nodes) appendNode(node, runs);
}

function appendNode(node: HtmlNode, runs: ReaderInlineRun[]): void {
  if (DomUtils.isText(node)) {
    appendTextRun(runs, node.data);
    return;
  }
  if (!DomUtils.isTag(node)) return;

  const tag = node.name.toLowerCase();
  if (tag === 'ruby') {
    appendRubyNode(node, runs);
    return;
  }
  if (tag === 'br') {
    appendTextRun(runs, '\n');
    return;
  }
  if (tag === 'rp' || tag === 'rt' || tag === 'script' || tag === 'style') return;
  appendNodes(node.children, runs);
}

function appendRubyNode(ruby: HtmlElement, runs: ReaderInlineRun[]): void {
  let pendingBase: HtmlNode[] = [];

  const flush = (annotationText = '') => {
    const baseText = normalizeInlineText(DomUtils.textContent(pendingBase));
    pendingBase = [];
    const annotation = normalizeInlineText(annotationText);
    if (!baseText) return;
    if (!annotation) {
      appendTextRun(runs, baseText);
      return;
    }
    runs.push({ type: 'ruby', baseText, annotationText: annotation });
  };

  for (const child of ruby.children) {
    if (DomUtils.isTag(child) && child.name.toLowerCase() === 'rp') continue;
    if (DomUtils.isTag(child) && child.name.toLowerCase() === 'rt') {
      flush(DomUtils.textContent(child));
      continue;
    }
    pendingBase.push(child);
  }
  flush();
}

function normalizeInlineRuns(runs: readonly ReaderInlineRun[]): ReaderInlineRun[] {
  const output: ReaderInlineRun[] = [];
  let pendingWhitespace = false;

  const appendNormalizedText = (text: string) => {
    for (const part of text.match(/\s+|[^\s]+/gu) ?? []) {
      if (/^\s+$/u.test(part)) {
        if (output.length > 0) pendingWhitespace = true;
        continue;
      }
      if (pendingWhitespace) appendTextRun(output, ' ');
      appendTextRun(output, part);
      pendingWhitespace = false;
    }
  };

  for (const run of runs) {
    if (run.type === 'text') {
      appendNormalizedText(run.text);
      continue;
    }
    if (pendingWhitespace) appendTextRun(output, ' ');
    output.push(run);
    pendingWhitespace = false;
  }
  return output;
}

function normalizeInlineText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function appendTextRun(runs: ReaderInlineRun[], text: string): void {
  if (!text) return;
  const previous = runs.at(-1);
  if (previous?.type === 'text') {
    previous.text += text;
  } else {
    runs.push({ type: 'text', text });
  }
}

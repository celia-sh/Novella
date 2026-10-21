/** Toolbar edits on Markdown source: each takes the text and selection and
 * returns the new text with the selection the cursor should move to. */

export interface MarkdownSelection {
  end: number;
  start: number;
}

export interface MarkdownEdit {
  selection: MarkdownSelection;
  value: string;
}

/** Puts `before`/`after` around the selection, or between them an empty
 * cursor when nothing is selected. */
export function wrapMarkdownSelection(
  value: string,
  { end, start }: MarkdownSelection,
  before: string,
  after: string,
): MarkdownEdit {
  const selected = value.slice(start, end);
  return {
    selection: { end: end + before.length, start: start + before.length },
    value: value.slice(0, start) + before + selected + after + value.slice(end),
  };
}

/**
 * Starts every line the selection touches with `prefix(index)`, or, when
 * they all already match `marker`, strips it from each; the selection then
 * covers the edited lines.
 */
export function toggleMarkdownLinePrefix(
  value: string,
  { end, start }: MarkdownSelection,
  marker: RegExp,
  prefix: (index: number) => string,
): MarkdownEdit {
  const blockStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', end);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  const lines = value.slice(blockStart, blockEnd).split('\n');
  const strip = lines.every((line) => marker.test(line));
  const block = lines
    .map((line, index) => (strip ? line.replace(marker, '') : prefix(index) + line))
    .join('\n');
  return {
    selection: { end: blockStart + block.length, start: blockStart },
    value: value.slice(0, blockStart) + block + value.slice(blockEnd),
  };
}

/** Replaces the selection with `block` as a paragraph of its own, blank
 * lines on both sides, and leaves the cursor after it. */
export function insertMarkdownBlock(
  value: string,
  { end, start }: MarkdownSelection,
  block: string,
): MarkdownEdit {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const cursor = before.length + lead.length + block.length + trail.length;
  return {
    selection: { end: cursor, start: cursor },
    value: before + lead + block + trail + after,
  };
}

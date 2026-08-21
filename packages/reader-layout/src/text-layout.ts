export const READER_FIRST_LINE_INDENT = '\u3000\u3000';
export const READER_LINE_BREAK_OPPORTUNITY = '\u200B';

const READER_NAMED_HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  emsp: '\u2003',
  ensp: '\u2002',
  gt: '>',
  hellip: '\u2026',
  ldquo: '\u201C',
  lsquo: '\u2018',
  lt: '<',
  mdash: '\u2014',
  nbsp: '\u00A0',
  ndash: '\u2013',
  quot: '"',
  rdquo: '\u201D',
  rsquo: '\u2019',
  thinsp: '\u2009',
};

const HTML_ENTITY_PATTERN = /&(#(?:[xX][0-9A-Fa-f]+|[0-9]+)|[A-Za-z][A-Za-z0-9]*);/gu;
const BROKEN_HTML_ENTITY_PATTERN = /&(?:\u200B*[#A-Za-z0-9xX]+)+\u200B*;/gu;

/** Decode the text entities a browser would materialize before text layout. */
export function decodeReaderLayoutTextEntities(text: string): string {
  if (!text.includes('&')) return text;
  const repaired = text.replace(
    BROKEN_HTML_ENTITY_PATTERN,
    (entity) => entity.replace(/\u200B/gu, ''),
  );
  return repaired.replace(HTML_ENTITY_PATTERN, (entity, token: string) => {
    if (!token.startsWith('#')) {
      return READER_NAMED_HTML_ENTITIES[token.toLowerCase()] ?? entity;
    }

    const hexadecimal = token[1] === 'x' || token[1] === 'X';
    const codepoint = Number.parseInt(
      token.slice(hexadecimal ? 2 : 1),
      hexadecimal ? 16 : 10,
    );
    if (
      !Number.isInteger(codepoint)
      || codepoint <= 0
      || codepoint > 0x10FFFF
      || (codepoint >= 0xD800 && codepoint <= 0xDFFF)
    ) {
      return entity;
    }
    return String.fromCodePoint(codepoint);
  });
}

/**
 * Give SkParagraph legal wrap points around glyphs encoded in Unicode private
 * use areas. Their custom-font glyphs may look like CJK, but Unicode line
 * breaking still treats the underlying codepoints like alphabetic text.
 */
export function addPuaLineBreakOpportunities(text: string): string {
  if (!containsPrivateUseCodepoint(text)) return text;

  const characters = Array.from(text);
  const output: string[] = [];
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]!;
    const previous = characters[index - 1];
    if (
      previous !== undefined
      && !isTextSeparator(previous)
      && !isTextSeparator(character)
      && shouldAddLineBreakOpportunityBetween(previous, character)
    ) {
      output.push(READER_LINE_BREAK_OPPORTUNITY);
    }
    output.push(character);
  }
  return output.join('');
}

export function shouldAddLineBreakOpportunityBetween(
  left: string | undefined,
  right: string | undefined,
  breakAll = false,
): boolean {
  if (!left || !right || isTextSeparator(left) || isTextSeparator(right)) return false;
  return breakAll
    || isPrivateUseCodepoint(left.codePointAt(0))
    || isPrivateUseCodepoint(right.codePointAt(0));
}

export function addBreakAllLineBreakOpportunities(text: string): string {
  const characters = Array.from(text);
  const output: string[] = [];
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]!;
    const previous = characters[index - 1];
    if (
      previous !== undefined
      && !isTextSeparator(previous)
      && !isTextSeparator(character)
    ) {
      output.push(READER_LINE_BREAK_OPPORTUNITY);
    }
    output.push(character);
  }
  return output.join('');
}

export function createRenderableParagraphText(
  content: string,
  firstLineIndent: boolean,
  wordBreak: 'normal' | 'break-all' = 'normal',
): string {
  const puaRenderable = addPuaLineBreakOpportunities(content);
  const renderable = wordBreak === 'break-all'
    ? addBreakAllLineBreakOpportunities(puaRenderable)
    : puaRenderable;
  if (!firstLineIndent || renderable.startsWith(READER_FIRST_LINE_INDENT)) {
    return renderable;
  }
  return `${READER_FIRST_LINE_INDENT}${renderable}`;
}

function containsPrivateUseCodepoint(text: string): boolean {
  for (const character of text) {
    if (isPrivateUseCodepoint(character.codePointAt(0))) return true;
  }
  return false;
}

function isPrivateUseCodepoint(codepoint: number | undefined): boolean {
  if (codepoint === undefined) return false;
  return (
    (codepoint >= 0xE000 && codepoint <= 0xF8FF)
    || (codepoint >= 0xF0000 && codepoint <= 0xFFFFD)
    || (codepoint >= 0x100000 && codepoint <= 0x10FFFD)
  );
}

function isTextSeparator(character: string): boolean {
  return character === READER_LINE_BREAK_OPPORTUNITY || /\s/u.test(character);
}

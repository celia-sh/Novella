import type { NovelReaderBlock } from '@novella/reader-engine';

import { chapterHrefFor } from './reader-xhtml-builder.ts';

export const READIUM_PUBLICATION_SCHEMA_VERSION = 1;
export const READIUM_BOOK_FONT_HREF = 'fonts/book.woff2';
export const READIUM_STYLESHEET_HREF = 'styles/reader.css';

const XHTML_MEDIA_TYPE = 'application/xhtml+xml';
const WOFF2_MEDIA_TYPE = 'font/woff2';

export interface ReadiumPublicationChapter {
  id: number;
  sortNum: number;
  title: string;
}

export interface ReadiumPublicationMetadata {
  bookId: number;
  identifier: string;
  language?: string;
  title: string;
}

export interface ReadiumPublicationResourceSet {
  resources: Readonly<Record<string, string>>;
  targetChapterHref: string;
}

export interface ReadiumPublicationReadiness {
  availableHrefs: ReadonlySet<string>;
  fontRequired: boolean;
  targetChapterId: number;
}

export interface ReadiumChapterDocumentOptions {
  blocks: readonly NovelReaderBlock[];
  chapterId: number;
  language?: string;
  title: string;
  useBookFont: boolean;
}

/** Stable fragment assigned to a canonical normalized chapter block. */
export function readiumBlockFragment(blockIndex: number): string {
  return `nv-block-${Math.max(0, Math.trunc(blockIndex))}`;
}

export function readiumPublicationRevision(
  bookId: number,
  conversion: string | null | undefined,
): string {
  return `${bookId}-v${READIUM_PUBLICATION_SCHEMA_VERSION}-${conversion ?? 'none'}`;
}

/**
 * Generates the metadata resources required to open a publication. Chapter
 * documents are materialized separately, so a complete spine does not imply
 * that every chapter has already been downloaded.
 */
export function buildReadiumPublicationResources(
  metadata: ReadiumPublicationMetadata,
  chapters: readonly ReadiumPublicationChapter[],
  targetChapterId: number,
  fontRequired: boolean,
): ReadiumPublicationResourceSet {
  if (chapters.length === 0) {
    throw new Error('A publication requires at least one chapter');
  }
  if (!chapters.some((chapter) => chapter.id === targetChapterId)) {
    throw new Error('The target chapter is not part of the publication spine');
  }

  const ordered = [...chapters].sort((left, right) => left.sortNum - right.sortNum);
  const manifestItems = ordered.map((chapter) => (
    `<item id="chapter-${chapter.id}" href="${chapterHrefFor(chapter.id)}" media-type="${XHTML_MEDIA_TYPE}"/>`
  ));
  manifestItems.push(`<item id="nav" href="nav.xhtml" media-type="${XHTML_MEDIA_TYPE}" properties="nav"/>`);
  manifestItems.push(`<item id="reader-style" href="${READIUM_STYLESHEET_HREF}" media-type="text/css"/>`);
  if (fontRequired) {
    manifestItems.push(`<item id="book-font" href="${READIUM_BOOK_FONT_HREF}" media-type="${WOFF2_MEDIA_TYPE}"/>`);
  }

  const spine = ordered
    .map((chapter) => `<itemref idref="chapter-${chapter.id}"/>`)
    .join('');
  const navigation = ordered
    .map((chapter) => `<li><a href="${chapterHrefFor(chapter.id)}">${escapeXml(chapter.title)}</a></li>`)
    .join('');
  const language = metadata.language?.trim() || 'zh';

  const resources: Record<string, string> = {
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
      '<rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles>',
      '</container>',
    ].join(''),
    'EPUB/package.opf': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<package version="3.0" unique-identifier="pub-id" xml:lang="${escapeXml(language)}" xmlns="http://www.idpf.org/2007/opf">`,
      '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
      `<dc:identifier id="pub-id">${escapeXml(metadata.identifier)}</dc:identifier>`,
      `<dc:title>${escapeXml(metadata.title)}</dc:title>`,
      `<dc:language>${escapeXml(language)}</dc:language>`,
      '</metadata>',
      `<manifest>${manifestItems.join('')}</manifest>`,
      `<spine>${spine}</spine>`,
      '</package>',
    ].join(''),
    'EPUB/nav.xhtml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}">`,
      '<head><meta charset="utf-8"/><title>Contents</title></head>',
      `<body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol>${navigation}</ol></nav></body>`,
      '</html>',
    ].join(''),
    [`EPUB/${READIUM_STYLESHEET_HREF}`]: buildReadiumPublicationStylesheet(fontRequired),
  };

  return {
    resources,
    targetChapterHref: chapterHrefFor(targetChapterId),
  };
}

export function buildReadiumChapterDocument({
  blocks,
  chapterId,
  language,
  title,
  useBookFont,
}: ReadiumChapterDocumentOptions): string {
  const body = blocks.map((block, index) => addBlockFragment(block.html, readiumBlockFragment(index))).join('\n');
  const fontClass = useBookFont ? ' class="nv-book-font"' : '';
  const locale = language?.trim() || 'zh';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(locale)}">`,
    '<head>',
    '<meta charset="utf-8"/>',
    `<title>${escapeXml(title)}</title>`,
    `<link rel="stylesheet" type="text/css" href="../${READIUM_STYLESHEET_HREF}"/>`,
    '</head>',
    `<body${fontClass} data-chapter-id="${chapterId}">${body}</body>`,
    '</html>',
  ].join('');
}

/** Only metadata, the target chapter and a required font gate first paint. */
export function isReadiumPublicationReady({
  availableHrefs,
  fontRequired,
  targetChapterId,
}: ReadiumPublicationReadiness): boolean {
  const required = [
    'mimetype',
    'META-INF/container.xml',
    'EPUB/package.opf',
    'EPUB/nav.xhtml',
    `EPUB/${READIUM_STYLESHEET_HREF}`,
    `EPUB/${chapterHrefFor(targetChapterId)}`,
  ];
  if (fontRequired) required.push(`EPUB/${READIUM_BOOK_FONT_HREF}`);
  return required.every((href) => availableHrefs.has(href));
}

function buildReadiumPublicationStylesheet(fontRequired: boolean): string {
  const fontFace = fontRequired
    ? `@font-face{font-family:'NovellaBookFont';font-display:block;src:url('../${READIUM_BOOK_FONT_HREF}') format('woff2');font-style:normal;font-weight:400;}`
    : '';
  return [
    fontFace,
    'html,body{margin:0;padding:0;}',
    'body{word-break:break-word;overflow-wrap:break-word;}',
    '.nv-book-font{font-family:\'NovellaBookFont\',sans-serif;}',
    'p{margin:0 0 .8em;}',
    'img{max-width:100%;height:auto;}',
    'ruby rt{font-size:.5em;}',
  ].join('');
}

function addBlockFragment(html: string, fragment: string): string {
  const openingTag = html.match(/^\s*<([a-z][\w:-]*)\b[^>]*>/iu)?.[0];
  if (!openingTag) return `<div id="${fragment}">${html}</div>`;
  const withId = /\sid\s*=/iu.test(openingTag)
    ? openingTag.replace(/\sid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/iu, ` id="${fragment}"`)
    : openingTag.replace(/>$/u, ` id="${fragment}">`);
  return html.replace(openingTag, withId);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

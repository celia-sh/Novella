import { DomUtils, parseDOM } from 'htmlparser2';
import type { NovelReaderBlock } from '@novella/reader-engine';

import { chapterHrefFor } from './reader-xhtml-builder.ts';

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
  declaredHrefs: readonly string[];
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
  footnotes?: Readonly<Record<string, string>>;
  imageBaseUrl?: string;
  language?: string;
  title: string;
  useBookFont: boolean;
}

/** Stable fragment assigned to a canonical normalized chapter block. */
export function readiumBlockFragment(blockIndex: number): string {
  return `nv-block-${Math.max(0, Math.trunc(blockIndex))}`;
}

/** Canonical href exposed by Readium after resolving the OPF manifest item. */
export function readiumChapterHref(chapterId: number): string {
  return `EPUB/${chapterHrefFor(chapterId)}`;
}

export function readiumPublicationCacheKey(
  bookId: number,
  conversion: string | null | undefined,
): string {
  return `${bookId}-${conversion ?? 'none'}`;
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

  const declaredHrefs = [
    ...Object.keys(resources),
    ...ordered.map((chapter) => `EPUB/${chapterHrefFor(chapter.id)}`),
    ...(fontRequired ? [`EPUB/${READIUM_BOOK_FONT_HREF}`] : []),
  ];

  return {
    declaredHrefs,
    resources,
    targetChapterHref: chapterHrefFor(targetChapterId),
  };
}

export function buildReadiumChapterDocument({
  blocks,
  chapterId,
  footnotes = {},
  imageBaseUrl,
  language,
  title,
  useBookFont,
}: ReadiumChapterDocumentOptions): string {
  const body = blocks.map((block, index) => {
    const withFragment = addBlockFragment(block.html, readiumBlockFragment(index));
    const withInlineNotes = inlineFootnotesAfterBlock(withFragment, footnotes);
    return prepareChapterResourceHtml(withInlineNotes, imageBaseUrl);
  }).join('\n');
  const xhtmlBody = normalizeHtmlFragmentForXhtml(body);
  const fontClass = useBookFont ? ' class="nv-book-font"' : '';
  const locale = language?.trim() || 'zh';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(locale)}">`,
    '<head>',
    '<meta charset="utf-8"/>',
    `<title>${escapeXml(title)}</title>`,
    `<link rel="stylesheet" type="text/css" href="../${READIUM_STYLESHEET_HREF}"/>`,
    buildImagePreviewScript(),
    '</head>',
    `<body${fontClass} data-chapter-id="${chapterId}">${xhtmlBody}</body>`,
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
    'body{word-break:break-word;overflow-wrap:break-word;-webkit-user-select:none;user-select:none;}',
    '.nv-book-font{font-family:\'NovellaBookFont\',sans-serif;}',
    'p{margin:0 0 .8em;}',
    'html[style*="--USER__paraIndent"] body>p{text-indent:var(--USER__paraIndent)!important;}',
    'body>:last-child{margin-bottom:0!important;}',
    'table{width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;margin:0 0 .8em;}',
    'th,td{padding:0;vertical-align:top;}',
    'td>img,th>img{display:block;width:100%;max-width:100%;height:auto;}',
    '.nv-inline-footnote{display:flex;gap:.35em;margin:0 0 .8em;font-size:.82em;line-height:1.5;opacity:.72;}',
    '.nv-inline-footnote-content{min-width:0;}',
    '.nv-inline-footnote-content>ol,.nv-inline-footnote-content>ul{margin:0;padding:0;list-style:none;}',
    '.nv-inline-footnote-content p,.nv-inline-footnote-content li{margin:0;}',
    '.nv-inline-footnote-label{flex:none;font-weight:600;}',
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

function inlineFootnotesAfterBlock(
  html: string,
  footnotes: Readonly<Record<string, string>>,
): string {
  const noteIds: string[] = [];
  const withoutMarkers = html.replace(
    /<a\b[^>]*\bdata-reader-footnote-id=(?:"([^"]+)"|'([^']+)')[^>]*>[\s\S]*?<\/a\s*>/giu,
    (_match, doubleId: string | undefined, singleId: string | undefined) => {
      const id = doubleId ?? singleId;
      if (id && footnotes[id] !== undefined && !noteIds.includes(id)) noteIds.push(id);
      return '';
    },
  );
  const visibleText = DomUtils.textContent(
    parseDOM(withoutMarkers, { decodeEntities: true }),
  ).trim();
  const blockWithoutMarker = noteIds.length > 0 && /^[\s:：;；,，.。·•—–-]*$/u.test(visibleText)
    ? ''
    : withoutMarkers;
  const inlineNotes = noteIds.map((id) => (
    `<aside class="nv-inline-footnote" data-footnote-id="${escapeXml(id)}">` +
      '<span class="nv-inline-footnote-label">*</span>' +
      `<div class="nv-inline-footnote-content">${footnotes[id] ?? ''}</div>` +
    '</aside>'
  )).join('');
  return `${blockWithoutMarker}${inlineNotes}`;
}

function buildImagePreviewScript(): string {
  return `<script type="text/javascript"><![CDATA[(function(){if(window.__novellaImagePreviewInstalled)return;window.__novellaImagePreviewInstalled=true;var timer=null,sx=0,sy=0;function img(t){var i=t&&t.closest?t.closest('img'):null;if(!i)return null;var a=i.closest('a');return a&&/(^|\\s)noteref(\\s|$)/.test(a.getAttribute('epub:type')||'')?null:i}function send(i,g){if(!i)return;var p={type:'image',uri:i.currentSrc||i.src,alt:i.alt||'',gesture:g};if(window.novellaReader&&window.novellaReader.open){window.novellaReader.open(p.uri,p.alt,p.gesture)}else if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.novellaReader){window.webkit.messageHandlers.novellaReader.postMessage(p)}}document.addEventListener('click',function(e){var i=img(e.target);if(!i)return;e.stopImmediatePropagation();send(i,'tap')},true);document.addEventListener('touchstart',function(e){var i=img(e.target);if(!i)return;var t=e.touches[0];sx=t.clientX;sy=t.clientY;timer=setTimeout(function(){timer=null;send(i,'longPress')},520)},true);document.addEventListener('touchmove',function(e){if(!timer)return;var t=e.touches[0];if(Math.abs(t.clientX-sx)>10||Math.abs(t.clientY-sy)>10){clearTimeout(timer);timer=null}},true);document.addEventListener('touchend',function(){if(timer){clearTimeout(timer);timer=null}},true)})()]]></script>`;
}

function normalizeHtmlFragmentForXhtml(html: string): string {
  return DomUtils.getOuterHTML(parseDOM(html, { decodeEntities: true }), {
    decodeEntities: true,
    xmlMode: true,
  });
}

function prepareChapterResourceHtml(html: string, imageBaseUrl?: string): string {
  let output = html.replace(
    /<a\b([^>]*\bdata-reader-footnote-id=(?:"([^"]+)"|'([^']+)')[^>]*)>/giu,
    (_match, attributes: string, doubleId: string | undefined, singleId: string | undefined) => {
      const id = doubleId ?? singleId ?? '';
      const normalizedAttributes = attributes
        .replace(/\s+href\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, '')
        .replace(/\s+epub:type\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, '');
      return `<a${normalizedAttributes} href="#${escapeXml(id)}" epub:type="noteref">`;
    },
  );
  if (imageBaseUrl) {
    output = output.replace(
      /(<img\b[^>]*\bsrc=)("|')(?![a-z][a-z0-9+.-]*:|#|\/\/)([^"']*)\2/giu,
      (_match, prefix: string, quote: string, source: string) => {
        const uri = `${imageBaseUrl}${source.startsWith('/') ? '' : '/'}${source}`;
        return `${prefix}${quote}${uri}${quote}`;
      },
    );
  }
  return output;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

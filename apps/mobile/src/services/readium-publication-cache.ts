import { Directory, File, Paths } from 'expo-file-system';
import type { BookChapter, NovelChapterContent, TextConversionMode } from '@novella/api-client';
import {
  normalizeNovelBlocks,
  processNovelFootnotes,
  type NovelFootnoteProcessingResult,
} from '@novella/reader-engine';

import { readerFontFile } from './reader-font-loader';
import {
  buildReadiumChapterDocument,
  buildReadiumPublicationResources,
  isReadiumPublicationReady,
  READIUM_BOOK_FONT_HREF,
  readiumPublicationRevision,
  type ReadiumPublicationChapter,
} from './readium-publication.ts';

const publicationCacheRoot = new Directory(Paths.cache, 'novella-readium-publications');

export interface PrepareReadiumPublicationInput {
  bookId: number;
  bookTitle: string;
  chapters: readonly BookChapter[];
  conversion?: TextConversionMode;
  targetChapter: NovelChapterContent;
}

export interface PreparedReadiumPublication {
  chapter: NovelChapterContent;
  declaredHrefs: readonly string[];
  directoryUri: string;
  footnotes: NovelFootnoteProcessingResult;
  publicationId: string;
  targetHref: string;
}

/**
 * Materializes only the minimum resource set needed for first paint. Future
 * chapters are added with materializeReadiumChapter as preload completes.
 */
export function prepareReadiumPublication({
  bookId,
  bookTitle,
  chapters,
  conversion,
  targetChapter,
}: PrepareReadiumPublicationInput): PreparedReadiumPublication {
  if (targetChapter.bookId !== bookId) {
    throw new Error('The target chapter does not belong to this publication');
  }

  const publicationChapters = toPublicationChapters(chapters);
  const revision = readiumPublicationRevision(bookId, conversion);
  const publicationDirectory = new Directory(publicationCacheRoot, revision);
  ensureDirectory(publicationDirectory);

  const fontRequired = Boolean(targetChapter.fontUrl?.trim());
  const resourceSet = buildReadiumPublicationResources(
    {
      bookId,
      identifier: `novella:${bookId}:${revision}`,
      title: bookTitle,
    },
    publicationChapters,
    targetChapter.id,
    fontRequired,
  );

  for (const [href, content] of Object.entries(resourceSet.resources)) {
    writeTextResource(publicationDirectory, href, content);
  }

  const footnotes = materializeReadiumChapter(
    publicationDirectory,
    targetChapter,
    fontRequired,
  );
  if (fontRequired) materializeReadiumFont(publicationDirectory, targetChapter.fontUrl);

  const availableHrefs = collectAvailableHrefs(publicationDirectory);
  if (!isReadiumPublicationReady({
    availableHrefs,
    fontRequired,
    targetChapterId: targetChapter.id,
  })) {
    throw new Error('The publication did not reach the minimum readable state');
  }

  return {
    chapter: targetChapter,
    declaredHrefs: resourceSet.declaredHrefs,
    directoryUri: publicationDirectory.uri,
    footnotes,
    publicationId: revision,
    targetHref: resourceSet.targetChapterHref,
  };
}

/** Adds one chapter without rebuilding or waiting for any image resource. */
export function materializeReadiumChapter(
  publicationDirectory: Directory,
  chapter: NovelChapterContent,
  useBookFont = Boolean(chapter.fontUrl?.trim()),
): NovelFootnoteProcessingResult {
  const footnotes = processNovelFootnotes(chapter.content);
  const blocks = normalizeNovelBlocks(footnotes.html, undefined, { sanitize: false });
  const document = buildReadiumChapterDocument({
    blocks,
    chapterId: chapter.id,
    title: chapter.title,
    useBookFont,
  });
  writeTextResource(
    publicationDirectory,
    `EPUB/chapters/${chapter.id}.xhtml`,
    document,
  );
  return footnotes;
}

export function materializeReadiumPreloadedChapter(
  publicationUri: string,
  chapter: NovelChapterContent,
): void {
  materializeReadiumChapter(new Directory(publicationUri), chapter);
}

export function clearReadiumPublicationCache(bookId?: number): number {
  if (!publicationCacheRoot.exists) return 0;
  const directories = publicationCacheRoot.list().filter(
    (entry): entry is Directory => entry instanceof Directory,
  );
  const selected = bookId === undefined
    ? directories
    : directories.filter((directory) => directory.name.startsWith(`${bookId}-v`));
  for (const directory of selected) directory.delete();
  return selected.length;
}

function toPublicationChapters(chapters: readonly BookChapter[]): ReadiumPublicationChapter[] {
  return chapters.map((chapter, index) => ({
    id: chapter.id,
    sortNum: index + 1,
    title: chapter.title,
  }));
}

function materializeReadiumFont(
  publicationDirectory: Directory,
  fontUrl: string | null,
): void {
  const source = readerFontFile(fontUrl);
  if (!source) throw new Error('The required book font is not available');
  const destination = new File(publicationDirectory, 'EPUB', READIUM_BOOK_FONT_HREF);
  ensureDirectory(destination.parentDirectory);
  const temporary = new File(destination.parentDirectory, `${destination.name}.tmp`);
  if (temporary.exists) temporary.delete();
  source.copySync(temporary, { overwrite: true });
  temporary.moveSync(destination, { overwrite: true });
}

function writeTextResource(root: Directory, href: string, content: string): void {
  const destination = new File(root, href);
  ensureDirectory(destination.parentDirectory);
  const temporary = new File(destination.parentDirectory, `${destination.name}.tmp`);
  if (temporary.exists) temporary.delete();
  temporary.write(content);
  temporary.moveSync(destination, { overwrite: true });
}

function ensureDirectory(directory: Directory): void {
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
}

function collectAvailableHrefs(root: Directory): Set<string> {
  const hrefs = new Set<string>();
  const visit = (directory: Directory, prefix: string) => {
    for (const entry of directory.list()) {
      const href = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry instanceof Directory) visit(entry, href);
      else hrefs.add(href);
    }
  };
  visit(root, '');
  return hrefs;
}

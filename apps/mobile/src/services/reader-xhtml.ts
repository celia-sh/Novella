export const NOVELLA_CHAPTER_FONT_FAMILY = 'NovellaChapterFont';

/** Stable spine href used by the Readium publication and locator bridge. */
export function chapterHrefFor(chapterId: number): string {
  return `chapters/${chapterId}.xhtml`;
}

/** Converts an ArrayBuffer to base64 without requiring a Node polyfill. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

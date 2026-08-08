import { arrayBufferToBase64 } from '@/services/reader-xhtml-builder';
import * as FileSystem from 'expo-file-system';

import { SERVICE_ENDPOINTS } from '@novella/api-client';

const readerFontCache = new Map<string, Promise<string>>();
const readerFontCacheDirectory = new FileSystem.Directory(
  FileSystem.Paths.cache,
  'novella-reader-fonts',
);
// Kept empty: the reader WebView renders the raw chapter like the web
// master does, so nothing is extracted.
const readerInvisibleCodepoints = new Map<string, ReadonlySet<number>>();

/**
 * Downloads and caches a Web-Master book font (WOFF2). The cached file is
 * inlined into each chapter's `@font-face` as a `data:font/woff2` URL so both
 * platforms render it exactly like the web master (which links the font URL
 * directly). The legacy Rust conversion and expo-font registration are gone —
 * the WebView consumes WOFF2 natively.
 */
export function loadReaderFont(family: string, fontUrl: string): Promise<string> {
  const cached = readerFontCache.get(fontUrl);
  if (cached) return cached;

  const pending = loadReaderFontInternal(family, fontUrl).catch((error: unknown) => {
    readerFontCache.delete(fontUrl);
    console.info('[ReaderFont] failed', {
      family,
      url: fontUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });
  readerFontCache.set(fontUrl, pending);
  return pending;
}

export function resolveReaderFontUrl(fontUrl: string | null | undefined): string | null {
  if (!fontUrl || !fontUrl.trim()) return null;
  const value = fontUrl.trim();
  return value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `${SERVICE_ENDPOINTS.apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
}

export function readerFontFamilyForUrl(url: string): string {
  return `NovellaReaderFont_${hashFontUrl(url)}`;
}

export function invisibleCodepointsForReaderFont(family: string): ReadonlySet<number> {
  return readerInvisibleCodepoints.get(family) ?? new Set<number>();
}

/**
 * Returns the cached book font as a WOFF2 base64 data URL suitable for an
 * `@font-face` src.
 *
 * The backend serves one font per book, so a chapter's `fontUrl` is stable for
 * the whole book. A missing cache entry returns null (the caller decides how to
 * handle the missing font).
 */
export function readerFontDataUrl(fontUrl: string | null | undefined): string | null {
  const file = readerFontFile(fontUrl);
  if (!file) return null;
  try {
    const bytes = file.bytesSync();
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return `data:font/woff2;base64,${arrayBufferToBase64(buffer)}`;
  } catch {
    return null;
  }
}

/** Returns the verified cached WOFF2 file for publication materialization. */
export function readerFontFile(fontUrl: string | null | undefined): FileSystem.File | null {
  const resolved = resolveReaderFontUrl(fontUrl);
  if (!resolved) return null;
  const cacheKey = hashFontUrl(resolved);
  const file = new FileSystem.File(readerFontCacheDirectory, `${cacheKey}.woff2`);
  try {
    return isWoff2File(file) ? file : null;
  } catch {
    return null;
  }
}

export function clearReaderFontCache(): number {
  readerFontCache.clear();
  readerInvisibleCodepoints.clear();
  if (!readerFontCacheDirectory.exists) return 0;

  const entryCount = readerFontCacheDirectory.list().length;
  readerFontCacheDirectory.delete();
  return entryCount;
}

async function loadReaderFontInternal(family: string, url: string): Promise<string> {
  console.info('[ReaderFont] loading', { family, url });
  const woff2File = await getCachedFontFile(url);
  console.info('[ReaderFont] cached WOFF2', { uri: woff2File.uri, bytes: woff2File.size });
  return family;
}

async function getCachedFontFile(url: string): Promise<FileSystem.File> {
  ensureCacheDirectory();

  const cacheKey = hashFontUrl(url);
  const woff2File = new FileSystem.File(readerFontCacheDirectory, `${cacheKey}.woff2`);
  if (woff2File.exists && isWoff2File(woff2File)) {
    console.info('[ReaderFont] using cached WOFF2', { uri: woff2File.uri });
    return woff2File;
  }
  if (woff2File.exists) woff2File.delete();

  // Drop any legacy TTF produced by the previous conversion pipeline.
  const legacyTtf = new FileSystem.File(readerFontCacheDirectory, `${cacheKey}.ttf`);
  if (legacyTtf.exists) legacyTtf.delete();

  console.info('[ReaderFont] downloading WOFF2', { url });
  const downloaded = await downloadFont(url, `${cacheKey}.woff2`);
  const bytes = downloaded.bytesSync();
  if (!isWoff2Bytes(bytes)) {
    downloaded.delete();
    throw new Error('Reader font is not a WOFF2 file');
  }
  console.info('[ReaderFont] downloaded WOFF2', { bytes: bytes.byteLength });
  return downloaded;
}

function ensureCacheDirectory(): void {
  if (!readerFontCacheDirectory.exists) {
    readerFontCacheDirectory.create({ intermediates: true });
  }
}

async function downloadFont(url: string, fileName: string): Promise<FileSystem.File> {
  const destination = new FileSystem.File(readerFontCacheDirectory, fileName);
  if (destination.exists && (destination.size ?? 0) > 0) return destination;
  return FileSystem.File.downloadFileAsync(url, destination, { idempotent: true });
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function isWoff2File(file: FileSystem.File): boolean {
  if (!file.exists || (file.size ?? 0) < 4) return false;
  return isWoff2Bytes(file.bytesSync());
}

function isWoff2Bytes(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4 && readUint32(bytes, 0) === 0x774f4632;
}

function hashFontUrl(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

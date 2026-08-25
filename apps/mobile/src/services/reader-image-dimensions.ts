import { SERVICE_ENDPOINTS } from '@novella/api-client';

import { createExpoStorage } from '@/adapters/expo-runtime';

export interface ReaderImageDimensions {
  height: number;
  width: number;
}

/** Stable 2:3 first-visit geometry for unknown chapter image placeholders. */
export const READER_IMAGE_FALLBACK_DIMENSIONS: ReaderImageDimensions = {
  width: 2,
  height: 3,
};

const DIMENSION_CACHE_KEY = 'novella.reader-image-dimensions.v1';
const MAX_PERSISTED_DIMENSIONS = 512;
const PERSIST_DEBOUNCE_MS = 250;
const dimensionsCache = new Map<string, ReaderImageDimensions>();
const storage = createExpoStorage();
let hydrationPromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function resolveReaderImageUrl(source: string): string {
  const value = source.trim().replace(/&amp;/giu, '&');
  if (!value) return value;
  try {
    return new URL(value, SERVICE_ENDPOINTS.apiOrigin + '/').toString();
  } catch {
    return value;
  }
}

/**
 * Load only persisted geometry metadata. This never requests image pixels and
 * therefore remains safe to await before paged measurement.
 */
export function hydrateReaderImageDimensions(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = storage.get(DIMENSION_CACHE_KEY).then((encoded) => {
    if (!encoded) return;
    try {
      const entries = JSON.parse(encoded) as unknown;
      if (!Array.isArray(entries)) return;
      entries.forEach((entry) => {
        if (!Array.isArray(entry) || entry.length !== 2) return;
        const [source, value] = entry as [unknown, unknown];
        if (typeof source !== 'string' || !isReaderImageDimensions(value)) return;
        if (!dimensionsCache.has(source)) dimensionsCache.set(source, value);
      });
      trimDimensionCache();
    } catch {
      // Corrupt optional metadata must not block chapter display.
    }
  }).catch(() => undefined);
  return hydrationPromise;
}

export function rememberReaderImageDimensions(
  source: string,
  dimensions: ReaderImageDimensions,
): void {
  if (!isReaderImageDimensions(dimensions)) return;
  const uri = resolveReaderImageUrl(source);
  const current = dimensionsCache.get(uri);
  if (current?.width === dimensions.width && current.height === dimensions.height) return;
  dimensionsCache.delete(uri);
  dimensionsCache.set(uri, dimensions);
  trimDimensionCache();
  scheduleDimensionCachePersist();
}

export function extractReaderImageSources(html: string): string[] {
  return extractReaderImageSourcesFromHtmlBlocks([html]);
}

export function extractReaderImageSourcesFromHtmlBlocks(
  htmlBlocks: readonly string[],
): string[] {
  const sources = new Set<string>();
  const imagePattern = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/giu;
  htmlBlocks.forEach((html) => {
    let match: RegExpExecArray | null;
    while ((match = imagePattern.exec(html)) !== null) {
      const source = match[1]?.trim();
      if (source) sources.add(source);
    }
  });
  return [...sources];
}

function getExplicitDimensions(html: string, source: string): ReaderImageDimensions | null {
  const imageTags = html.match(/<img\b[^>]*>/giu) ?? [];
  const tag = imageTags.find((candidate) => {
    const candidateSource = /\bsrc\s*=\s*["']([^"']+)["']/iu.exec(candidate)?.[1]?.trim();
    return candidateSource === source;
  });
  if (!tag) return null;
  const width = /\bwidth\s*=\s*["']([\d.]+)["']/iu.exec(tag)?.[1];
  const height = /\bheight\s*=\s*["']([\d.]+)["']/iu.exec(tag)?.[1];
  const parsedWidth = width ? Number.parseFloat(width) : 0;
  const parsedHeight = height ? Number.parseFloat(height) : 0;
  return parsedWidth > 0 && parsedHeight > 0
    ? { width: parsedWidth, height: parsedHeight }
    : null;
}

export function getKnownReaderImageDimensions(
  html: string,
): Record<string, ReaderImageDimensions> {
  return getKnownReaderImageDimensionsFromHtmlBlocks([html]);
}

export function getKnownReaderImageDimensionsFromHtmlBlocks(
  htmlBlocks: readonly string[],
): Record<string, ReaderImageDimensions> {
  const dimensionsBySource = new Map<string, ReaderImageDimensions>();
  htmlBlocks.forEach((html) => {
    extractReaderImageSources(html).forEach((source) => {
      if (dimensionsBySource.has(source)) return;
      const uri = resolveReaderImageUrl(source);
      const dimensions = getExplicitDimensions(html, source) ?? dimensionsCache.get(uri);
      if (!dimensions) return;
      rememberReaderImageDimensions(uri, dimensions);
      dimensionsBySource.set(source, dimensions);
    });
  });
  return Object.fromEntries(dimensionsBySource);
}

function isReaderImageDimensions(value: unknown): value is ReaderImageDimensions {
  if (typeof value !== 'object' || value === null) return false;
  const dimensions = value as Partial<ReaderImageDimensions>;
  return typeof dimensions.width === 'number' &&
    Number.isFinite(dimensions.width) &&
    dimensions.width > 0 &&
    typeof dimensions.height === 'number' &&
    Number.isFinite(dimensions.height) &&
    dimensions.height > 0;
}

function trimDimensionCache(): void {
  while (dimensionsCache.size > MAX_PERSISTED_DIMENSIONS) {
    const oldest = dimensionsCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    dimensionsCache.delete(oldest);
  }
}

function scheduleDimensionCachePersist(): void {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void hydrateReaderImageDimensions().then(() => {
      const encoded = JSON.stringify([...dimensionsCache.entries()]);
      return storage.set(DIMENSION_CACHE_KEY, encoded);
    }).catch(() => undefined);
  }, PERSIST_DEBOUNCE_MS);
}

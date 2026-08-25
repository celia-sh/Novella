import { File } from 'expo-file-system';
import { PixelRatio } from 'react-native';
import { Skia, type SkImage } from '@shopify/react-native-skia';
import {
  rasterizeReaderImage,
  readerImageRasterizerAvailable,
} from './native-reader-image-rasterizer';

type ImageReadyListener = (image: SkImage) => void;
type ImageErrorListener = (error: Error) => void;

interface ImageEntry {
  key: string;
  uri: string;
  maxPixelSize?: number;
  image: SkImage | null;
  decodedBytes: number;
  estimatedBytes: number;
  refs: number;
  listeners: Set<ImageReadyListener>;
  errorListeners: Set<ImageErrorListener>;
  loading: boolean;
  orphaned: boolean;
  lastUsed: number;
}

export const MAX_SCROLL_IMAGE_BYTES = 24 * 1024 * 1024;
export const MAX_READER_IMAGE_PIXEL_SIZE = 2048;
const MAX_CONCURRENT_IMAGE_LOADS = 1;

/**
 * Shares decoded images between mounted reader cells and the continuous
 * reader. Rasterized requests are keyed by URI plus a discrete pixel-size
 * bucket, so a reflow cannot accidentally reuse a thumbnail at the wrong
 * resolution. The pool is chapter-owned; it is never a process-wide URI cache.
 */
export class ReaderSkiaImagePool {
  private readonly entries = new Map<string, ImageEntry>();
  private readonly entriesByImage = new Map<SkImage, ImageEntry>();
  private readonly pendingLoads: ImageEntry[] = [];
  private activeLoads = 0;
  private decodedScrollImageBytes = 0;
  private usageClock = 0;
  private disposed = false;

  acquire(
    uri: string,
    onReady: ImageReadyListener,
    onError: ImageErrorListener,
    maxPixelSize?: number,
    estimatedBytes?: number,
  ): () => void {
    if (this.disposed || !uri) return () => undefined;

    const boundedPixelSize = maxPixelSize === undefined
      ? undefined
      : bucketReaderImageMaxPixelSize(maxPixelSize);
    const key = createImageEntryKey(uri, boundedPixelSize);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        key,
        uri,
        ...(boundedPixelSize === undefined ? {} : { maxPixelSize: boundedPixelSize }),
        image: null,
        decodedBytes: 0,
        estimatedBytes: Math.max(
          1,
          typeof estimatedBytes === 'number' && Number.isFinite(estimatedBytes)
            ? Math.ceil(estimatedBytes)
            : 1,
        ),
        refs: 0,
        listeners: new Set(),
        errorListeners: new Set(),
        loading: false,
        orphaned: false,
        lastUsed: ++this.usageClock,
      };
      this.entries.set(key, entry);
    }

    entry.refs += 1;
    entry.lastUsed = ++this.usageClock;
    entry.listeners.add(onReady);
    entry.errorListeners.add(onError);

    if (entry.image) {
      onReady(entry.image);
    } else if (!entry.loading) {
      entry.loading = true;
      this.pendingLoads.push(entry);
      this.drainLoads();
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      entry!.listeners.delete(onReady);
      entry!.errorListeners.delete(onError);
      this.releaseEntry(entry!);
    };
  }

  /** Retain an already acquired image for a full-screen preview. */
  retain(image: SkImage): (() => void) | undefined {
    const entry = this.entriesByImage.get(image);
    if (!entry || entry.image !== image || entry.orphaned) return undefined;
    entry.refs += 1;
    entry.lastUsed = ++this.usageClock;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.releaseEntry(entry);
    };
  }

  /** Dispose every decoded image when its owning chapter is gone. */
  dispose(): void {
    this.disposed = true;
    for (const entry of [...this.entries.values()]) {
      entry.orphaned = true;
      if (entry.refs === 0 || !entry.image) {
        this.disposeEntry(entry);
      }
    }
    this.pendingLoads.splice(0, this.pendingLoads.length);
  }

  private drainLoads(): void {
    while (this.activeLoads < MAX_CONCURRENT_IMAGE_LOADS) {
      const nextIndex = this.pendingLoads.findIndex((candidate) =>
        this.canStartLoad(candidate));
      if (nextIndex < 0) return;
      const [entry] = this.pendingLoads.splice(nextIndex, 1);
      if (!entry) return;
      if (this.disposed || entry.orphaned || entry.refs === 0) {
        entry.orphaned = true;
        entry.loading = false;
        if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
        continue;
      }
      this.activeLoads += 1;
      void this.load(entry)
        .catch(() => undefined)
        .finally(() => {
          this.activeLoads = Math.max(0, this.activeLoads - 1);
          this.drainLoads();
        });
    }
  }

  private canStartLoad(entry: ImageEntry): boolean {
    if (entry.maxPixelSize === undefined) return true;
    if (this.decodedScrollImageBytes === 0) return true;
    return this.decodedScrollImageBytes + entry.estimatedBytes <= MAX_SCROLL_IMAGE_BYTES;
  }

  private async load(entry: ImageEntry): Promise<void> {
    let data: ReturnType<typeof Skia.Data.fromBytes> | null = null;
    try {
      let encodedURI = entry.uri;
      if (entry.maxPixelSize !== undefined) {
        if (!readerImageRasterizerAvailable) {
          throw new Error('Reader image rasterization is unavailable on this platform');
        }
        encodedURI = await rasterizeReaderImage(entry.uri, entry.maxPixelSize);
      }

      data = await loadSkiaData(encodedURI);
      const image = Skia.Image.MakeImageFromEncoded(data);
      if (!image) throw new Error('Skia rejected the reader image data');

      // The image owns the native data needed for its encoded backing. Release
      // this temporary JSI Data wrapper immediately instead of waiting for GC.
      data.dispose();
      data = null;

      if (this.disposed || entry.orphaned || entry.refs === 0) {
        image.dispose();
        return;
      }

      entry.image = image;
      entry.decodedBytes = entry.maxPixelSize === undefined
        ? 0
        : estimateDecodedImageBytes(image);
      entry.loading = false;
      entry.lastUsed = ++this.usageClock;
      this.entriesByImage.set(image, entry);
      if (entry.maxPixelSize !== undefined) {
        this.decodedScrollImageBytes += entry.decodedBytes;
        this.trimScrollImagesToBudget();
      }
      for (const listener of [...entry.listeners]) listener(image);
    } catch (cause) {
      data?.dispose();
      entry.loading = false;
      if (this.disposed || entry.orphaned || entry.refs === 0) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      for (const listener of [...entry.errorListeners]) listener(error);
      this.disposeEntry(entry);
    } finally {
      entry.loading = false;
      if (entry.refs === 0 && this.entries.get(entry.key) === entry) {
        this.disposeEntry(entry);
      }
    }
  }

  private releaseEntry(entry: ImageEntry): void {
    entry.refs = Math.max(0, entry.refs - 1);
    entry.lastUsed = ++this.usageClock;
    if (entry.refs > 0) return;

    if (entry.loading) {
      // Skia.Data.fromURI() and the native thumbnail request have no shared
      // cancellation hook. Remove the entry now and dispose their result when
      // the current load resolves.
      entry.orphaned = true;
      if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
      return;
    }

    this.disposeEntry(entry);
    this.drainLoads();
  }

  private trimScrollImagesToBudget(): void {
    if (this.decodedScrollImageBytes <= MAX_SCROLL_IMAGE_BYTES) return;

    const candidates = [...this.entries.values()]
      .filter((entry) => (
        entry.maxPixelSize !== undefined &&
        entry.image !== null &&
        entry.refs === 0
      ))
      .sort((left, right) => left.lastUsed - right.lastUsed);
    for (const entry of candidates) {
      if (this.decodedScrollImageBytes <= MAX_SCROLL_IMAGE_BYTES) return;
      this.disposeEntry(entry);
    }
  }

  private disposeEntry(entry: ImageEntry): void {
    if (entry.image) {
      this.entriesByImage.delete(entry.image);
      entry.image.dispose();
      if (entry.maxPixelSize !== undefined) {
        this.decodedScrollImageBytes = Math.max(
          0,
          this.decodedScrollImageBytes - entry.decodedBytes,
        );
      }
      entry.image = null;
    }
    entry.decodedBytes = 0;
    entry.loading = false;
    entry.listeners.clear();
    entry.errorListeners.clear();
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
  }
}

export function bucketReaderImageMaxPixelSize(pixelSize: number): number {
  const bounded = Math.min(
    MAX_READER_IMAGE_PIXEL_SIZE,
    Math.max(1, Math.ceil(Number.isFinite(pixelSize) ? pixelSize : 1)),
  );
  if (bounded <= 512) return 512;
  if (bounded <= 768) return 768;
  if (bounded <= 1024) return 1024;
  if (bounded <= 1536) return 1536;
  return MAX_READER_IMAGE_PIXEL_SIZE;
}

export function resolveReaderImageMaxPixelSize(image: { width: number; height: number }): number {
  const readerImageScale = Math.min(PixelRatio.get(), 2);
  return bucketReaderImageMaxPixelSize(
    Math.max(image.width, image.height) * readerImageScale,
  );
}

export function estimateReaderImageBytes(image: { width: number; height: number }): number {
  const width = Math.max(1, Number.isFinite(image.width) ? image.width : 1);
  const height = Math.max(1, Number.isFinite(image.height) ? image.height : 1);
  const maxDimension = Math.max(width, height);
  const readerImageScale = Math.min(PixelRatio.get(), 2);
  const maxPixelSize = resolveReaderImageMaxPixelSize(image);
  const effectiveScale = Math.min(readerImageScale, maxPixelSize / maxDimension);
  return Math.ceil(width * effectiveScale) * Math.ceil(height * effectiveScale) * 4;
}

function createImageEntryKey(uri: string, maxPixelSize?: number): string {
  return maxPixelSize === undefined ? uri : `${uri}:${maxPixelSize}`;
}

async function loadSkiaData(uri: string): Promise<ReturnType<typeof Skia.Data.fromBytes>> {
  // RN Skia's iOS stream loader is not reliable for arbitrary file:// URLs.
  // The native rasterizer still owns the disk cache; read only the bounded
  // encoded thumbnail bytes before handing them to Skia.
  if (uri.startsWith('file://')) {
    return Skia.Data.fromBytes(await new File(uri).bytes());
  }
  return Skia.Data.fromURI(uri);
}

function estimateDecodedImageBytes(image: SkImage): number {
  const width = Math.max(0, image.width());
  const height = Math.max(0, image.height());
  const bytes = width * height * 4;
  return Number.isSafeInteger(bytes) ? bytes : Number.MAX_SAFE_INTEGER;
}

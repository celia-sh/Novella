import { Skia, type SkImage } from '@shopify/react-native-skia';

type ImageReadyListener = (image: SkImage) => void;
type ImageErrorListener = (error: Error) => void;

interface ImageEntry {
  uri: string;
  image: SkImage | null;
  refs: number;
  listeners: Set<ImageReadyListener>;
  errorListeners: Set<ImageErrorListener>;
  loading: boolean;
  orphaned: boolean;
}

/**
 * Shares decoded images only between currently mounted reader tiles.
 *
 * This is intentionally an instance-owned pool rather than a process-wide URL
 * cache. A scroll window can contain multiple tile slices of the same image;
 * sharing those slices avoids decoding the same native pixels repeatedly, while
 * the reader screen still controls the chapter lifetime and can release every
 * image when it unmounts or changes chapter.
 */
const MAX_CONCURRENT_IMAGE_LOADS = 2;

export class ReaderSkiaImagePool {
  private readonly entries = new Map<string, ImageEntry>();
  private readonly entriesByImage = new Map<SkImage, ImageEntry>();
  private readonly pendingLoads: ImageEntry[] = [];
  private activeLoads = 0;
  private disposed = false;

  acquire(
    uri: string,
    onReady: ImageReadyListener,
    onError: ImageErrorListener,
  ): () => void {
    if (this.disposed || !uri) return () => undefined;

    let entry = this.entries.get(uri);
    if (!entry) {
      entry = {
        uri,
        image: null,
        refs: 0,
        listeners: new Set(),
        errorListeners: new Set(),
        loading: false,
        orphaned: false,
      };
      this.entries.set(uri, entry);
    }

    entry.refs += 1;
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
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.releaseEntry(entry);
    };
  }

  /** Release all unleased images and defer leased images until their owners close. */
  dispose(): void {
    this.disposed = true;
    for (const entry of [...this.entries.values()]) {
      if (entry.refs === 0 || !entry.image) {
        entry.orphaned = true;
        this.disposeEntry(entry);
      }
    }
    this.pendingLoads.splice(0, this.pendingLoads.length);
  }

  private drainLoads(): void {
    while (this.activeLoads < MAX_CONCURRENT_IMAGE_LOADS) {
      const entry = this.pendingLoads.shift();
      if (!entry) return;
      if (this.disposed || entry.orphaned || entry.refs === 0) {
        entry.orphaned = true;
        entry.loading = false;
        if (this.entries.get(entry.uri) === entry) this.entries.delete(entry.uri);
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

  private async load(entry: ImageEntry): Promise<void> {
    let data: ReturnType<typeof Skia.Data.fromBytes> | null = null;
    try {
      data = await Skia.Data.fromURI(entry.uri);
      const image = Skia.Image.MakeImageFromEncoded(data);
      if (!image) throw new Error('Skia rejected the reader image data');

      // The image owns the native data needed for its encoded backing. Release
      // this temporary JSI Data wrapper immediately instead of waiting for GC.
      data.dispose();
      data = null;

      if (entry.orphaned || entry.refs === 0) {
        image.dispose();
        return;
      }

      entry.image = image;
      entry.loading = false;
      this.entriesByImage.set(image, entry);
      for (const listener of [...entry.listeners]) listener(image);
    } catch (cause) {
      data?.dispose();
      entry.loading = false;
      if (entry.orphaned || entry.refs === 0) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      for (const listener of [...entry.errorListeners]) listener(error);
      this.disposeEntry(entry);
    } finally {
      entry.loading = false;
      if (entry.refs === 0 && this.entries.get(entry.uri) === entry) {
        this.disposeEntry(entry);
      }
    }
  }

  private releaseEntry(entry: ImageEntry): void {
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs > 0) return;

    if (entry.loading) {
      // Skia.Data.fromURI() has no cancellation hook. Remove the entry from
      // the active pool now and dispose its result when the request resolves.
      entry.orphaned = true;
      if (this.entries.get(entry.uri) === entry) this.entries.delete(entry.uri);
      return;
    }

    this.disposeEntry(entry);
  }

  private disposeEntry(entry: ImageEntry): void {
    if (entry.image) {
      this.entriesByImage.delete(entry.image);
      entry.image.dispose();
      entry.image = null;
    }
    entry.listeners.clear();
    entry.errorListeners.clear();
    if (this.entries.get(entry.uri) === entry) this.entries.delete(entry.uri);
  }
}

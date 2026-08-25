import type { SkParagraph } from '@shopify/react-native-skia';
import { retireSkiaHostObjects } from './reader-skia-resource-lifecycle.ts';

const MAX_CACHED_BLOCKS = 256;

export interface ReaderSkiaScrollParagraphItem {
  blockId: string;
  paragraph: SkParagraph;
  xOffset: number;
  yOffset: number;
  width: number;
}

export interface ReaderSkiaScrollParagraphBundle {
  items: ReaderSkiaScrollParagraphItem[];
}

interface ParagraphEntry {
  bundle: ReaderSkiaScrollParagraphBundle;
  cancelRetirement: (() => void) | null;
}

/**
 * Keeps nearby scroll paragraphs independent from the native view lifecycle.
 * Entries are evicted by the caller's retention window and disposed after a
 * short delay so a Skia redraw already queued for the previous frame cannot
 * observe a disposed Paragraph.
 */
export class ReaderSkiaScrollParagraphCache {
  private readonly entries = new Map<string, ParagraphEntry>();
  private disposed = false;

  getOrCreate(
    blockId: string,
    create: () => ReaderSkiaScrollParagraphBundle,
  ): ReaderSkiaScrollParagraphBundle {
    const existing = this.entries.get(blockId);
    if (existing) {
      this.cancelDisposal(existing);
      this.entries.delete(blockId);
      this.entries.set(blockId, existing);
      return existing.bundle;
    }

    const bundle = create();
    if (this.disposed) return bundle;
    this.entries.set(blockId, { bundle, cancelRetirement: null });
    this.trimToBound();
    return bundle;
  }

  prune(retainedBlockIds: ReadonlySet<string>): void {
    for (const [blockId, entry] of this.entries) {
      if (!retainedBlockIds.has(blockId)) this.scheduleDisposal(blockId, entry);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [blockId, entry] of this.entries) {
      this.scheduleDisposal(blockId, entry);
    }
  }

  private trimToBound(): void {
    if (this.entries.size <= MAX_CACHED_BLOCKS) return;
    const oldest = this.entries.entries().next().value as [string, ParagraphEntry] | undefined;
    if (oldest) this.scheduleDisposal(oldest[0], oldest[1]);
  }

  private scheduleDisposal(blockId: string, entry: ParagraphEntry): void {
    if (entry.cancelRetirement !== null) return;
    entry.cancelRetirement = retireSkiaHostObjects(
      entry.bundle.items.map((item) => item.paragraph),
      () => {
        entry.cancelRetirement = null;
        if (this.entries.get(blockId) === entry) this.entries.delete(blockId);
      },
    );
  }

  private cancelDisposal(entry: ParagraphEntry): void {
    if (entry.cancelRetirement === null) return;
    entry.cancelRetirement();
    entry.cancelRetirement = null;
  }
}

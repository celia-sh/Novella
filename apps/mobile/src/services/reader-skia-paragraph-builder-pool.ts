import {
  Skia,
  type SkParagraphBuilder,
  type SkParagraphStyle,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

const MAX_RETAINED_BUILDERS = 16;

/**
 * Reuses render-side ParagraphBuilders for one laid-out chapter generation.
 *
 * Builders are only borrowed during synchronous paragraph construction. The
 * resulting Paragraph remains owned by its mounted tile, so this pool never
 * shares a Paragraph or any other object retained by a Skia Canvas.
 *
 * Skia's native ParagraphBuilder currently exposes reset(), but not a usable
 * dispose() implementation. Dropping this bounded pool at chapter/reflow
 * teardown lets the JSI wrapper and native builder be collected together.
 */
export class ReaderSkiaParagraphBuilderPool {
  private readonly builders = new Map<string, SkParagraphBuilder>();
  private readonly activeBuilders = new Set<SkParagraphBuilder>();
  private disposed = false;

  constructor(private readonly fontMgr?: SkTypefaceFontProvider | null) {}

  withBuilder<T>(
    style: SkParagraphStyle,
    operation: (builder: SkParagraphBuilder) => T,
  ): T {
    const styleKey = JSON.stringify(style);
    const pooledBuilder = this.builders.get(styleKey);
    let builder = pooledBuilder && !this.activeBuilders.has(pooledBuilder)
      ? pooledBuilder
      : this.createBuilder(style);
    const canRetain = pooledBuilder === undefined && !this.disposed;

    if (pooledBuilder) {
      this.builders.delete(styleKey);
      this.builders.set(styleKey, pooledBuilder);
    } else if (canRetain) {
      this.retainBuilder(styleKey, builder);
    }

    this.activeBuilders.add(builder);
    builder.reset();
    try {
      return operation(builder);
    } finally {
      builder.reset();
      this.activeBuilders.delete(builder);
      // A builder that could not fit in the bounded pool is intentionally
      // dropped here. The native wrapper will be reclaimed by its normal JSI
      // lifecycle; no builder is ever passed to a Canvas.
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const builder of this.builders.values()) builder.reset();
    this.builders.clear();
  }

  private createBuilder(style: SkParagraphStyle): SkParagraphBuilder {
    return this.fontMgr
      ? Skia.ParagraphBuilder.Make(style, this.fontMgr)
      : Skia.ParagraphBuilder.Make(style);
  }

  private retainBuilder(styleKey: string, builder: SkParagraphBuilder): void {
    if (this.builders.size >= MAX_RETAINED_BUILDERS) {
      const evictable = [...this.builders.entries()].find(
        ([, candidate]) => !this.activeBuilders.has(candidate),
      );
      if (!evictable) return;
      evictable[1].reset();
      this.builders.delete(evictable[0]);
    }
    this.builders.set(styleKey, builder);
  }
}

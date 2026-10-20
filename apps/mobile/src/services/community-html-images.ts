export interface CommunityHtmlImage {
  /** Size from the tag's `width`/`height` attributes, when both are usable. */
  height?: number;
  /** The `src` exactly as written in the HTML. */
  source: string;
  width?: number;
}

const IMG_TAG = /<img\b[^>]*>/giu;

/**
 * The images of a post or announcement, in document order. Their positions
 * are the pages of the post's image gallery, so the order must match the order
 * the HTML renderer meets the same tags in.
 */
export function extractCommunityHtmlImages(html: string): CommunityHtmlImage[] {
  const images: CommunityHtmlImage[] = [];
  for (const [tag] of html.matchAll(IMG_TAG)) {
    const source = readAttribute(tag, 'src')?.trim() ?? '';
    if (!source) continue;
    const width = Number.parseFloat(readAttribute(tag, 'width') ?? '');
    const height = Number.parseFloat(readAttribute(tag, 'height') ?? '');
    images.push(width > 0 && height > 0 ? { height, source, width } : { source });
  }
  return images;
}

/** Gallery page of the first image whose `src` is `source`, or -1. */
export function communityHtmlImageIndex(
  images: readonly CommunityHtmlImage[],
  source: string,
): number {
  const wanted = source.trim();
  return images.findIndex((image) => image.source === wanted);
}

function readAttribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu').exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

import type {
  ImageLayout,
  ReaderImageDimensions,
} from './types';

const FALLBACK_IMAGE_DIMENSIONS: ReaderImageDimensions = { width: 2, height: 3 };

export interface ParsedReaderImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fullWidth: boolean;
  previewable: boolean;
}

export interface ResolvedReaderImageFrame {
  image: ImageLayout;
  x: number;
}

export function extractReaderImages(html: string): ParsedReaderImage[] {
  return (html.match(/<img\b[^>]*>/giu) ?? []).flatMap((tag) => {
    const attributes = readHtmlAttributes(tag);
    const src = attributes.src?.trim();
    if (!src || isFootnoteMarkerImage(attributes, src)) return [];
    const style = attributes.style?.toLowerCase().replaceAll(' ', '') ?? '';
    const classes = attributes.class?.split(/\s+/u) ?? [];
    const width = parsePositiveDimension(attributes.width);
    const height = parsePositiveDimension(attributes.height);
    return [{
      src,
      alt: decodeHtmlAttribute(attributes.alt ?? ''),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      fullWidth: style.includes('width:100%'),
      previewable: !classes.includes('no-preview'),
    }];
  });
}

export function resolveReaderImageFrame(
  image: ParsedReaderImage,
  availableWidth: number,
  imageDimensions: Readonly<Record<string, ReaderImageDimensions>>,
): ResolvedReaderImageFrame {
  const decodedSource = decodeHtmlAttribute(image.src);
  const knownDimensions = explicitImageDimensions(image)
    ?? parseSystemImageDimensions(decodedSource)
    ?? imageDimensions[image.src]
    ?? imageDimensions[decodedSource];
  const known = knownDimensions ?? FALLBACK_IMAGE_DIMENSIONS;
  const aspectRatio = known.width / known.height;
  const authoredWidth = image.width ?? knownDimensions?.width ?? availableWidth;
  const width = image.fullWidth
    ? availableWidth
    : Math.min(availableWidth, Math.max(1, authoredWidth));
  const height = width / aspectRatio;

  return {
    x: Math.max(0, (availableWidth - width) / 2),
    image: {
      url: decodedSource,
      alt: image.alt,
      previewable: image.previewable,
      width,
      height,
      aspectRatio,
    },
  };
}

export function parseSystemImageDimensions(source: string): ReaderImageDimensions | null {
  if (!source) return null;
  try {
    const url = new URL(decodeHtmlAttribute(source), 'https://reader.invalid/');
    if (!url.searchParams.get('placeholder')) return null;
    const match = /^([1-9]\d*)x([1-9]\d*)$/u.exec(url.searchParams.get('size') ?? '');
    if (!match) return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    return Number.isSafeInteger(width) && Number.isSafeInteger(height)
      ? { width, height }
      : null;
  } catch {
    return null;
  }
}

function explicitImageDimensions(image: ParsedReaderImage): ReaderImageDimensions | null {
  return image.width && image.height ? { width: image.width, height: image.height } : null;
}

function parsePositiveDimension(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(/\d+(?:\.\d+)?/u.exec(value)?.[0] ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isFootnoteMarkerImage(attributes: Record<string, string>, src: string): boolean {
  const classes = attributes.class?.split(/\s+/u) ?? [];
  return classes.includes('footnote') || /(?:^|\/)note\.png(?:[?#]|$)/iu.test(src);
}

function readHtmlAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag)) !== null) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'");
}

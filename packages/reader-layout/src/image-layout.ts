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
  widthFraction?: number;
  alignment?: 'left' | 'center' | 'right';
  float?: 'left' | 'right';
  blockDisplay?: boolean;
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
    const cssWidth = parseCssDimension(style, 'width');
    const cssHeight = parseCssDimension(style, 'height');
    const width = parsePositiveDimension(attributes.width) ?? cssWidth.value;
    const height = parsePositiveDimension(attributes.height) ?? cssHeight.value;
    const authoredAlign = attributes.align?.toLowerCase();
    const cssFloat = /(?:^|;)float:(left|right)(?:;|$)/u.exec(style)?.[1];
    const float = classes.includes('fl') || authoredAlign === 'left' || cssFloat === 'left'
      ? 'left'
      : classes.includes('fr') || authoredAlign === 'right' || cssFloat === 'right'
        ? 'right'
        : undefined;
    const alignment = authoredAlign === 'left'
      || authoredAlign === 'center'
      || authoredAlign === 'right'
      ? authoredAlign
      : undefined;
    return [{
      src,
      alt: decodeHtmlAttribute(attributes.alt ?? ''),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(cssWidth.fraction ? { widthFraction: cssWidth.fraction } : {}),
      ...(alignment ? { alignment } : {}),
      ...(float ? { float } : {}),
      fullWidth: cssWidth.fraction === 1,
      previewable: !classes.includes('no-preview'),
    }];
  });
}

export function resolveReaderImageFrame(
  image: ParsedReaderImage,
  availableWidth: number,
  imageDimensions: Readonly<Record<string, ReaderImageDimensions>>,
  maximumHeight?: number,
): ResolvedReaderImageFrame {
  const decodedSource = decodeHtmlAttribute(image.src);
  const knownDimensions = explicitImageDimensions(image)
    ?? fractionalImageDimensions(image, availableWidth)
    ?? parseSystemImageDimensions(decodedSource)
    ?? imageDimensions[image.src]
    ?? imageDimensions[decodedSource];
  const known = knownDimensions ?? FALLBACK_IMAGE_DIMENSIONS;
  const aspectRatio = known.width / known.height;
  const authoredWidth = image.width
    ?? (image.widthFraction ? availableWidth * image.widthFraction : undefined)
    ?? knownDimensions?.width
    ?? availableWidth;
  const requestedWidth = image.fullWidth
    ? availableWidth
    : Math.min(availableWidth, Math.max(1, authoredWidth));
  const requestedHeight = requestedWidth / aspectRatio;
  const size = fitImageHeight(requestedWidth, requestedHeight, maximumHeight);

  return {
    x: Math.max(0, (availableWidth - size.width) / 2),
    image: {
      url: decodedSource,
      alt: image.alt,
      previewable: image.previewable,
      width: size.width,
      height: size.height,
      aspectRatio,
    },
  };
}

export function resolveReaderInlineImageFrame(
  image: ParsedReaderImage,
  availableWidth: number,
  imageDimensions: Readonly<Record<string, ReaderImageDimensions>>,
  maximumHeight?: number,
): ResolvedReaderImageFrame {
  const decodedSource = decodeHtmlAttribute(image.src);
  const knownDimensions = explicitImageDimensions(image)
    ?? fractionalImageDimensions(image, availableWidth)
    ?? parseSystemImageDimensions(decodedSource)
    ?? imageDimensions[image.src]
    ?? imageDimensions[decodedSource];
  const aspectRatio = knownDimensions
    ? knownDimensions.width / knownDimensions.height
    : image.width && image.height
      ? image.width / image.height
      : 1;
  const requestedWidth = image.fullWidth
    ? availableWidth
    : image.width
      ?? (image.widthFraction ? availableWidth * image.widthFraction : undefined)
      ?? knownDimensions?.width
      ?? 40;
  const width = Math.min(availableWidth, Math.max(1, requestedWidth));
  const height = image.height && !image.width
    ? image.height
    : width / Math.max(0.001, aspectRatio);
  const size = fitImageHeight(width, Math.max(1, height), maximumHeight);
  return {
    x: 0,
    image: {
      url: decodedSource,
      alt: image.alt,
      previewable: image.previewable,
      width: size.width,
      height: size.height,
      aspectRatio,
    },
  };
}

function fitImageHeight(
  width: number,
  height: number,
  maximumHeight: number | undefined,
): { height: number; width: number } {
  if (typeof maximumHeight !== 'number' || !Number.isFinite(maximumHeight) || maximumHeight <= 0) {
    return { height, width };
  }
  if (height <= maximumHeight) return { height, width };
  const scale = maximumHeight / height;
  return {
    height: maximumHeight,
    width: width * scale,
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

function fractionalImageDimensions(
  image: ParsedReaderImage,
  availableWidth: number,
): ReaderImageDimensions | null {
  return image.widthFraction && image.height
    ? { width: availableWidth * image.widthFraction, height: image.height }
    : null;
}

function parseCssDimension(
  style: string,
  property: 'width' | 'height',
): { value: number | null; fraction: number | null } {
  const match = new RegExp(`(?:^|;)${property}:([^;]+)`, 'u').exec(style);
  const raw = match?.[1]?.trim() ?? '';
  if (raw.endsWith('%')) {
    const percentage = Number.parseFloat(raw);
    return Number.isFinite(percentage) && percentage > 0
      ? { value: null, fraction: percentage / 100 }
      : { value: null, fraction: null };
  }
  return { value: parsePositiveDimension(raw), fraction: null };
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

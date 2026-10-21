/** Longest side, in pixels, of an image uploaded into a community post. */
export const COMMUNITY_IMAGE_MAX_DIMENSION = 2048;
/** Uploads above this size are refused before they reach the Hub, whose
 * MessagePack messages carry the whole file. */
export const COMMUNITY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export interface ImageSize {
  height: number;
  width: number;
}

/** `size` scaled down (never up) so neither side exceeds `maxDimension`. */
export function fitImageWithin(size: ImageSize, maxDimension: number): ImageSize {
  const longest = Math.max(size.width, size.height);
  if (!(longest > maxDimension)) return roundSize(size);
  const scale = maxDimension / longest;
  return roundSize({ height: size.height * scale, width: size.width * scale });
}

/** File name sent with an upload: the original stem (path and extension
 * stripped) with `extension`, or a generated name when there is none. */
export function communityImageFileName(
  originalName: string | null | undefined,
  extension: string,
  now = Date.now(),
): string {
  const base = (originalName ?? '').split(/[\\/]/).pop() ?? '';
  const stem = base.replace(/\.[^.]*$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '');
  return `${stem || `image-${now}`}.${extension}`;
}

function roundSize(size: ImageSize): ImageSize {
  return {
    height: Math.max(1, Math.round(size.height)),
    width: Math.max(1, Math.round(size.width)),
  };
}

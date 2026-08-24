/** Image CDN sizing contract shared by cover display and prefetch paths. */

export const IMAGE_HEIGHT_STEP = 256;
export const MAX_IMAGE_HEIGHT_REQUEST = 4096;

/**
 * Quantize a logical display height to the CDN's supported physical-pixel
 * buckets. Keeping the bucket count small also keeps native image caches from
 * fragmenting across nearly-identical layouts.
 */
export function imageHeightBucketFor(
  logicalHeight: number,
  devicePixelRatio: number,
): number {
  const physicalHeight = logicalHeight * devicePixelRatio;
  if (!Number.isFinite(physicalHeight) || physicalHeight <= 0) {
    return IMAGE_HEIGHT_STEP;
  }

  const bucket = Math.round(physicalHeight / IMAGE_HEIGHT_STEP) * IMAGE_HEIGHT_STEP;
  return Math.min(
    MAX_IMAGE_HEIGHT_REQUEST,
    Math.max(IMAGE_HEIGHT_STEP, bucket),
  );
}

/**
 * Add or replace the CDN's `height` query parameter without parsing the full
 * URL. Cover placeholders can contain legacy raw query characters, so using
 * URLSearchParams here could change the bytes sent to the image server.
 */
export function withImageHeight(url: string, height: number): string {
  if (!url || !Number.isFinite(height) || height <= 0) return url;

  const queryStart = url.indexOf('?');
  const fragmentStart = url.indexOf('#');

  if (queryStart < 0) {
    if (fragmentStart < 0) return `${url}?height=${height}`;
    return `${url.slice(0, fragmentStart)}?height=${height}${url.slice(fragmentStart)}`;
  }

  const queryEnd = fragmentStart > queryStart ? fragmentStart : url.length;
  if (queryStart === queryEnd - 1) {
    return `${url.slice(0, queryEnd)}height=${height}${url.slice(queryEnd)}`;
  }

  let pairStart = queryStart + 1;
  while (pairStart < queryEnd) {
    const nextAmpersand = url.indexOf('&', pairStart);
    const pairEnd = nextAmpersand < 0 || nextAmpersand > queryEnd
      ? queryEnd
      : nextAmpersand;
    const separator = url.indexOf('=', pairStart);
    if (
      separator >= pairStart &&
      separator < pairEnd &&
      url.slice(pairStart, separator) === 'height'
    ) {
      return `${url.slice(0, separator + 1)}${height}${url.slice(pairEnd)}`;
    }
    if (pairEnd >= queryEnd) break;
    pairStart = pairEnd + 1;
  }

  return `${url.slice(0, queryEnd)}&height=${height}${url.slice(queryEnd)}`;
}

/** Build the one URL variant used by both native display and any prefetch. */
export function sizedImageUrl(
  url: string,
  {
    logicalHeight,
    devicePixelRatio,
  }: {
    logicalHeight: number;
    devicePixelRatio: number;
  },
): string {
  return withImageHeight(
    url,
    imageHeightBucketFor(logicalHeight, devicePixelRatio),
  );
}

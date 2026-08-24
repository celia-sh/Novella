/**
 * Derive the native decoded-image cache key from a cover request URL.
 *
 * `placeholder` is presentation metadata and does not change image bytes, so
 * it is safe to omit. Signed `t` and CDN sizing parameters stay in the key:
 * changing either request must not make two potentially different responses
 * share a decoded-image entry.
 */
export function coverImageCacheKey(source: string): string {
  const queryStart = source.indexOf('?');
  if (queryStart < 0) return source.split('#', 1)[0] ?? source;

  const fragmentStart = source.indexOf('#', queryStart + 1);
  const queryEnd = fragmentStart < 0 ? source.length : fragmentStart;
  const query = source.slice(queryStart + 1, queryEnd);
  const retained = query.split('&').filter((pair) => {
    const separator = pair.indexOf('=');
    const key = separator < 0 ? pair : pair.slice(0, separator);
    return key !== 'placeholder';
  });
  const base = source.slice(0, queryStart);
  return retained.length > 0 ? `${base}?${retained.join('&')}` : base;
}

/**
 * Recycling must be stricter than the decoded cache key. It distinguishes
 * signed requests and placeholder changes so a recycled native view cannot
 * briefly paint the previous request while the shared decoded cache resolves.
 */
export function coverImageRecyclingKey(source: string): string {
  return source;
}

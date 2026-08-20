/**
 * Utility functions for layout calculations.
 */

/**
 * Check if a point is inside a rectangle.
 */
export function isPointInRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Parse HTML color to hex string.
 */
export function parseColor(color: string): string {
  // Basic color parsing - expand as needed
  if (color.startsWith('#')) {
    return color;
  }

  // Named colors
  const namedColors: Record<string, string> = {
    red: '#ff0000',
    green: '#00ff00',
    blue: '#0000ff',
    black: '#000000',
    white: '#ffffff',
    transparent: '#00000000',
  };

  return namedColors[color.toLowerCase()] || color;
}

/**
 * Generate a cache key for layout results.
 */
export function generateLayoutCacheKey(
  blockIds: string[],
  width: number,
  fontSize: number,
  lineHeight: number,
  fontFamily: string
): string {
  return JSON.stringify({
    blockIds,
    width: Math.round(width),
    fontSize: Math.round(fontSize),
    lineHeight: Math.round(lineHeight),
    fontFamily,
  });
}

/**
 * Clean and normalize HTML text content.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .trim();
}

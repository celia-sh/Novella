/**
 * The edge treatment the side-chrome readers draw next to the vertical bar.
 *
 * The bar sits on a surface that ends at its edge: the novel's web view is
 * inset there, and the comic runs underneath it. A linear ramp reads as a
 * visible band, and a half-faded glyph at the clipped edge is still legible.
 * A smoothstep curve levels off at both ends, so the strip has no visible
 * start line and reaches the background before the bar.
 */
const STEP_COUNT = 10;

export const SIDE_FADE_WIDTH = 64;

export const SIDE_FADE_LOCATIONS = Array.from(
  { length: STEP_COUNT + 1 },
  (_, index) => index / STEP_COUNT,
) as [number, number, ...number[]];

const SIDE_FADE_ALPHA_STOPS = SIDE_FADE_LOCATIONS.map(
  (t) => t * t * (3 - 2 * t),
);

/**
 * `#RRGGBB` (or `#RRGGBBAA`) to the same colour with the smoothstep alpha
 * ramp. The first stop is fully transparent and the last one is the solid
 * background.
 */
export function sideFadeColors(
  background: string,
): [string, string, ...string[]] {
  const base = background.slice(0, 7);
  const colors = SIDE_FADE_ALPHA_STOPS.map((alpha) => {
    const byte = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
    return `${base}${byte}`;
  });
  return colors as [string, string, ...string[]];
}

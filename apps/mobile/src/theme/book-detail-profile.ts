export type BookColorProfile = 'dark' | 'light' | 'oledBlack';

/** iOS keeps the existing OLED book-detail palette without persisting it. */
export function resolveBookColorProfile(colorScheme: 'light' | 'dark'): BookColorProfile {
  return colorScheme === 'dark' ? 'oledBlack' : 'light';
}

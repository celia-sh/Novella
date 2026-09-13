export type BookColorProfile = 'dark' | 'light';

export function resolveBookColorProfile(colorScheme: 'light' | 'dark'): BookColorProfile {
  return colorScheme;
}

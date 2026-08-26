export const DEFAULT_THEME_SEED = '#B71C1C';

export const MATERIAL_SCHEME_VARIANTS = [
  'tonalSpot',
  'fidelity',
  'content',
  'monochrome',
  'neutral',
  'vibrant',
  'expressive',
  'rainbow',
  'fruitSalad',
] as const;

export type MaterialSchemeVariant = (typeof MATERIAL_SCHEME_VARIANTS)[number];

export function isMaterialSchemeVariant(value: unknown): value is MaterialSchemeVariant {
  return typeof value === 'string'
    && (MATERIAL_SCHEME_VARIANTS as readonly string[]).includes(value);
}

export function isThemeSeed(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

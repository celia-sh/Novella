import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveStringColor } from './color-values.ts';
import { createHeroUIThemeVariables } from './hero-ui-theme.ts';

const palette = {
  accent: '#F4D03F',
  background: '#101112',
  card: '#202122',
  error: '#BA1A1A',
  label: '#F5F5F5',
  onPrimaryContainer: '#220011',
  primaryContainer: '#FFD9DF',
  secondaryLabel: '#B8B8B8',
  separator: '#454545',
  surface: '#18191A',
  surfaceContainerHighest: '#303132',
};

test('resolves parser-facing colors without leaking platform color objects', () => {
  assert.equal(resolveStringColor('#FF3B30', '#BA1A1A'), '#FF3B30');
  assert.equal(resolveStringColor('  ', '#BA1A1A'), '#BA1A1A');
  assert.equal(
    resolveStringColor({ semantic: ['systemRed'] }, '#BA1A1A'),
    '#BA1A1A',
  );
});

test('maps the app palette to HeroUI semantic roots and native aliases', () => {
  const variables = createHeroUIThemeVariables(palette, 'dark');

  assert.equal(variables['--background'], palette.background);
  assert.equal(variables['--surface'], palette.surface);
  assert.equal(variables['--surface-secondary'], palette.card);
  assert.equal(variables['--surface-tertiary'], palette.surfaceContainerHighest);
  assert.equal(variables['--foreground'], palette.label);
  assert.equal(variables['--muted'], palette.secondaryLabel);
  assert.equal(variables['--border'], palette.separator);
  assert.equal(variables['--field-background'], palette.card);
  assert.equal(variables['--segment'], palette.primaryContainer);
  assert.equal(variables['--segment-foreground'], palette.onPrimaryContainer);
  assert.equal(variables['--color-background'], palette.background);
  assert.equal(variables['--color-field'], palette.card);
});

test('chooses readable status foregrounds', () => {
  const variables = createHeroUIThemeVariables(palette, 'light');

  assert.equal(variables['--accent-foreground'], '#000000');
  assert.equal(variables['--danger-foreground'], '#FFFFFF');
});

test('uses scheme-specific fallbacks for opaque platform colors', () => {
  const platformColor = { semantic: true };
  const variables = createHeroUIThemeVariables({
    ...palette,
    accent: platformColor,
    background: platformColor,
    label: platformColor,
  }, 'dark');

  assert.equal(variables['--accent'], '#FF8A9A');
  assert.equal(variables['--background'], '#111318');
  assert.equal(variables['--foreground'], '#E2E2E9');
});

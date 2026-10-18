import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveStringColor } from './color-values.ts';
import { createPanelUIThemeVariables } from './panel-ui-theme.ts';

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

test('chooses readable button and destructive foregrounds', () => {
  const variables = createPanelUIThemeVariables(palette, 'light');

  assert.equal(variables['--color-primary-foreground'], '#000000');
  assert.equal(variables['--color-destructive-solid-foreground'], '#FFFFFF');
});

test('uses scheme-specific fallbacks for opaque platform colors', () => {
  const platformColor = { semantic: true };
  const variables = createPanelUIThemeVariables({
    ...palette,
    accent: platformColor,
    background: platformColor,
    label: platformColor,
  }, 'dark');

  assert.equal(variables['--color-primary'], '#FF8A9A');
  assert.equal(variables['--color-background'], '#111318');
  assert.equal(variables['--color-foreground'], '#E2E2E9');
});

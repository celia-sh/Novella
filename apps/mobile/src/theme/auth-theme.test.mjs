import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthPalette } from './auth-palette.ts';

const base = {
  accent: '#6750A4',
  background: '#FFFBFE',
  card: '#F7F2FA',
  error: '#B3261E',
  label: '#1D1B20',
  onPrimaryContainer: '#21005D',
  primaryContainer: '#EADDFF',
  secondaryLabel: '#49454F',
  separator: '#CAC4D0',
  surface: '#FFFBFE',
  surfaceContainerHighest: '#E6E0E9',
};

test('maps Material colors into the auth palette', () => {
  const palette = createAuthPalette(base, 'light');

  assert.equal(palette.accent, base.accent);
  assert.equal(palette.background, base.background);
  assert.equal(palette.surface, base.card);
  assert.equal(palette.skeleton, base.surfaceContainerHighest);
  assert.equal(palette.welcomeGradient.at(-1), base.background);
});

test('never resolves an iOS semantic background through the accent fallback', () => {
  const platformAccent = { semantic: 'systemPink' };
  const platformBackground = { semantic: 'systemGroupedBackground' };
  const light = createAuthPalette({
    ...base,
    accent: platformAccent,
    background: platformBackground,
  }, 'light');
  const dark = createAuthPalette({
    ...base,
    accent: platformAccent,
    background: platformBackground,
  }, 'dark');

  assert.equal(light.accent, platformAccent);
  assert.equal(light.welcomeGradient.at(-1), '#FFFFFF');
  assert.equal(dark.welcomeGradient.at(-1), '#000000');
  assert.notEqual(light.welcomeGradient.at(-1), '#FF375F');
});

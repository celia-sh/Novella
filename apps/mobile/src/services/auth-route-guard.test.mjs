import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldShowAuthenticatedRoutes } from './auth-route-guard.ts';

test('route guard keeps the app only for authenticated or transient recovery states', () => {
  assert.equal(shouldShowAuthenticatedRoutes('authenticated', false), true);
  assert.equal(shouldShowAuthenticatedRoutes('unknown', true), true);
  assert.equal(shouldShowAuthenticatedRoutes('refreshing', true), true);
  assert.equal(shouldShowAuthenticatedRoutes('unknown', false), false);
  assert.equal(shouldShowAuthenticatedRoutes('refreshing', false), false);
  assert.equal(shouldShowAuthenticatedRoutes('signingIn', true), false);
  assert.equal(shouldShowAuthenticatedRoutes('registering', true), false);
  assert.equal(shouldShowAuthenticatedRoutes('signingOut', true), true);
  assert.equal(shouldShowAuthenticatedRoutes('signingOut', false), false);
  assert.equal(shouldShowAuthenticatedRoutes('signedOut', true), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveShopPurchaseAvailability } from './shop-purchase.ts';

test('shop purchase availability distinguishes nullable monthly limits', () => {
  assert.deepEqual(resolveShopPurchaseAvailability({
    monthlyLimit: null,
    monthlyPurchased: 80,
  }), {
    remaining: null,
    state: 'unlimited',
  });
  assert.deepEqual(resolveShopPurchaseAvailability({
    monthlyLimit: 0,
    monthlyPurchased: 0,
  }), {
    remaining: 0,
    state: 'unavailable',
  });
  assert.deepEqual(resolveShopPurchaseAvailability({
    monthlyLimit: 5,
    monthlyPurchased: 5,
  }), {
    remaining: 0,
    state: 'limitReached',
  });
  assert.deepEqual(resolveShopPurchaseAvailability({
    monthlyLimit: 5,
    monthlyPurchased: 2,
  }), {
    remaining: 3,
    state: 'available',
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveShopImageUrl } from './shop-images.ts';

test('shop images resolve API-relative and absolute HTTP URLs', () => {
  assert.equal(
    resolveShopImageUrl('/images/sign-makeup.png'),
    'https://api.lightnovel.life/images/sign-makeup.png',
  );
  assert.equal(
    resolveShopImageUrl('https://cdn.example/item.png?height=192'),
    'https://cdn.example/item.png?height=192',
  );
  assert.equal(resolveShopImageUrl('javascript:alert(1)'), '');
  assert.equal(resolveShopImageUrl('  '), '');
});

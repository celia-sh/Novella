import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  communityHtmlImageIndex,
  extractCommunityHtmlImages,
} from './community-html-images.ts';

test('lists post images in document order with their declared sizes', () => {
  const html = '<p>a<img src="https://cdn.example/1.jpg" width="343" height="257"></p>'
    + "<p><IMG data-src='x' SRC='https://cdn.example/2.png?size=10x20'></p>"
    + '<img src=https://cdn.example/3.gif width=0 height=12>'
    + '<img alt="no source">';
  assert.deepEqual(extractCommunityHtmlImages(html), [
    { height: 257, source: 'https://cdn.example/1.jpg', width: 343 },
    { source: 'https://cdn.example/2.png?size=10x20' },
    { source: 'https://cdn.example/3.gif' },
  ]);
});

test('finds the gallery page of an image by its source', () => {
  const images = extractCommunityHtmlImages('<img src="a"><img src="b"><img src="a">');
  assert.equal(communityHtmlImageIndex(images, 'b'), 1);
  assert.equal(communityHtmlImageIndex(images, ' a '), 0);
  assert.equal(communityHtmlImageIndex(images, 'c'), -1);
});

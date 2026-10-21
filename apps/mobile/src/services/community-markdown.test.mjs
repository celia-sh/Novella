import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderCommunityMarkdown } from './community-markdown.ts';
import {
  insertMarkdownBlock,
  toggleMarkdownLinePrefix,
  wrapMarkdownSelection,
} from './community-markdown-edits.ts';

test('renders posts with the markup the web editor saves', () => {
  assert.equal(
    renderCommunityMarkdown('*斜* <u>下</u> ~~删~~\n同一段\n\n![](https://i.example/a.png#center)\n\n- 一\n- 二'),
    '<p><em>斜</em> <u>下</u> <s>删</s>\n同一段</p>\n'
      + '<div class="illus"><img src="https://i.example/a.png#center" class="center"></div>\n'
      + '<ul>\n<li>一</li>\n<li>二</li>\n</ul>\n',
  );
  assert.equal(
    renderCommunityMarkdown('正文[^note-1]\n\n[^note-1]: 注释'),
    '<p>正文<a class="duokan-footnote" data-footnote-id="ln-fn-1" href="#ln-fn-1" role="doc-noteref"><sup>[1]</sup></a></p>\n'
      + '<section class="footnotes">\n<aside id="ln-fn-1" data-footnote-label="note-1"><p>注释</p>\n</aside>\n</section>\n',
  );
});

test('wraps the selection, or leaves the cursor between the markers', () => {
  assert.deepEqual(wrapMarkdownSelection('a bc d', { start: 2, end: 4 }, '**', '**'), {
    selection: { start: 4, end: 6 },
    value: 'a **bc** d',
  });
  assert.deepEqual(wrapMarkdownSelection('ab', { start: 1, end: 1 }, '*', '*'), {
    selection: { start: 2, end: 2 },
    value: 'a**b',
  });
});

test('prefixes every touched line, and removes the prefix when all have it', () => {
  const numbered = toggleMarkdownLinePrefix('x\none\ntwo', { start: 3, end: 7 }, /^\d+\. /u, (i) => `${i + 1}. `);
  assert.deepEqual(numbered, { selection: { start: 2, end: 15 }, value: 'x\n1. one\n2. two' });
  assert.equal(
    toggleMarkdownLinePrefix(numbered.value, numbered.selection, /^\d+\. /u, (i) => `${i + 1}. `).value,
    'x\none\ntwo',
  );
});

test('inserts a block as its own paragraph', () => {
  assert.deepEqual(insertMarkdownBlock('ab', { start: 1, end: 1 }, '![](u)'), {
    selection: { start: 11, end: 11 },
    value: 'a\n\n![](u)\n\nb',
  });
  assert.equal(insertMarkdownBlock('', { start: 0, end: 0 }, '![](u)').value, '![](u)\n\n');
});

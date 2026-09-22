import assert from 'node:assert/strict';
import { test } from 'node:test';

import { zhCNResources, zhTWResources } from './resources.ts';

test('shelf media and accessibility resources exist in both locales', () => {
  const requiredKeys = [
    'allTab',
    'novelsTab',
    'comicsTab',
    'mediaTabsAccessibility',
    'shelfEmptyNovel',
    'shelfEmptyNovelDescription',
    'shelfEmptyComic',
    'shelfEmptyComicDescription',
    'folderEmptyNovel',
    'folderEmptyNovelDescription',
    'folderEmptyComic',
    'folderEmptyComicDescription',
    'folderMediaAccessibility',
    'unavailableBook',
    'refreshFailed',
    'loadFailed',
    'dismissError',
    'newFolder',
    'renameFolder',
    'moveSelectedItems',
    'deleteSelectedItems',
    'exitEdit',
  ];
  for (const resources of [zhCNResources, zhTWResources]) {
    const shelf = resources.library.shelf;
    for (const key of requiredKeys) {
      assert.equal(typeof shelf[key], 'string', `missing shelf resource: ${key}`);
      assert.notEqual(shelf[key].trim(), '', `empty shelf resource: ${key}`);
    }
    assert.equal(typeof resources.common.accessibility.retry, 'string');
    assert.equal(typeof resources.common.actions.delete, 'string');
  }
});

test('Simplified and Traditional resources have identical keys and interpolation variables', () => {
  const simplified = flatten(zhCNResources);
  const traditional = flatten(zhTWResources);
  assert.deepEqual([...traditional.keys()].sort(), [...simplified.keys()].sort());
  for (const [key, value] of simplified) {
    const translated = traditional.get(key);
    assert.equal(typeof translated, 'string', `missing Traditional translation: ${key}`);
    assert.notEqual(value.trim(), '', `empty Simplified translation: ${key}`);
    assert.notEqual(translated.trim(), '', `empty Traditional translation: ${key}`);
    assert.deepEqual(placeholders(translated), placeholders(value), `interpolation mismatch: ${key}`);
  }
});

function flatten(value, prefix = '', result = new Map()) {
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'string') result.set(path, item);
    else flatten(item, path, result);
  }
  return result;
}

function placeholders(value) {
  return [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((match) => match[1]).sort();
}

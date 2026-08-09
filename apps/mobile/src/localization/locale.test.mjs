import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeAppLanguage, isAppLanguage, resolveAppLocale } from './locale.ts';

test('explicit app language overrides the system locale', () => {
  assert.equal(resolveAppLocale('zh-CN', [{ languageTag: 'zh-TW' }]), 'zh-CN');
  assert.equal(resolveAppLocale('zh-TW', [{ languageTag: 'en-US' }]), 'zh-TW');
});

test('system language resolves traditional scripts and regions to Taiwan Chinese', () => {
  assert.equal(resolveAppLocale('system', [{ languageCode: 'zh', languageScriptCode: 'Hant', languageTag: 'zh-Hant' }]), 'zh-TW');
  assert.equal(resolveAppLocale('system', [{ languageCode: 'zh', languageTag: 'zh-HK', regionCode: 'HK' }]), 'zh-TW');
  assert.equal(resolveAppLocale('system', [{ languageCode: 'zh', languageTag: 'zh-MO' }]), 'zh-TW');
});

test('unsupported and unknown system languages always fall back to simplified Chinese', () => {
  assert.equal(resolveAppLocale('system', [{ languageCode: 'en', languageTag: 'en-US' }]), 'zh-CN');
  assert.equal(resolveAppLocale('system', [{ languageCode: 'zh', languageScriptCode: 'Hans', languageTag: 'zh-Hans-CN' }]), 'zh-CN');
  assert.equal(resolveAppLocale('system', []), 'zh-CN');
});

test('app language decoder accepts only supported preferences', () => {
  assert.equal(isAppLanguage('system'), true);
  assert.equal(isAppLanguage('zh-CN'), true);
  assert.equal(isAppLanguage('zh-TW'), true);
  assert.equal(isAppLanguage('en-US'), false);
  assert.equal(isAppLanguage(undefined), false);
  assert.equal(decodeAppLanguage('zh-TW'), 'zh-TW');
  assert.equal(decodeAppLanguage('en-US'), 'system');
  assert.equal(decodeAppLanguage(undefined), 'system');
});

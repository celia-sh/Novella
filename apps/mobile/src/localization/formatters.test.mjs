import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatRelativeTime } from './formatters.ts';

const NOW = Date.parse('2026-08-09T12:00:00Z');

test('relative time formatting does not require Intl.RelativeTimeFormat', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'RelativeTimeFormat');
  Object.defineProperty(Intl, 'RelativeTimeFormat', { configurable: true, value: undefined });
  try {
    assert.doesNotThrow(() => formatRelativeTime(NOW - 5 * 60_000, 'zh-CN', NOW));
    assert.doesNotThrow(() => formatRelativeTime(NOW + 2 * 3_600_000, 'zh-TW', NOW));
  } finally {
    if (descriptor) Object.defineProperty(Intl, 'RelativeTimeFormat', descriptor);
    else delete Intl.RelativeTimeFormat;
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatMessageTimestamp, formatRelativeTime } from './formatters.ts';

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

test('message timestamps name today, yesterday and the weekday before falling back to a date', () => {
  const now = new Date(2026, 9, 19, 18, 0).getTime();
  assert.equal(formatMessageTimestamp(new Date(2026, 9, 19, 9, 5), 'zh-CN', now), '今天 09:05');
  assert.equal(formatMessageTimestamp(new Date(2026, 9, 18, 23, 59), 'zh-CN', now), '昨天 23:59');
  assert.match(formatMessageTimestamp(new Date(2026, 9, 15, 14, 32), 'zh-CN', now), /^星期四 14:32$/);
  assert.equal(formatMessageTimestamp(new Date(2026, 8, 1, 8, 0), 'zh-CN', now), '9月1日 08:00');
  assert.equal(formatMessageTimestamp(new Date(2025, 11, 31, 20, 15), 'zh-CN', now), '2025年12月31日 20:15');
});

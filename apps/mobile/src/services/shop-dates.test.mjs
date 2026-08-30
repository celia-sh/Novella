import assert from 'node:assert/strict';
import test from 'node:test';

import { formatUtcDate, markSignInCalendarDate, utcDateAtNoon } from './shop-dates.ts';

test('shop makeup dates use UTC calendar days', () => {
  const now = new Date('2026-03-01T23:30:00.000Z');
  assert.equal(formatUtcDate(utcDateAtNoon(-1, now)), '2026-02-28');
  assert.equal(formatUtcDate(utcDateAtNoon(-30, now)), '2026-01-30');
});

test('confirmed makeup updates the calendar projection without duplicating a day', () => {
  const calendar = {
    year: 2026,
    month: 8,
    days: [{ date: '2026-08-01', streak: 7, reward: 5 }],
  };
  const updated = markSignInCalendarDate(calendar, '2026-08-01', 8, 12);
  assert.deepEqual(updated.days, [{ date: '2026-08-01', streak: 8, reward: 12 }]);

  const added = markSignInCalendarDate(calendar, '2026-08-02T00:00:00.000Z', 9, 13);
  assert.deepEqual(added.days, [
    { date: '2026-08-01', streak: 7, reward: 5 },
    { date: '2026-08-02', streak: 9, reward: 13 },
  ]);
});

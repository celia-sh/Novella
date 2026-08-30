import type { SignInCalendar } from '@novella/api-client';

export function utcDateAtNoon(dayOffset: number, now = new Date()): Date {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + dayOffset,
    12,
  ));
}

export function formatUtcDate(value: Date): string {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function markSignInCalendarDate(
  calendar: SignInCalendar,
  date: string,
  streak: number,
  reward: number,
): SignInCalendar {
  const normalizedDate = date.slice(0, 10);
  const existing = calendar.days.some((day) => day.date.slice(0, 10) === normalizedDate);
  return {
    ...calendar,
    days: existing
      ? calendar.days.map((day) => day.date.slice(0, 10) === normalizedDate
        ? { ...day, date: normalizedDate, streak, reward }
        : day)
      : [...calendar.days, { date: normalizedDate, streak, reward }],
  };
}

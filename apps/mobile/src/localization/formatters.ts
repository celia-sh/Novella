import type { AppLocale } from './locale.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(
  value: string | number | Date,
  locale: AppLocale,
  now = Date.now(),
): string {
  const timestamp = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  const difference = timestamp - now;
  const absolute = Math.abs(difference);
  if (absolute < MINUTE) return locale === 'zh-TW' ? '剛剛' : '刚刚';
  if (absolute < HOUR) return formatRelativeUnit(difference, MINUTE, 'minute', locale);
  if (absolute < DAY) return formatRelativeUnit(difference, HOUR, 'hour', locale);
  if (absolute < 26 * DAY) return formatRelativeUnit(difference, DAY, 'day', locale);
  if (absolute < 46 * DAY) return formatRelativeCount(difference < 0 ? -1 : 1, 'month', locale);
  if (absolute < 320 * DAY) {
    const months = Math.max(1, Math.round(absolute / (30.4 * DAY)));
    return formatRelativeCount(difference < 0 ? -months : months, 'month', locale);
  }
  if (absolute < 548 * DAY) return formatRelativeCount(difference < 0 ? -1 : 1, 'year', locale);
  const years = Math.max(1, Math.round(absolute / (365.25 * DAY)));
  return formatRelativeCount(difference < 0 ? -years : years, 'year', locale);
}

type RelativeUnit = 'minute' | 'hour' | 'day' | 'month' | 'year';

function formatRelativeUnit(
  difference: number,
  unitSize: number,
  unit: RelativeUnit,
  locale: AppLocale,
): string {
  const count = Math.max(1, Math.floor(Math.abs(difference) / unitSize));
  return formatRelativeCount(difference < 0 ? -count : count, unit, locale);
}

function formatRelativeCount(count: number, unit: RelativeUnit, locale: AppLocale): string {
  const labels: Record<AppLocale, Record<RelativeUnit, string>> = {
    'zh-CN': { day: '天', hour: '小时', minute: '分钟', month: '个月', year: '年' },
    'zh-TW': { day: '天', hour: '小時', minute: '分鐘', month: '個月', year: '年' },
  };
  const direction = count < 0
    ? '前'
    : locale === 'zh-TW'
      ? '後'
      : '后';
  return `${Math.abs(count)} ${labels[locale][unit]}${direction}`;
}

export function formatDate(
  value: string | number | Date,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatCompactNumber(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);
}

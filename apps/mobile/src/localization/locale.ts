export type AppLocale = 'zh-CN' | 'zh-TW';
export type AppLanguage = 'system' | AppLocale;

export interface DeviceLocaleLike {
  languageCode?: string | null;
  languageScriptCode?: string | null;
  languageTag?: string | null;
  regionCode?: string | null;
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'system' || value === 'zh-CN' || value === 'zh-TW';
}

export function decodeAppLanguage(value: unknown): AppLanguage {
  return isAppLanguage(value) ? value : 'system';
}

export function resolveAppLocale(
  preference: AppLanguage,
  locales: readonly DeviceLocaleLike[],
): AppLocale {
  if (preference !== 'system') return preference;
  const locale = locales[0];
  if (!locale) return 'zh-CN';
  const script = locale.languageScriptCode?.toLowerCase();
  const region = locale.regionCode?.toUpperCase();
  const tag = locale.languageTag?.toLowerCase() ?? '';
  if (
    script === 'hant' ||
    tag.includes('-hant') ||
    (locale.languageCode?.toLowerCase() === 'zh' && (
      region === 'TW' || region === 'HK' || region === 'MO' ||
      /-(?:tw|hk|mo)(?:-|$)/u.test(tag)
    ))
  ) return 'zh-TW';
  return 'zh-CN';
}

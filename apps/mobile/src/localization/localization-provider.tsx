import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useLocales } from 'expo-localization';
import { createInstance, type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { useAppSettings } from '@/services/settings';

import { resolveAppLocale, type AppLocale } from './locale';
import { zhCNResources, zhTWResources } from './resources';

const instances: Record<AppLocale, i18n> = {
  'zh-CN': createI18n('zh-CN'),
  'zh-TW': createI18n('zh-TW'),
};

const AppLocaleContext = createContext<AppLocale>('zh-CN');

export function AppLocalizationProvider({ children }: PropsWithChildren) {
  const settings = useAppSettings();
  const deviceLocales = useLocales();
  const locale = resolveAppLocale(settings.language, deviceLocales);
  const instance = instances[locale];
  const value = useMemo(() => locale, [locale]);

  return (
    <AppLocaleContext.Provider value={value}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </AppLocaleContext.Provider>
  );
}

export function useAppLocale(): AppLocale {
  return useContext(AppLocaleContext);
}

function createI18n(locale: AppLocale): i18n {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    defaultNS: 'common',
    fallbackLng: 'zh-CN',
    initAsync: false,
    interpolation: { escapeValue: false },
    lng: locale,
    nonExplicitSupportedLngs: false,
    resources: {
      'zh-CN': zhCNResources,
      'zh-TW': zhTWResources,
    },
    returnEmptyString: false,
    returnNull: false,
    supportedLngs: ['zh-CN', 'zh-TW'],
  });
  return instance;
}

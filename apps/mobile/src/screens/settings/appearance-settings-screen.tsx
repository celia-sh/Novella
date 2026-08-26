import { useTranslation } from 'react-i18next';

import { NativeGroupedList, NativeGroupedListSection } from '@/components/native-grouped-list';
import { NativePickerRow, NativeToggleRow } from '@/components/native-setting-controls';
import { updateAppSettings, useAppSettings } from '@/services/settings';

export function AppearanceSettingsScreen() {
  const settings = useAppSettings();
  const { t } = useTranslation('settings');

  return (
    <NativeGroupedList testID="appearance-settings">
      <NativeGroupedListSection title={t('appearance.language.section')}>
        <NativePickerRow
          description={t('appearance.language.description')}
          icon="language"
          onValueChange={(value) => void updateAppSettings({ language: value })}
          options={[
            { label: t('appearance.language.options.system'), value: 'system' },
            { label: t('appearance.language.options.simplifiedChinese'), value: 'zh-CN' },
            { label: t('appearance.language.options.traditionalChinese'), value: 'zh-TW' },
          ] as const}
          selectedValue={settings.language}
          title={t('appearance.language.title')}
        />
      </NativeGroupedListSection>

      <NativeGroupedListSection title={t('appearance.theme.section')}>
        <NativePickerRow
          description={t('appearance.theme.description')}
          icon="theme"
          onValueChange={(value) => void updateAppSettings({ theme: value })}
          options={[
            { label: t('appearance.theme.options.system'), value: 'system' },
            { label: t('appearance.theme.options.light'), value: 'light' },
            { label: t('appearance.theme.options.dark'), value: 'dark' },
          ] as const}
          selectedValue={settings.theme}
          title={t('appearance.theme.title')}
        />
        <NativeToggleRow
          description={t('appearance.theme.coverColorDescription')}
          icon="coverColor"
          onValueChange={(value) => void updateAppSettings({ coverColorExtraction: value })}
          title={t('appearance.theme.coverColorTitle')}
          value={settings.coverColorExtraction}
        />
      </NativeGroupedListSection>
    </NativeGroupedList>
  );
}

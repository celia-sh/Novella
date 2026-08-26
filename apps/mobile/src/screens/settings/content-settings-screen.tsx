import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  NativeGroupedList,
  NativeGroupedListRow,
  NativeGroupedListSection,
} from '@/components/native-grouped-list';
import { NativePickerRow, NativeToggleRow } from '@/components/native-setting-controls';
import { updateAppSettings, useAppSettings } from '@/services/settings';

export function ContentSettingsScreen() {
  const settings = useAppSettings();
  const { t } = useTranslation('settings');

  return (
    <NativeGroupedList testID="content-settings">
      <NativeGroupedListSection title={t('content.home.section')}>
        <NativePickerRow
          description={t('content.home.rankingDescription')}
          icon="ranking"
          onValueChange={(value) => void updateAppSettings({ homeRankType: value })}
          options={[
            { label: t('content.home.rankingOptions.daily'), value: 'daily' },
            { label: t('content.home.rankingOptions.weekly'), value: 'weekly' },
            { label: t('content.home.rankingOptions.monthly'), value: 'monthly' },
          ] as const}
          selectedValue={settings.homeRankType}
          title={t('content.home.rankingTitle')}
        />
      </NativeGroupedListSection>

      <NativeGroupedListSection title={t('content.filters.section')}>
        <NativeToggleRow
          description={t('content.filters.japaneseDescription')}
          icon="japanese"
          onValueChange={(value) => void updateAppSettings({ ignoreJapanese: value })}
          title={t('content.filters.japaneseTitle')}
          value={settings.ignoreJapanese}
        />
        <NativeToggleRow
          description={t('content.filters.aiDescription')}
          icon="aiContent"
          onValueChange={(value) => void updateAppSettings({ ignoreAI: value })}
          title={t('content.filters.aiTitle')}
          value={settings.ignoreAI}
        />
        <NativeToggleRow
          description={t('content.filters.level6Description')}
          icon="level6Content"
          onValueChange={(value) => void updateAppSettings({ ignoreLevel6: value })}
          title={t('content.filters.level6Title')}
          value={settings.ignoreLevel6}
        />
      </NativeGroupedListSection>

      <NativeGroupedListSection title={t('content.search.section')}>
        <NativePickerRow
          description={t('content.search.seriesDescription')}
          icon="seriesSearch"
          onValueChange={(value) => void updateAppSettings({ seriesSearchMode: value })}
          options={[
            { label: t('content.search.options.system'), value: 'system' },
            { label: t('content.search.options.original'), value: 'original' },
            { label: t('content.search.options.displayed'), value: 'display' },
          ] as const}
          selectedValue={settings.seriesSearchMode}
          title={t('content.search.seriesTitle')}
        />
      </NativeGroupedListSection>

      <NativeGroupedListSection title={t('content.badges.section')}>
        <NativeGroupedListRow
          description={t('content.badges.description')}
          icon="badges"
          onPress={() => router.push('/settings/badges')}
          title={t('content.badges.title')}
        />
      </NativeGroupedListSection>

      <NativeGroupedListSection title={t('content.conversion.section')}>
        <NativePickerRow
          description={t('content.conversion.description')}
          icon="textConvert"
          onValueChange={(value) => void updateAppSettings({ convertType: value })}
          options={[
            { label: t('content.conversion.options.off'), value: 'none' },
            { label: t('content.conversion.options.traditionalToSimplified'), value: 't2s' },
            { label: t('content.conversion.options.simplifiedToTraditional'), value: 's2t' },
          ] as const}
          selectedValue={settings.convertType}
          title={t('content.conversion.title')}
        />
      </NativeGroupedListSection>
    </NativeGroupedList>
  );
}

import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  NativeGroupedList,
  NativeGroupedListSection,
} from '@/components/native-grouped-list';
import {
  NativePickerRow,
  NativeSliderRow,
  NativeToggleRow,
} from '@/components/native-setting-controls';
import {
  READER_PRELOAD_WINDOW,
  toggleCleanChapterTitleScope,
  updateAppSettings,
  useAppSettings,
} from '@/services/settings';

export function ReaderSettingsScreen() {
  const { t } = useTranslation('settings');

  return (
    <NativeGroupedList
      onBackPress={() => router.back()}
      showBackButton
      testID="reader-settings"
      title={t('reader.title')}
    >
      <ReaderSettingsContent />
    </NativeGroupedList>
  );
}

/** Shared settings rows, also rendered inside the reader settings sheet. */
export function ReaderSettingsContent() {
  const settings = useAppSettings();
  const { t } = useTranslation('settings');

  return (
    <>
      <NativeGroupedListSection title={t('reader.typography.section')}>
        <NativeSliderRow
          description={t('reader.typography.fontSizeDescription')}
          formatValue={(value) => t('reader.typography.points', { value: Math.round(value) })}
          icon="textSize"
          max={32}
          min={12}
          onValueChange={(value) => void updateAppSettings({ fontSize: value })}
          step={1}
          title={t('reader.typography.fontSizeTitle')}
          value={settings.fontSize}
        />
        <NativeSliderRow
          description={t('reader.typography.lineHeightDescription')}
          formatValue={(value) => t('reader.typography.multiplier', { value: value.toFixed(1) })}
          icon="lineHeight"
          max={2.5}
          min={1}
          onValueChange={(value) => void updateAppSettings({ readerLineHeight: value })}
          step={0.1}
          title={t('reader.typography.lineHeightTitle')}
          value={settings.readerLineHeight}
        />
        <NativeSliderRow
          description={t('reader.typography.sidePaddingDescription')}
          formatValue={(value) => t('reader.typography.points', { value: Math.round(value) })}
          icon="sidePadding"
          max={64}
          min={12}
          onValueChange={(value) => void updateAppSettings({ readerSidePadding: value })}
          step={1}
          title={t('reader.typography.sidePaddingTitle')}
          value={settings.readerSidePadding}
        />
      </NativeGroupedListSection>

      <NativeGroupedListSection title={t('reader.chapterTitles.section')}>
        <NativeToggleRow
          description={t('reader.chapterTitles.continueDescription')}
          icon="continueReading"
          onValueChange={(value) => void updateAppSettings({
            cleanChapterTitleScopes: toggleCleanChapterTitleScope(
              settings.cleanChapterTitleScopes,
              'continueReading',
              value,
            ),
          })}
          title={t('reader.chapterTitles.continueTitle')}
          value={settings.cleanChapterTitleScopes.includes('continueReading')}
        />
        <NativeToggleRow
          description={t('reader.chapterTitles.readerDescription')}
          icon="readerTitle"
          onValueChange={(value) => void updateAppSettings({
            cleanChapterTitleScopes: toggleCleanChapterTitleScope(
              settings.cleanChapterTitleScopes,
              'readerTitle',
              value,
            ),
          })}
          title={t('reader.chapterTitles.readerTitle')}
          value={settings.cleanChapterTitleScopes.includes('readerTitle')}
        />
      </NativeGroupedListSection>

      <NativeGroupedListSection title={t('reader.behavior.section')}>
        <NativePickerRow
          description={t('reader.behavior.modeDescription')}
          icon="readingMode"
          onValueChange={(value) => void updateAppSettings({ readerViewMode: value })}
          options={[
            { label: t('reader.behavior.modeOptions.paged'), value: 'paged' },
            { label: t('reader.behavior.modeOptions.scroll'), value: 'scroll' },
          ] as const}
          selectedValue={settings.readerViewMode}
          title={t('reader.behavior.modeTitle')}
        />
        <NativeSliderRow
          description={t('reader.behavior.preloadDescription')}
          formatValue={(value) => {
            const count = Math.round(value);
            return count === 0
              ? t('reader.behavior.preloadOff')
              : t('reader.behavior.preloadCount', { count });
          }}
          icon="preload"
          max={READER_PRELOAD_WINDOW.max}
          min={READER_PRELOAD_WINDOW.min}
          onValueChange={(value) => void updateAppSettings({ readerPreloadWindow: value })}
          step={1}
          title={t('reader.behavior.preloadTitle')}
          value={settings.readerPreloadWindow}
        />
        <NativeToggleRow
          description={t('reader.behavior.indentDescription')}
          icon="firstLineIndent"
          onValueChange={(value) => void updateAppSettings({ readerFirstLineIndent: value })}
          title={t('reader.behavior.indentTitle')}
          value={settings.readerFirstLineIndent}
        />
        <NativeToggleRow
          description={t('reader.behavior.noAnimationDescription')}
          icon="noPageAnimation"
          onValueChange={(value) => void updateAppSettings({ readerPagedNoAnimation: value })}
          title={t('reader.behavior.noAnimationTitle')}
          value={settings.readerPagedNoAnimation}
        />
        <NativeToggleRow
          description={t('reader.behavior.imagePreviewDescription')}
          icon="imagePreview"
          onValueChange={(value) => void updateAppSettings({ readerImagePreviewOpenOnLongPress: value })}
          title={t('reader.behavior.imagePreviewTitle')}
          value={settings.readerImagePreviewOpenOnLongPress}
        />
      </NativeGroupedListSection>
    </>
  );
}

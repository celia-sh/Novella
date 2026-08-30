import { useTranslation } from 'react-i18next';

import {
  NativeGroupedList,
  NativeGroupedListSection,
} from '@/components/native-grouped-list';
import { ReaderBackgroundColorSettings } from '@/components/reader-background-color-settings';
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
import { useAppColorScheme } from '@/theme/app-theme';
import { resolveNovelReaderBackgroundColor } from '@/theme/reader-theme';

export function ReaderSettingsScreen() {
  const { t } = useTranslation('settings');

  return (
    <NativeGroupedList testID="reader-settings">
      <ReaderSettingsContent />
    </NativeGroupedList>
  );
}

/** Shared settings rows, also rendered inside the reader settings sheet. */
export function ReaderSettingsContent() {
  const settings = useAppSettings();
  const colorScheme = useAppColorScheme();
  const { t } = useTranslation('settings');
  const novelReaderBackgroundColor = resolveNovelReaderBackgroundColor(
    settings.novelReaderBackgroundColor,
    colorScheme,
  );

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
          description={t('reader.typography.paragraphSpacingDescription')}
          formatValue={(value) => t('reader.typography.points', { value: Math.round(value) })}
          icon="lineHeight"
          max={32}
          min={0}
          onValueChange={(value) => void updateAppSettings({ readerParagraphSpacing: value })}
          step={1}
          title={t('reader.typography.paragraphSpacingTitle')}
          value={settings.readerParagraphSpacing}
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

      <ReaderBackgroundColorSettings
        backgroundColor={novelReaderBackgroundColor}
        description={t('reader.appearance.backgroundDescription')}
        onValueChange={(value) => void updateAppSettings({ novelReaderBackgroundColor: value })}
        sectionTitle={t('reader.appearance.section')}
        title={t('reader.appearance.backgroundTitle')}
      />

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
          description={t('reader.behavior.directionDescription')}
          icon="readingDirection"
          onValueChange={(value) => void updateAppSettings({ comicPagedDirection: value })}
          options={[
            { label: t('reader.behavior.directionOptions.ltr'), value: 'ltr' },
            { label: t('reader.behavior.directionOptions.rtl'), value: 'rtl' },
          ] as const}
          selectedValue={settings.comicPagedDirection}
          title={t('reader.behavior.directionTitle')}
        />
        <NativePickerRow
          description={t('reader.behavior.novelModeDescription')}
          icon="reader"
          onValueChange={(value) => void updateAppSettings({ novelReaderViewMode: value })}
          options={[
            { label: t('reader.behavior.modeOptions.paged'), value: 'paged' },
            { label: t('reader.behavior.modeOptions.scroll'), value: 'scroll' },
          ] as const}
          selectedValue={settings.novelReaderViewMode}
          title={t('reader.behavior.novelModeTitle')}
        />
        <NativePickerRow
          description={t('reader.behavior.comicModeDescription')}
          icon="books"
          onValueChange={(value) => void updateAppSettings({ comicReaderViewMode: value })}
          options={[
            { label: t('reader.behavior.modeOptions.paged'), value: 'paged' },
            { label: t('reader.behavior.modeOptions.scroll'), value: 'scroll' },
          ] as const}
          selectedValue={settings.comicReaderViewMode}
          title={t('reader.behavior.comicModeTitle')}
        />
        <NativeToggleRow
          description={t('reader.behavior.comicDoublePageOffsetDescription')}
          icon="comicPageLayout"
          onValueChange={(value) => void updateAppSettings({ comicDoublePageOffset: value })}
          title={t('reader.behavior.comicDoublePageOffsetTitle')}
          value={settings.comicDoublePageOffset}
        />
        <NativeToggleRow
          description={t('reader.behavior.pagedTapDescription')}
          icon="readingMode"
          onValueChange={(value) => void updateAppSettings({ readerPagedTapNavigation: value })}
          title={t('reader.behavior.pagedTapTitle')}
          value={settings.readerPagedTapNavigation}
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

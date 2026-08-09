import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { showAlert } from '@/components/native-alert-dialog';
import { router } from 'expo-router';

import { clearBookCoverRevealCache } from '@/components/book-cover-image';
import {
  NativeGroupedList,
  NativeGroupedListRow,
  NativeGroupedListSection,
} from '@/components/native-grouped-list';
import { NativeSliderRow, NativeToggleRow } from '@/components/native-setting-controls';
import { clearReaderFontCache } from '@/services/reader-font-loader';
import { updateAppSettings, useAppSettings } from '@/services/settings';

export function CacheSettingsScreen() {
  const settings = useAppSettings();
  const { t } = useTranslation('settings');
  const [clearingFonts, setClearingFonts] = useState(false);
  const [clearingImages, setClearingImages] = useState(false);

  async function handleClearImages() {
    if (clearingImages) return;
    setClearingImages(true);
    try {
      clearBookCoverRevealCache();
      const [memoryCleared, diskCleared] = await Promise.all([
        Image.clearMemoryCache(),
        Image.clearDiskCache(),
      ]);
      if (!memoryCleared || !diskCleared) {
        showAlert(
          t('cache.alerts.clearImagesFailedTitle'),
          t('cache.alerts.clearImagesFailedMessage'),
        );
        return;
      }
      showAlert(
        t('cache.alerts.imagesClearedTitle'),
        t('cache.alerts.imagesClearedMessage'),
      );
    } catch {
      showAlert(
        t('cache.alerts.clearImagesFailedTitle'),
        t('cache.alerts.clearImagesFailedMessage'),
      );
    } finally {
      setClearingImages(false);
    }
  }

  async function handleClearReaderFonts() {
    if (clearingFonts) return;
    setClearingFonts(true);
    try {
      const entryCount = clearReaderFontCache();
      showAlert(
        t('cache.alerts.fontsClearedTitle'),
        entryCount === 0
          ? t('cache.alerts.noFonts')
          : t('cache.alerts.fontsRemoved', { count: entryCount }),
      );
    } catch {
      showAlert(
        t('cache.alerts.clearFontsFailedTitle'),
        t('cache.alerts.clearFontsFailedMessage'),
      );
    } finally {
      setClearingFonts(false);
    }
  }

  return (
    <NativeGroupedList
      onBackPress={() => router.back()}
      showBackButton
      testID="cache-settings"
      title={t('cache.title')}
    >
      <NativeGroupedListSection title={t('cache.section')}>
        <NativeToggleRow
          description={t('cache.bookDetailDescription')}
          icon="bookDetailCache"
          onValueChange={(value) => void updateAppSettings({ bookDetailCacheEnabled: value })}
          title={t('cache.bookDetailTitle')}
          value={settings.bookDetailCacheEnabled}
        />
        <NativeToggleRow
          description={t('cache.fontDescription')}
          icon="fontCache"
          onValueChange={(value) => void updateAppSettings({ fontCacheEnabled: value })}
          title={t('cache.fontTitle')}
          value={settings.fontCacheEnabled}
        />
        <NativeSliderRow
          description={t('cache.fontLimitDescription')}
          formatValue={(value) => t('cache.bookCount', { count: Math.round(value) })}
          icon="fontCacheLimit"
          max={60}
          min={10}
          onValueChange={(value) => void updateAppSettings({ fontCacheLimit: value })}
          step={1}
          title={t('cache.fontLimitTitle')}
          value={settings.fontCacheLimit}
        />
        <NativeGroupedListRow
          description={t('cache.clearImagesDescription')}
          icon="clearImageCache"
          onPress={() => void handleClearImages()}
          title={t('cache.clearImagesTitle')}
        />
        <NativeGroupedListRow
          description={t('cache.clearFontsDescription')}
          icon="clearFontCache"
          onPress={() => void handleClearReaderFonts()}
          title={t('cache.clearFontsTitle')}
        />
      </NativeGroupedListSection>
    </NativeGroupedList>
  );
}

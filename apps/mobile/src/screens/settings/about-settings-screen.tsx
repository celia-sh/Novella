import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NativeGroupedList, NativeGroupedListRow, NativeGroupedListSection } from '@/components/native-grouped-list';
import { NativeToggleRow, NativeValueRow } from '@/components/native-setting-controls';
import { runManualAppUpdateCheck } from '@/services/app-update-alerts';
import { updateAppSettings, useAppSettings } from '@/services/settings';

const repositoryUrl = 'https://github.com/celia-sh/Novella';
const novellaUrl = 'https://novella.celia.sh';
const lightNovelShelfUrl = 'https://www.lightnovel.app';
const lightNovelGroupUrl = 'https://t.me/+J5xdTWVGOJMyOWRl';
const developerGroupUrl = 'https://t.me/+rZYx8H_TvUpmZjJh';

function displayVersion(unknownVersion: string): string {
  const baseVersion = Constants.expoConfig?.version?.trim() ?? '';
  if (!baseVersion) return unknownVersion;

  const buildLabel = Constants.expoConfig?.extra?.buildLabel?.trim() ?? '';
  return buildLabel ? `${baseVersion} (${buildLabel})` : baseVersion;
}

export function AboutSettingsScreen() {
  const settings = useAppSettings();
  const { t } = useTranslation('settings');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const version = displayVersion(t('about.unknownVersion'));

  async function handleCheckUpdate() {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      await runManualAppUpdateCheck((key) => t(key));
    } finally {
      setCheckingUpdate(false);
    }
  }

  return (
    <NativeGroupedList
      onBackPress={() => router.back()}
      showBackButton
      testID="about-settings"
      title={t('about.title')}
    >
      <NativeGroupedListSection title={t('about.sections.app')}>
        <NativeValueRow
          description={t('about.versionDescription')}
          icon="version"
          onPress={() => void handleCheckUpdate()}
          title={t('about.versionTitle')}
          value={version}
        />
        <NativeToggleRow
          description={t('about.update.checkDescription')}
          icon="appUpdate"
          onValueChange={(value) => void updateAppSettings({ autoCheckUpdate: value })}
          title={t('about.update.checkTitle')}
          value={settings.autoCheckUpdate}
        />
        <NativeGroupedListRow
          description={t('about.sourceDescription')}
          icon="sourceCode"
          onPress={() => void Linking.openURL(repositoryUrl)}
          title={t('about.sourceTitle')}
        />
        <NativeGroupedListRow
          description={t('about.changelogsDescription')}
          icon="changelogs"
          onPress={() => void Linking.openURL(`${repositoryUrl}/releases`)}
          title={t('about.changelogsTitle')}
        />
      </NativeGroupedListSection>
      <NativeGroupedListSection title={t('about.sections.externalLinks')}>
        <NativeGroupedListRow
          description={t('about.externalLinks.novellaDescription')}
          icon="website"
          onPress={() => void Linking.openURL(novellaUrl)}
          title={t('about.externalLinks.novellaTitle')}
        />
        <NativeGroupedListRow
          description={t('about.externalLinks.lightNovelShelfDescription')}
          icon="books"
          onPress={() => void Linking.openURL(lightNovelShelfUrl)}
          title={t('about.externalLinks.lightNovelShelfTitle')}
        />
        <NativeGroupedListRow
          description={t('about.externalLinks.lightNovelGroupDescription')}
          icon="telegram"
          onPress={() => void Linking.openURL(lightNovelGroupUrl)}
          title={t('about.externalLinks.lightNovelGroupTitle')}
        />
        <NativeGroupedListRow
          description={t('about.externalLinks.developerGroupDescription')}
          icon="telegram"
          onPress={() => void Linking.openURL(developerGroupUrl)}
          title={t('about.externalLinks.developerGroupTitle')}
        />
      </NativeGroupedListSection>
    </NativeGroupedList>
  );
}

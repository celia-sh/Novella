import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NativeGroupedList, NativeGroupedListRow, NativeGroupedListSection } from '@/components/native-grouped-list';
import { NativeValueRow } from '@/components/native-setting-controls';

const repositoryUrl = 'https://github.com/Kanscape/Novella';

function displayVersion(unknownVersion: string): string {
  const baseVersion = Constants.expoConfig?.version?.trim() ?? '';
  if (!baseVersion) return unknownVersion;

  const buildLabel = Constants.expoConfig?.extra?.buildLabel?.trim() ?? '';
  return buildLabel ? `${baseVersion} (${buildLabel})` : baseVersion;
}

export function AboutSettingsScreen() {
  const { t } = useTranslation('settings');
  const version = displayVersion(t('about.unknownVersion'));

  return (
    <NativeGroupedList
      onBackPress={() => router.back()}
      showBackButton
      testID="about-settings"
      title={t('about.title')}
    >
      <NativeGroupedListSection title="Novella">
        <NativeValueRow
          description={t('about.versionDescription')}
          icon="version"
          title={t('about.versionTitle')}
          value={version}
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
    </NativeGroupedList>
  );
}

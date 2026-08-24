import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  NativeGroupedList,
  NativeGroupedListRow,
  NativeGroupedListSection,
} from '@/components/native-grouped-list';
import { DisclosureIcon } from '@/components/settings-row-accessories';
import { SettingsRootNavigation } from '@/components/settings-root-navigation';

export function NativeSettingsPanel() {
  const { t } = useTranslation('settings');

  const returnToDiscover = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/(discover)');
  };

  return (
    <>
      <NativeGroupedList
        iconSet="platform"
        largeTitle
        onBackPress={returnToDiscover}
        showBackButton
        testID="native-settings-panel"
        title={t('panel.title')}
      >
        <NativeGroupedListSection title={t('panel.sections.account')}>
          <NativeGroupedListRow
            description={t('panel.profile.description')}
            icon="account"
            onPress={() => router.push('/settings/profile')}
            title={t('panel.profile.title')}
            trailing={<DisclosureIcon />}
          />
        </NativeGroupedListSection>

        <NativeGroupedListSection title={t('panel.sections.general')}>
          <NativeGroupedListRow
            description={t('panel.reading.description')}
            icon="reader"
            onPress={() => router.push('/settings/reader')}
            title={t('panel.reading.title')}
            trailing={<DisclosureIcon />}
          />
          <NativeGroupedListRow
            description={t('panel.content.description')}
            icon="content"
            onPress={() => router.push('/settings/content')}
            title={t('panel.content.title')}
            trailing={<DisclosureIcon />}
          />
          <NativeGroupedListRow
            description={t('panel.appearance.description')}
            icon="appearance"
            onPress={() => router.push('/settings/appearance')}
            title={t('panel.appearance.title')}
            trailing={<DisclosureIcon />}
          />
        </NativeGroupedListSection>

        <NativeGroupedListSection title={t('panel.sections.data')}>
          <NativeGroupedListRow
            description={t('panel.cache.description')}
            icon="cache"
            onPress={() => router.push('/settings/cache')}
            title={t('panel.cache.title')}
            trailing={<DisclosureIcon />}
          />
        </NativeGroupedListSection>

        <NativeGroupedListSection title={t('panel.sections.about')}>
          <NativeGroupedListRow
            description={t('panel.about.description')}
            icon="info"
            onPress={() => router.push('/settings/about')}
            title={t('panel.about.title')}
            trailing={<DisclosureIcon />}
          />
        </NativeGroupedListSection>
      </NativeGroupedList>
      <SettingsRootNavigation />
    </>
  );
}

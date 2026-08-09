import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export function DiscoverNavigation() {
  const { t } = useTranslation('navigation');
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel={t('accessibility.profileAndSettings')}
        icon="person.crop.circle"
        onPress={() => router.push('/settings')}
      />
    </Stack.Toolbar>
  );
}

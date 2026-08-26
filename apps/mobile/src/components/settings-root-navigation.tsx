import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export function SettingsRootNavigation() {
  const { t } = useTranslation('navigation');
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        accessibilityLabel={t('accessibility.backToDiscover')}
        icon="chevron.left"
        onPress={returnToDiscover}
      />
    </Stack.Toolbar>
  );
}

function returnToDiscover() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/(tabs)/(discover)');
}

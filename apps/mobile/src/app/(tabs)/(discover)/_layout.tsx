import Stack from 'expo-router/stack';
import { useTranslation } from 'react-i18next';

import { useSystemScreenStackPreset } from '@/theme/stack-preset';

export default function DiscoverStackLayout() {
  const { t } = useTranslation('navigation');
  const systemScreenStackPreset = useSystemScreenStackPreset();

  return (
    <Stack screenOptions={systemScreenStackPreset}>
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: true,
          headerShown: true,
          title: t('tabs.discover'),
        }}
      />
    </Stack>
  );
}

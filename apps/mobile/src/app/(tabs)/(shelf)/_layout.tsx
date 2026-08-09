import Stack from 'expo-router/stack';
import { useTranslation } from 'react-i18next';

import { useSystemScreenStackPreset } from '@/theme/stack-preset';

export default function ShelfStackLayout() {
  const { t } = useTranslation('navigation');
  const isAndroid = process.env.EXPO_OS === 'android';
  const systemScreenStackPreset = useSystemScreenStackPreset();

  return (
    <Stack screenOptions={systemScreenStackPreset}>
      <Stack.Screen
        name="shelf"
        options={{
          headerLargeTitle: !isAndroid,
          headerShown: !isAndroid,
          title: t('tabs.shelf'),
        }}
      />

    </Stack>
  );
}

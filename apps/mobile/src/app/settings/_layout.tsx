import Stack from 'expo-router/stack';
import { useTranslation } from 'react-i18next';

import { useSystemScreenStackPreset } from '@/theme/stack-preset';

export default function SettingsStackLayout() {
  const { t } = useTranslation('settings');
  const systemScreenStackPreset = useSystemScreenStackPreset();
  const badgeSheetOptions = {
    sheetAllowedDetents: [0.75, 1],
    sheetGrabberVisible: true,
    sheetInitialDetentIndex: 0,
  };

  return (
    <Stack screenOptions={systemScreenStackPreset}>
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: true, title: t('panel.title') }}
      />
      <Stack.Screen name="profile" options={{ title: t('profile.title') }} />
      <Stack.Screen name="avatar" options={{ title: t('avatar.title') }} />
      <Stack.Screen name="shop" options={{ title: t('shop.title') }} />
      <Stack.Screen
        name="point-logs"
        options={{
          headerShown: false,
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          sheetInitialDetentIndex: 0,
          title: t('pointLogs.experienceTitle'),
        }}
      />
      <Stack.Screen name="reader" options={{ title: t('reader.title') }} />
      <Stack.Screen name="content" options={{ title: t('content.title') }} />
      <Stack.Screen
        name="badges"
        options={{
          ...badgeSheetOptions,
          headerShown: false,
          presentation: 'formSheet',
          title: t('badges.title'),
        }}
      />
      <Stack.Screen name="appearance" options={{ title: t('appearance.title') }} />
      <Stack.Screen name="cache" options={{ title: t('cache.title') }} />
      <Stack.Screen name="about" options={{ title: t('about.title') }} />
    </Stack>
  );
}

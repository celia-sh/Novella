import Stack from 'expo-router/stack';
import { useTranslation } from 'react-i18next';

import { useSystemScreenStackPreset } from '@/theme/stack-preset';

export default function SettingsStackLayout() {
  const { t } = useTranslation('settings');
  const isAndroid = process.env.EXPO_OS === 'android';
  const systemScreenStackPreset = useSystemScreenStackPreset();
  const badgeSheetOptions = isAndroid
    ? {
        animation: 'none' as const,
        contentStyle: { backgroundColor: 'transparent' },
      }
    : {
        sheetAllowedDetents: [0.75, 1],
        sheetGrabberVisible: true,
        sheetInitialDetentIndex: 0,
      };

  return (
    <Stack screenOptions={{ ...systemScreenStackPreset, headerShown: !isAndroid }}>
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: !isAndroid, title: t('panel.title') }}
      />
      <Stack.Screen name="profile" options={{ title: t('profile.title') }} />
      <Stack.Screen name="avatar" options={{ title: t('avatar.title') }} />
      <Stack.Screen name="reader" options={{ title: t('reader.title') }} />
      <Stack.Screen name="content" options={{ title: t('content.title') }} />
      <Stack.Screen
        name="badges"
        options={{
          ...badgeSheetOptions,
          headerShown: false,
          presentation: isAndroid ? 'transparentModal' : 'formSheet',
          title: t('badges.title'),
        }}
      />
      <Stack.Screen name="appearance" options={{ title: t('appearance.title') }} />
      <Stack.Screen name="cache" options={{ title: t('cache.title') }} />
      <Stack.Screen name="about" options={{ title: t('about.title') }} />
    </Stack>
  );
}

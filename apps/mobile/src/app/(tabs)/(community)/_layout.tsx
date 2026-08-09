import Stack from 'expo-router/stack';
import { useTranslation } from 'react-i18next';

import { useSystemScreenStackPreset } from '@/theme/stack-preset';

export default function CommunityStackLayout() {
  const isAndroid = process.env.EXPO_OS === 'android';
  const { t } = useTranslation('community');
  const systemScreenStackPreset = useSystemScreenStackPreset();

  return (
    <Stack screenOptions={systemScreenStackPreset}>
      <Stack.Screen
        name="community"
        options={{
          headerLargeTitle: !isAndroid,
          headerShown: !isAndroid,
          title: t('navigation.community'),
        }}
      />
      <Stack.Screen name="thread/[id]" options={{ headerLargeTitle: false, headerShown: !isAndroid, title: t('navigation.discussion') }} />
      <Stack.Screen
        name="thread/[id]/reply"
        options={{
          ...(isAndroid
            ? { animation: 'none', contentStyle: { backgroundColor: 'transparent' } }
            : { sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }),
          headerShown: false,
          presentation: isAndroid ? 'transparentModal' : 'formSheet',
          title: '',
        }}
      />
      <Stack.Screen name="compose" options={{ headerLargeTitle: false, headerShown: !isAndroid, title: t('navigation.newPost') }} />
      <Stack.Screen name="notifications" options={{ headerLargeTitle: false, headerShown: !isAndroid, title: t('navigation.notifications') }} />
      <Stack.Screen
        name="mine"
        options={{ headerLargeTitle: false, headerShown: !isAndroid, title: t('navigation.myCommunity') }}
      />
      <Stack.Screen
        name="community-rankings"
        options={{ headerLargeTitle: false, headerShown: !isAndroid, title: t('navigation.rankings') }}
      />
    </Stack>
  );
}

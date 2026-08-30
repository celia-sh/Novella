import Stack from 'expo-router/stack';
import { useTranslation } from 'react-i18next';

import { useSystemScreenStackPreset } from '@/theme/stack-preset';

export default function CommunityStackLayout() {
  const { t } = useTranslation('community');
  const systemScreenStackPreset = useSystemScreenStackPreset();

  return (
    <Stack screenOptions={systemScreenStackPreset}>
      <Stack.Screen
        name="community"
        options={{
          headerLargeTitle: true,
          headerShown: true,
          title: t('navigation.community'),
        }}
      />
      <Stack.Screen
        name="thread/[id]"
        options={{ headerLargeTitle: false, headerShown: true, title: '' }}
      />
      <Stack.Screen
        name="thread/[id]/edit"
        options={{ headerLargeTitle: false, headerShown: true, title: t('navigation.editPost') }}
      />
      <Stack.Screen
        name="thread/[id]/reply"
        options={{
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          headerShown: false,
          presentation: 'formSheet',
          title: '',
        }}
      />
      <Stack.Screen
        name="compose"
        options={{ headerLargeTitle: false, headerShown: true, title: t('navigation.newPost') }}
      />
      <Stack.Screen
        name="notifications"
        options={{ headerLargeTitle: false, headerShown: true, title: t('navigation.notifications') }}
      />
      <Stack.Screen
        name="mine"
        options={{ headerLargeTitle: false, headerShown: true, title: t('navigation.myCommunity') }}
      />
      <Stack.Screen
        name="community-rankings"
        options={{ headerLargeTitle: false, headerShown: true, title: t('navigation.rankings') }}
      />
    </Stack>
  );
}

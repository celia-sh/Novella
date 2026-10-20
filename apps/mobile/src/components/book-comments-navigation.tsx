import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { BookCommentsNavigationProps } from '@/components/book-comments-navigation.types';

export function BookCommentsNavigation({ onCompose, palette }: BookCommentsNavigationProps) {
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  return (
    <>
      <Stack.Screen
        options={{
          // Like the detail page: the system back item ignores
          // `headerTintColor` in the iPhone Duo vertical bar.
          headerBackVisible: false,
          headerTintColor: palette.primary,
          title: t('comments.title'),
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel={tCommon('accessibility.back')}
          icon="chevron.left"
          onPress={() => router.back()}
          tintColor={palette.primary}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t('comments.write')}
          icon="pencil"
          onPress={onCompose}
          tintColor={palette.primary}
        />
      </Stack.Toolbar>
    </>
  );
}

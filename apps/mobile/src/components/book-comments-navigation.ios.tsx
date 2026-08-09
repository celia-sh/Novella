import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { BookCommentsNavigationProps } from '@/components/book-comments-navigation.types';

export function BookCommentsNavigation({ onCompose, palette }: BookCommentsNavigationProps) {
  const { t } = useTranslation('community');
  return (
    <>
      <Stack.Screen
        options={{
          headerTintColor: palette.primary,
          title: t('comments.title'),
        }}
      />
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

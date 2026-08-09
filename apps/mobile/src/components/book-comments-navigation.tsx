import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { BookCommentsNavigationProps } from '@/components/book-comments-navigation.types';

export function BookCommentsNavigation({ onCompose }: BookCommentsNavigationProps) {
  const { t } = useTranslation('community');
  return (
    <Stack.Screen
      options={{
        headerRight: () => null,
        title: t('comments.title'),
      }}
    />
  );
}

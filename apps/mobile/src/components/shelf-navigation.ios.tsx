import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { ShelfNavigationProps } from '@/components/shelf-navigation.types';

export function ShelfNavigation({ largeTitle, onManage, title }: ShelfNavigationProps) {
  const { t } = useTranslation('library');
  return (
    <>
      <Stack.Screen options={{ headerLargeTitle: largeTitle, title }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t('shelf.manage')}
          icon="ellipsis.circle"
          onPress={onManage}
        />
      </Stack.Toolbar>
    </>
  );
}

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { HistoryNavigationProps } from '@/components/history-navigation.types';

export function HistoryNavigation({ onClear, showClear }: HistoryNavigationProps) {
  const { t } = useTranslation('library');
  return (
    <>
      <Stack.Screen options={{ title: t('history.title') }} />
      {showClear ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={t('history.clearAccessibility')}
            icon="trash"
            onPress={onClear}
          />
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

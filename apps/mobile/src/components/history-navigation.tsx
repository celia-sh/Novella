import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { HistoryNavigationProps } from '@/components/history-navigation.types';
import { useRootPageTitle } from '@/hooks/use-wide-layout';

export function HistoryNavigation({ onClear, showClear }: HistoryNavigationProps) {
  const { t } = useTranslation('library');
  const rootTitle = useRootPageTitle(t('history.title'));
  return (
    <>
      <Stack.Screen options={rootTitle} />
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

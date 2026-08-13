import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { ReaderNavigationProps } from '@/components/reader-navigation.types';

export function ReaderNavigation({
  foregroundColor,
  mode,
  onModeChange,
  onOpenChapters,
  onOpenSettings,
  title,
}: ReaderNavigationProps) {
  const { t } = useTranslation('reader');
  return (
    <>
      <Stack.Screen
        options={{
          headerTintColor: foregroundColor,
          headerTransparent: true,
          title,
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t('accessibility.chapterList')}
          icon="list.bullet"
          onPress={onOpenChapters}
          tintColor={foregroundColor}
        />
        <Stack.Toolbar.Menu
          accessibilityLabel={t('accessibility.readingMode')}
          icon="ellipsis.circle"
          tintColor={foregroundColor}
        >
          <Stack.Toolbar.MenuAction
            icon="text.justify.left"
            isOn={mode === 'scroll'}
            onPress={() => onModeChange('scroll')}
          >
            {t('modes.scroll')}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="rectangle.split.1x2"
            isOn={mode === 'paged'}
            onPress={() => onModeChange('paged')}
          >
            {t('modes.paged')}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          accessibilityLabel={t('accessibility.readerSettings')}
          icon="gearshape"
          onPress={onOpenSettings}
          tintColor={foregroundColor}
        />
      </Stack.Toolbar>
    </>
  );
}

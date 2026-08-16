import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IosTopBarBackground } from '@/components/ios-top-bar-background';
import type { ReaderNavigationProps } from '@/components/reader-navigation.types';

export function ReaderNavigation({
  blurAppearance,
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
          headerBackground: () => null,
          headerBlurEffect: 'none',
          headerShadowVisible: false,
          headerTintColor: foregroundColor,
          headerTransparent: true,
          scrollEdgeEffects: {
            bottom: 'hidden',
            left: 'hidden',
            right: 'hidden',
            top: 'hidden',
          },
          title,
        }}
      />
      <IosTopBarBackground
        {...(blurAppearance ? { blurConfig: { appearance: blurAppearance } } : {})}
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

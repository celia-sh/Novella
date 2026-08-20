import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IosTopBarBackground } from '@/components/ios-top-bar-background';
import { shouldRenderReaderEdgeBlur } from '@/services/reader-chrome-layout';
import type { ReaderNavigationProps } from '@/components/reader-navigation.types';
import { useOptimisticReaderMode } from '@/hooks/use-optimistic-reader-mode';

export function ReaderNavigation({
  forceLightAppearance,
  foregroundColor,
  mode,
  onModeChange,
  onOpenChapters,
  onOpenSettings,
  title,
}: ReaderNavigationProps) {
  const { t } = useTranslation('reader');
  const {
    displayMode,
    nextMode,
    requestModeChange,
  } = useOptimisticReaderMode(mode, onModeChange);
  return (
    <>
      <Stack.Screen
        options={{
          headerBackground: () => null,
          headerBlurEffect: 'none',
          headerShadowVisible: false,
          headerTintColor: foregroundColor,
          headerTransparent: true,
          ...(forceLightAppearance
            ? {
                unstable_nativeProps: {
                  headerConfig: { experimental_userInterfaceStyle: 'light' },
                },
              }
            : {}),
          scrollEdgeEffects: {
            bottom: 'hidden',
            left: 'hidden',
            right: 'hidden',
            top: 'hidden',
          },
          title,
        }}
      />
      {shouldRenderReaderEdgeBlur(displayMode) ? <IosTopBarBackground /> : null}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t('accessibility.chapterList')}
          icon="list.bullet"
          onPress={onOpenChapters}
          tintColor={foregroundColor}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t('accessibility.switchMode', {
            mode: t(`modes.${nextMode}`),
          })}
          icon={displayMode === 'scroll' ? 'rectangle.split.1x2' : 'text.justify.left'}
          onPress={requestModeChange}
          tintColor={foregroundColor}
        />
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

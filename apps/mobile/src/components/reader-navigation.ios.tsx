import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'react-native';

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
  chromeHidden,
  topBarBlurAppearance,
  topBarBlurContentReady = true,
  topBarBlurInPagedMode = false,
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
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTintColor: foregroundColor,
          headerShown: !chromeHidden,
          gestureEnabled: false,
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
      <StatusBar animated hidden={chromeHidden} showHideTransition="fade" />
      {shouldRenderReaderEdgeBlur(
        mode,
        topBarBlurContentReady && !chromeHidden,
        topBarBlurInPagedMode,
      ) ? (
        <IosTopBarBackground
          {...(topBarBlurAppearance
            ? { blurConfig: { appearance: topBarBlurAppearance } }
            : {})}
        />
      ) : null}
      {!chromeHidden ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={t('accessibility.chapterList')}
            hidden={chromeHidden}
            icon="list.bullet"
            onPress={onOpenChapters}
            tintColor={foregroundColor}
          />
          <Stack.Toolbar.Button
            accessibilityLabel={t('accessibility.switchMode', {
              mode: t(`modes.${nextMode}`),
            })}
            hidden={chromeHidden}
            icon={displayMode === 'scroll' ? 'rectangle.split.1x2' : 'text.justify.left'}
            onPress={requestModeChange}
            tintColor={foregroundColor}
          />
          <Stack.Toolbar.Button
            accessibilityLabel={t('accessibility.readerSettings')}
            hidden={chromeHidden}
            icon="gearshape"
            onPress={onOpenSettings}
            tintColor={foregroundColor}
          />
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

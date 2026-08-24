import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'react-native';
import type { ReaderNavigationProps } from '@/components/reader-navigation.types';
import { useOptimisticReaderMode } from '@/hooks/use-optimistic-reader-mode';

export function ReaderNavigation({
  forceLightAppearance,
  foregroundColor,
  mode,
  onModeChange,
  onOpenChapters,
  onOpenSettings,
  statusBarStyle,
  title,
  chromeHidden,
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
          headerLargeTitle: false,
          headerShadowVisible: false,
          scrollEdgeEffects: {
            bottom: 'hidden',
            left: 'hidden',
            right: 'hidden',
            top: 'soft',
          },
          headerTintColor: foregroundColor,
          headerTitleStyle: { color: foregroundColor },
          headerShown: !chromeHidden,
          gestureEnabled: false,
          ...(forceLightAppearance
            ? {
                unstable_nativeProps: {
                  headerConfig: { experimental_userInterfaceStyle: 'light' },
                },
              }
            : {}),
          title,
        }}
      />
      <StatusBar
        animated
        barStyle={statusBarStyle}
        hidden={chromeHidden}
        showHideTransition="fade"
      />
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

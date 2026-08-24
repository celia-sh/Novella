import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { ReaderNavigationProps } from '@/components/reader-navigation.types';
import { useOptimisticReaderMode } from '@/hooks/use-optimistic-reader-mode';

const hasLiquidGlass = isLiquidGlassAvailable();
const READER_NAVIGATION_ITEM_HEIGHT = 44;
const READER_NAVIGATION_MAX_TITLE_WIDTH = 180;
// Reserve the native back button, all three right toolbar buttons, and a
// conservative center gap. The outer title view must have an explicit width;
// maxWidth on a child GlassView does not constrain UINavigationItem.titleView's
// intrinsic measurement on iOS 26.
const READER_NAVIGATION_TITLE_SIDE_RESERVATION = 286;

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
          headerTitle: () => (
            <ReaderHeaderTitle
              forceLightAppearance={forceLightAppearance ?? false}
              foregroundColor={foregroundColor}
              statusBarStyle={statusBarStyle}
              title={title}
            />
          ),
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

type ReaderHeaderTitleProps = Pick<
  ReaderNavigationProps,
  'forceLightAppearance' | 'foregroundColor' | 'statusBarStyle' | 'title'
>;

function ReaderHeaderTitle({
  forceLightAppearance,
  foregroundColor,
  statusBarStyle,
  title,
}: ReaderHeaderTitleProps) {
  const { width: windowWidth } = useWindowDimensions();
  const titleWidth = Math.max(
    READER_NAVIGATION_ITEM_HEIGHT,
    Math.min(
      READER_NAVIGATION_MAX_TITLE_WIDTH,
      windowWidth - READER_NAVIGATION_TITLE_SIDE_RESERVATION,
    ),
  );
  const colorScheme = forceLightAppearance || statusBarStyle === 'dark-content'
    ? 'light'
    : 'dark';
  const fallbackBackgroundColor = statusBarStyle === 'light-content'
    ? 'rgba(255,255,255,0.16)'
    : 'rgba(0,0,0,0.08)';

  return (
    <View style={[styles.titleContainer, { width: titleWidth }]}>
      <GlassView
        colorScheme={colorScheme}
        glassEffectStyle="regular"
        style={[
          styles.titleGlass,
          !hasLiquidGlass && { backgroundColor: fallbackBackgroundColor },
        ]}
      >
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={[styles.titleText, { color: foregroundColor }]}
        >
          {title}
        </Text>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    height: READER_NAVIGATION_ITEM_HEIGHT,
    overflow: 'hidden',
  },
  titleGlass: {
    alignItems: 'center',
    borderRadius: READER_NAVIGATION_ITEM_HEIGHT / 2,
    height: READER_NAVIGATION_ITEM_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 12,
    width: '100%',
  },
  titleText: {
    alignSelf: 'stretch',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
});

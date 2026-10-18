import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { ReaderNavigationProps } from '@/components/reader-navigation.types';
import { ReaderSideProgress } from '@/components/reader-side-progress';
import { ReaderSideTitle } from '@/components/reader-side-title';
import {
  addReaderLayoutDidChangeListener,
  refreshReaderSideBar,
} from '@/services/reader-side-chrome';

const hasLiquidGlass = isLiquidGlassAvailable();
const READER_NAVIGATION_ITEM_HEIGHT = 44;
const READER_NAVIGATION_MAX_TITLE_WIDTH = 180;
// Reserve the native back button, both right toolbar buttons, and a
// conservative center gap. The outer title view must have an explicit width;
// maxWidth on a child GlassView does not constrain UINavigationItem.titleView's
// intrinsic measurement on iOS 26.
const READER_NAVIGATION_TITLE_SIDE_RESERVATION = 242;

export function ReaderNavigation({
  forceLightAppearance,
  foregroundColor,
  onOpenChapters,
  onOpenSettings,
  statusBarStyle,
  title,
  chromeHidden,
  sideChrome = false,
  sideProgress,
}: ReaderNavigationProps) {
  const { t } = useTranslation('reader');
  const { height, width } = useWindowDimensions();

  // A fold between displays keeps the same native bar button items but rebuilds
  // the vertical column around them. Re-apply the item list once the new layout
  // has settled so the title and progress are measured against the new column.
  //
  // Only real window-size changes are a fold. Safe-area insets also change when
  // the status bar hides with the reader chrome, and re-assigning the item list
  // at that moment re-inserts the custom title/progress views into the glass
  // column, which plays iOS 26's item transition (the text visibly pops).
  //
  // The dimension commit can land before UIKit has finished rebuilding the
  // column, which intermittently left the title and progress off the bar. Ask
  // again when the native transition reports its end, and once more shortly
  // after; `refreshReaderSideBar` applies the items without animation, and the
  // transition cover is still up for the first retry.
  useEffect(() => {
    if (!sideChrome) return;
    const refresh = () => {
      void refreshReaderSideBar().catch(() => undefined);
    };
    const frame = requestAnimationFrame(refresh);
    const subscription = addReaderLayoutDidChangeListener(refresh);
    const retry = setTimeout(refresh, 380);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(retry);
      subscription?.remove();
    };
  }, [height, sideChrome, width]);

  return (
    <>
      <Stack.Screen
        options={{
          headerLargeTitle: false,
          headerBackVisible: !chromeHidden,
          headerShadowVisible: false,
          scrollEdgeEffects: {
            bottom: 'hidden',
            left: 'hidden',
            right: 'hidden',
            top: 'soft',
          },
          headerTintColor: foregroundColor,
          headerTitle: sideChrome ? '' : () => (
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
          statusBarHidden: chromeHidden,
          statusBarStyle: nativeStatusBarStyle(statusBarStyle),
          title,
        }}
      />
      {/*
        The toolbar stays mounted while the chrome is hidden. The custom title
        and progress views are inserted into the glass column when they mount,
        and iOS 26 animates that insertion; mounting the toolbar with the
        chrome made the text pop every time the bar appeared. `headerShown`
        still owns visibility, and the native buttons keep their own `hidden`.
      */}
      <Stack.Toolbar placement="right">
        {sideChrome && title ? (
          <Stack.Toolbar.View hidden={chromeHidden}>
            <ReaderSideTitle
              foregroundColor={foregroundColor}
              title={title}
            />
          </Stack.Toolbar.View>
        ) : null}
        {sideChrome && sideProgress ? (
          <Stack.Toolbar.View hidden={chromeHidden}>
            <ReaderSideProgress
              foregroundColor={foregroundColor}
              {...sideProgress}
            />
          </Stack.Toolbar.View>
        ) : null}
        <Stack.Toolbar.Button
          accessibilityLabel={t('accessibility.chapterList')}
          hidden={chromeHidden}
          icon="list.bullet"
          onPress={onOpenChapters}
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
    </>
  );
}

type NativeStatusBarStyle = 'auto' | 'light' | 'dark';

/**
 * iOS 27 ignores `UIApplication`'s app-wide status bar style; the appearance
 * comes from the screen's view controller instead, and react-native-screens
 * forwards the native-stack `statusBarStyle` option to it.
 */
function nativeStatusBarStyle(
  style: ReaderNavigationProps['statusBarStyle'],
): NativeStatusBarStyle {
  if (style === 'light-content') return 'light';
  if (style === 'dark-content') return 'dark';
  return 'auto';
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

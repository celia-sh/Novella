import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { ReaderNavigationProps } from '@/components/reader-navigation.types';
import { ReaderSideProgress } from '@/components/reader-side-progress';
import { ReaderSideTitle } from '@/components/reader-side-title';
import {
  addReaderLayoutDidChangeListener,
  refreshReaderSideBar,
  setReaderBarInterfaceStyle,
} from '@/services/reader-side-chrome';

const hasLiquidGlass = isLiquidGlassAvailable();
const READER_NAVIGATION_ITEM_HEIGHT = 44;
const READER_NAVIGATION_MAX_TITLE_WIDTH = 180;
// Reserve the native back button, both right toolbar buttons, and a
// conservative center gap. The outer title view must have an explicit width;
// maxWidth on a child GlassView does not constrain UINavigationItem.titleView's
// intrinsic measurement on iOS 26.
const READER_NAVIGATION_TITLE_SIDE_RESERVATION = 242;
// Long enough for UIKit's navigation bar hide animation to finish.
const STATUS_BAR_HIDE_DELAY_MS = 250;

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
  const { t: tCommon } = useTranslation('common');
  const { height, width } = useWindowDimensions();
  const barScheme = readerBarColorScheme(forceLightAppearance, statusBarStyle);

  // On the Duo's inner display the status bar shares the navigation bar's
  // row, and the bar keeps its items clear of it. Hiding both together moved
  // the right buttons and the title sideways while the bar slid up, so the bar
  // left diagonally. Hide the status bar once the bar is gone; show it with the
  // bar, so the bar comes back at its final width.
  const [statusBarHideSettled, setStatusBarHideSettled] = useState(chromeHidden);
  useEffect(() => {
    if (!chromeHidden) {
      setStatusBarHideSettled(false);
      return;
    }
    const timer = setTimeout(() => setStatusBarHideSettled(true), STATUS_BAR_HIDE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [chromeHidden]);

  // Give the reader's glass the scheme of its background, not the app's: a
  // light page in dark mode (or the reverse) otherwise gets glass of the wrong
  // brightness. The floating bar container is rebuilt by folds and chrome
  // toggles, so re-apply after those too. It is shared with the screens below,
  // so leaving the reader resets it.
  useFocusEffect(useCallback(() => {
    const apply = () => {
      void setReaderBarInterfaceStyle(barScheme).catch(() => undefined);
    };
    apply();
    const frame = requestAnimationFrame(apply);
    const subscription = addReaderLayoutDidChangeListener(apply);
    return () => {
      cancelAnimationFrame(frame);
      subscription?.remove();
    };
  }, [barScheme, chromeHidden, height, width]));
  useEffect(() => () => {
    void setReaderBarInterfaceStyle('unspecified').catch(() => undefined);
  }, []);

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
          // The system back item ignores `headerTintColor` in the vertical
          // bar, so it stayed in the app scheme's label color over a reader
          // background of the opposite brightness. The toolbar chevron below
          // carries the reader color everywhere.
          headerBackVisible: false,
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
          unstable_nativeProps: {
            headerConfig: { experimental_userInterfaceStyle: barScheme },
          },
          statusBarHidden: chromeHidden && statusBarHideSettled,
          statusBarStyle: nativeStatusBarStyle(statusBarStyle),
          title,
          // Outside the Duo the buttons are header items rather than a
          // `Stack.Toolbar`, so they stay on the bar while it slides out. See
          // the toolbar below for why it cannot hide with the chrome.
          ...(sideChrome
            ? {}
            : {
                unstable_headerLeftItems: () => [{
                  accessibilityLabel: tCommon('accessibility.back'),
                  icon: { name: 'chevron.left', type: 'sfSymbol' },
                  label: '',
                  onPress: () => router.back(),
                  tintColor: foregroundColor,
                  type: 'button',
                }],
                unstable_headerRightItems: () => [
                  {
                    accessibilityLabel: t('accessibility.chapterList'),
                    icon: { name: 'list.bullet', type: 'sfSymbol' },
                    label: '',
                    onPress: onOpenChapters,
                    tintColor: foregroundColor,
                    type: 'button',
                  },
                  {
                    accessibilityLabel: t('accessibility.readerSettings'),
                    icon: { name: 'gearshape', type: 'sfSymbol' },
                    label: '',
                    onPress: onOpenSettings,
                    tintColor: foregroundColor,
                    type: 'button',
                  },
                ],
              }),
        }}
      />
      {/*
        Only the Duo's vertical bar uses the toolbar: its custom title and
        progress views need `Stack.Toolbar.View`, and they are inserted into the
        glass column when they mount, which iOS 26 animates, so the toolbar
        stays mounted there. A left or right `Stack.Toolbar` sets
        `headerShown: true` on the screen and overrides `headerShown:
        !chromeHidden` above, so it cannot be used where the bar hides.
        Unmounting it with the chrome instead removed the buttons while the bar
        was still sliding out.
      */}
      {sideChrome ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              accessibilityLabel={tCommon('accessibility.back')}
              hidden={chromeHidden}
              icon="chevron.left"
              onPress={() => router.back()}
              tintColor={foregroundColor}
            />
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            {title ? (
              <Stack.Toolbar.View hidden={chromeHidden}>
                <ReaderSideTitle
                  foregroundColor={foregroundColor}
                  title={title}
                />
              </Stack.Toolbar.View>
            ) : null}
            {sideProgress ? (
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
      ) : null}
    </>
  );
}

type NativeStatusBarStyle = 'auto' | 'light' | 'dark';

/** Light text means a dark reader background, so the bars use dark glass. */
function readerBarColorScheme(
  forceLightAppearance: boolean | undefined,
  statusBarStyle: ReaderNavigationProps['statusBarStyle'],
): 'dark' | 'light' {
  if (forceLightAppearance) return 'light';
  return statusBarStyle === 'light-content' ? 'dark' : 'light';
}

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
  // The native bars take the same scheme through the header config and the
  // floating bar override, so the pill matches the buttons beside it.
  const colorScheme = readerBarColorScheme(forceLightAppearance, statusBarStyle);
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

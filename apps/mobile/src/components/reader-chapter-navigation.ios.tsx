import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { ReaderChapterNavigationProps } from '@/components/reader-navigation.types';
import { createThemedStyles } from '@/theme/app-theme';

export function ReaderChapterNavigation({
  bottomInset,
  current,
  onNext,
  onPrevious,
  total,
}: ReaderChapterNavigationProps) {
  const { t } = useTranslation('reader');
  const styles = useReaderChapterNavigationStyles();
  return (
    <>
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Button
          accessibilityLabel={t('accessibility.previousChapter')}
          disabled={onPrevious === null}
          icon="chevron.left"
          {...(onPrevious ? { onPress: onPrevious } : {})}
        />
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          accessibilityLabel={t('accessibility.nextChapter')}
          disabled={onNext === null}
          icon="chevron.right"
          {...(onNext ? { onPress: onNext } : {})}
        />
      </Stack.Toolbar>
      {/* The page counter is drawn by the screen layer instead of the native
          toolbar so it stays exactly centered no matter the toolbar item
          widths or disabled states. */}
      <View
        pointerEvents="none"
        style={[styles.pageCounter, { bottom: bottomInset }]}
      >
        <Text style={styles.pageCounterText}>
          {total > 0 ? `${current} / ${total}` : ''}
        </Text>
      </View>
    </>
  );
}

const useReaderChapterNavigationStyles = createThemedStyles((colors) => ({
  pageCounter: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  pageCounterText: {
    color: colors.secondaryLabel,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
}));

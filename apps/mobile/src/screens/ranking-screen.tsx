import { router, Stack } from 'expo-router';
import { IconTrophy } from '@tabler/icons-react-native';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { BookListItem } from '@novella/api-client';
import type { RankPeriod } from '@novella/client-core';

import { BookCoverGridItem } from '@/components/book-cover-grid-item';
import {
  BookCoverSkeletonTile,
  bookGridLoadingMoreKeys,
  bookGridSkeletonCount,
  skeletonKeys,
} from '@/components/book-grid-skeleton';
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import { NativeSegmentedControl } from '@/components/native-segmented-control';
import { useBookGridLayout } from '@/hooks/use-book-grid-layout';
import type { LibraryMessage } from '@/localization/locales/library';
import { useRankingPage } from '@/hooks/use-ranking';
import { useAppSettings } from '@/services/settings';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export function RankingScreen() {
  const { t } = useTranslation('library');
  const settings = useAppSettings();
  const styles = useRankingScreenStyles();
  const { colors } = useAppTheme();
  const {
    books,
    changePeriod,
    error,
    period,
    refresh,
    retry,
    status,
  } = useRankingPage(settings.homeRankType);
  const { columns, contentWidth, height, listKey, tileWidth } = useBookGridLayout(20);
  const skeletonCount =
    status === 'loading' && books.length === 0
      ? bookGridSkeletonCount({ columns, headerOffset: 110, height, tileWidth })
      : 0;
  const data: (number | BookListItem)[] =
    skeletonCount > 0 ? skeletonKeys(skeletonCount) : books;
  const periodOptions: readonly { label: string; value: RankPeriod }[] = [
    { label: t('ranking.periods.daily'), value: 'daily' },
    { label: t('ranking.periods.weekly'), value: 'weekly' },
    { label: t('ranking.periods.monthly'), value: 'monthly' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: t('ranking.title') }} />
      <NativeScreenScaffold
      largeTitle={false}
      onBackPress={() => router.back()}
      showBackButton
      title={t('ranking.title')}
    >
      <View style={styles.root}>
        <FlatList
          ListEmptyComponent={
            error ? (
              <ErrorState error={error} onRetry={retry} />
            ) : (
              <EmptyState />
            )
          }
          ListHeaderComponent={
            <View style={styles.periodBar}>
              <NativeSegmentedControl
                onValueChange={changePeriod}
                options={periodOptions}
                selectedValue={period}
              />
            </View>
          }
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          data={data}
          key={listKey}
          keyExtractor={(item) =>
            typeof item === 'number'
              ? `skeleton-${item}`
              : `${item.type ?? 'Novel'}-${item.id}`
          }
          nestedScrollEnabled
          numColumns={columns}
          refreshControl={
            <RefreshControl
              colors={[colors.accent as string]}
              onRefresh={refresh}
              refreshing={status === 'refreshing'}
              tintColor={colors.accent as string}
            />
          }
          renderItem={({ item, index }) =>
            typeof item === 'number' ? (
              <BookCoverSkeletonTile tileWidth={tileWidth} />
            ) : (
              <BookCoverGridItem
                book={item}
                onPress={() => router.push({
                  pathname: '/book/[id]',
                  params: {
                    cover: item.coverUrl,
                    id: String(item.id),
                    placeholder: item.coverPlaceholder ?? '',
                    title: item.title,
                    type: item.type ?? 'Novel',
                  },
                })}
                rank={index + 1}
                tileWidth={tileWidth}
              />
            )
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
      </NativeScreenScaffold>
    </>
  );
}

function EmptyState() {
  const { t } = useTranslation('library');
  const styles = useRankingScreenStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.emptyState}>
      <IconTrophy color={colors.secondaryLabel as string} size={44} strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>{t('ranking.noRankings')}</Text>
      <Text style={styles.emptyDescription}>
        {t('ranking.noRankingsDescription')}
      </Text>
    </View>
  );
}

function ErrorState({ error, onRetry }: { error: LibraryMessage; onRetry(): void }) {
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation('common');
  const styles = useRankingScreenStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.errorBlock}>
      <Text selectable style={styles.errorText}>
        {error.kind === 'raw' ? error.text : t(error.key)}
      </Text>
      <Pressable
        accessibilityLabel={tCommon('accessibility.retry')}
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
      >
        <Text style={styles.retryLabel}>{tCommon('actions.retry')}</Text>
      </Pressable>
    </View>
  );
}

const useRankingScreenStyles = createThemedStyles((colors) => ({
  content: {
    gap: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  emptyDescription: {
    color: colors.secondaryLabel,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingTop: 72,
  },
  emptyTitle: {
    color: colors.label,
    fontSize: 17,
    fontWeight: '700',
  },
  errorBlock: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  errorText: {
    color: colors.secondaryLabel,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  periodBar: {
    paddingTop: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  retryButton: {
    alignItems: 'center',
    borderColor: colors.separator,
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryLabel: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  row: {
    gap: 10,
  },
}));

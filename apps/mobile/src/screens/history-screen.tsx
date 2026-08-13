import { router } from 'expo-router';
import { IconHistory, IconRefreshOff } from '@tabler/icons-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { showAlert } from '@/components/native-alert-dialog';

import type { BookListItem, ComicSeriesListItem } from '@novella/api-client';
import { comicToBookListItem } from '@novella/api-client';

import { BookCoverGridItem } from '@/components/book-cover-grid-item';
import {
  BookCoverSkeletonTile,
  bookGridLoadingMoreKeys,
  bookGridSkeletonCount,
  skeletonKeys,
} from '@/components/book-grid-skeleton';
import { HistoryNavigation } from '@/components/history-navigation';
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import { NativeStackScrollEdgeMarker } from '@/components/native-stack-scroll-edge-marker';
import { NativeSegmentedControl } from '@/components/native-segmented-control';
import { useBookGridLayout } from '@/hooks/use-book-grid-layout';
import { useFlatListCoverActivation } from '@/hooks/use-cover-activation';
import type { LibraryMessage } from '@/localization/locales/library';
import { type HistoryTab, useReadHistory } from '@/hooks/use-read-history';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export function HistoryScreen() {
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation('common');
  const styles = useHistoryScreenStyles();
  const { colors } = useAppTheme();
  const { clear, loadMore, refresh, retry, state } = useReadHistory();
  const [tab, setTab] = useState<HistoryTab>('Novel');
  const { columns, height, listKey, tileWidth } = useBookGridLayout(16);
  const activeTabState = tab === 'Novel' ? state.novel : state.comic;
  const hasAnyHistory =
    (state.ids?.novelIds.length ?? 0) > 0 || (state.ids?.comicIds.length ?? 0) > 0;
  const tabOptions = [
    { label: t('history.novelsTab'), value: 'Novel' },
    { label: t('history.comicsTab'), value: 'Comic' },
  ] as const;

  const confirmClearHistory = useCallback(() => {
    if (state.clearing) return;
    showAlert(
      t('history.clearTitle'),
      t('history.clearDescription'),
      [
        { style: 'cancel', text: tCommon('actions.cancel') },
        {
          onPress: () => void performClear(),
          style: 'destructive',
          text: tCommon('actions.clear'),
        },
      ],
    );
  }, [state.clearing, t, tCommon]);

  const performClear = useCallback(async () => {
    const cleared = await clear();
    if (!cleared) {
      showAlert(
        t('history.clearFailedTitle'),
        t('history.clearFailedDescription'),
      );
    }
  }, [clear, t]);

  const openBook = useCallback((item: BookListItem) => {
    router.push({
      pathname: '/book/[id]',
      params: {
        cover: item.coverUrl,
        id: String(item.id),
        placeholder: item.coverPlaceholder ?? '',
        title: item.title,
        type: 'Novel',
      },
    });
  }, []);

  const openComic = useCallback((item: ComicSeriesListItem) => {
    router.push({
      pathname: '/book/[id]',
      params: {
        cover: item.coverUrl,
        id: String(item.id),
        placeholder: item.coverPlaceholder ?? '',
        title: item.title,
        type: 'Comic',
      },
    });
  }, []);

  const skeletonCount =
    (state.initialLoading || activeTabState.status === 'loading') &&
    activeTabState.items.length === 0
      ? bookGridSkeletonCount({ columns, headerOffset: 150, height, tileWidth })
      : 0;
  const loadingMoreKeys =
    activeTabState.status === 'loadingMore'
      ? bookGridLoadingMoreKeys(activeTabState.items.length, columns)
      : [];
  const data: (number | BookListItem | ComicSeriesListItem)[] = [
    ...(skeletonCount > 0 ? skeletonKeys(skeletonCount) : activeTabState.items),
    ...loadingMoreKeys,
  ];
  const coverActivation = useFlatListCoverActivation({
    columns,
    items: data,
    keyForItem: (item) => typeof item === 'number' ? null : historyCoverKey(item, tab),
    scopeKey: `${tab}:${listKey}`,
  });

  return (
    <>
      <NativeScreenScaffold
        {...(hasAnyHistory
          ? {
              actions: [
                {
                  accessibilityLabel: t('history.clearAccessibility'),
                  icon: 'trash',
                  id: 'clear-history',
                },
              ],
              onActionPress: (actionId: string) => {
                if (actionId === 'clear-history') confirmClearHistory();
              },
            }
          : {})}
        title={t('history.title')}
      >
        <View style={styles.root}>
          <NativeStackScrollEdgeMarker>
          <FlatList
            ListEmptyComponent={
              state.initialError !== null ? (
                <InitialErrorState error={state.initialError} onRetry={() => retry(tab)} />
              ) : activeTabState.status === 'error' ? (
                <TabErrorState
                  error={activeTabState.error ?? { kind: 'key', key: 'errors.unexpected' }}
                  onRetry={() => retry(tab)}
                />
              ) : (
                <EmptyState tab={tab} />
              )
            }
            // The segmented control rides inside the list (like the ranking
            // page) so it stays clear of the large-title header / status bar
            // and scrolls with the content instead of being pinned to the top.
            ListHeaderComponent={
              <View style={styles.tabs}>
                <NativeSegmentedControl
                  enabled={!state.clearing}
                  onValueChange={(nextTab) => setTab(nextTab as HistoryTab)}
                  options={tabOptions}
                  selectedValue={tab}
                />
              </View>
            }
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            data={data}
            extraData={coverActivation.activatedKeys}
            key={listKey}
            keyExtractor={(item) => historyItemKey(item, tab)}
            numColumns={columns}
            // Inside the Android Compose top-bar host the list must
            // participate in the nested scrolling coordinator.
            nestedScrollEnabled={process.env.EXPO_OS === 'android'}
            onEndReached={() => loadMore(tab)}
            onEndReachedThreshold={0.6}
            onViewableItemsChanged={coverActivation.onViewableItemsChanged}
            refreshControl={
              <RefreshControl
                colors={[colors.accent as string]}
                onRefresh={refresh}
                refreshing={state.refreshing}
                tintColor={colors.accent as string}
              />
            }
            renderItem={({ item }) => {
              if (typeof item === 'number') {
                return <BookCoverSkeletonTile tileWidth={tileWidth} />;
              }
              return tab === 'Novel' ? (
                <BookCoverGridItem
                  book={item as BookListItem}
                  networkImageEnabled={coverActivation.activatedKeys.has(historyCoverKey(item, tab))}
                  onPress={() => openBook(item as BookListItem)}
                  tileWidth={tileWidth}
                />
              ) : (
                <BookCoverGridItem
                  book={comicToBookListItem(item as ComicSeriesListItem)}
                  networkImageEnabled={coverActivation.activatedKeys.has(historyCoverKey(item, tab))}
                  onPress={() => openComic(item as ComicSeriesListItem)}
                  tileWidth={tileWidth}
                />
              );
            }}
            showsVerticalScrollIndicator={false}
            viewabilityConfig={coverActivation.viewabilityConfig}
          />
          </NativeStackScrollEdgeMarker>
        </View>
      </NativeScreenScaffold>
      <HistoryNavigation onClear={confirmClearHistory} showClear={hasAnyHistory} />
    </>
  );
}

function historyCoverKey(
  item: BookListItem | ComicSeriesListItem,
  tab: HistoryTab,
): string {
  return `${tab}-${item.id}`;
}

function historyItemKey(
  item: number | BookListItem | ComicSeriesListItem,
  tab: HistoryTab,
): string {
  return typeof item === 'number' ? `skeleton-${item}` : historyCoverKey(item, tab);
}

function EmptyState({ tab }: { tab: HistoryTab }) {
  const { t } = useTranslation('library');
  const styles = useHistoryScreenStyles();
  const { colors } = useAppTheme();
  const isNovel = tab === 'Novel';
  return (
    <View style={styles.stateBlock}>
      <IconHistory color={colors.secondaryLabel as string} size={44} strokeWidth={1.5} />
      <Text style={styles.stateTitle}>{t('history.emptyTitle')}</Text>
      <Text style={styles.stateDescription}>
        {isNovel ? t('history.emptyNovels') : t('history.emptyComics')}
      </Text>
    </View>
  );
}

function InitialErrorState({ error, onRetry }: { error: LibraryMessage; onRetry(): void }) {
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation('common');
  const styles = useHistoryScreenStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.stateBlock}>
      <IconRefreshOff color={colors.secondaryLabel as string} size={44} strokeWidth={1.5} />
      <Text style={styles.stateTitle}>{t('history.loadFailed')}</Text>
      <Text selectable style={styles.stateDescription}>
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

function TabErrorState({ error, onRetry }: { error: LibraryMessage; onRetry(): void }) {
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation('common');
  const styles = useHistoryScreenStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.stateBlock}>
      <IconRefreshOff color={colors.secondaryLabel as string} size={44} strokeWidth={1.5} />
      <Text style={styles.stateTitle}>{t('history.tabLoadFailed')}</Text>
      <Text selectable style={styles.stateDescription}>
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

const useHistoryScreenStyles = createThemedStyles((colors) => ({
  content: {
    gap: 12,
    paddingBottom: 40,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pressed: { opacity: 0.72 },
  retryButton: {
    alignItems: 'center',
    borderColor: colors.separator,
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  root: { flex: 1 },
  row: { gap: 12 },
  stateBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 96,
  },
  stateDescription: {
    color: colors.secondaryLabel,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  stateTitle: {
    color: colors.label,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 16,
  },
  tabs: { paddingBottom: 4 },
}));

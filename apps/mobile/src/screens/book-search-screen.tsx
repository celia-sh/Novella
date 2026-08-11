import { router } from 'expo-router';
import { IconSearch, IconTrash } from '@tabler/icons-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  BookListItem,
  BookSearchMode,
  ComicSeriesListItem,
} from '@novella/api-client';
import { comicToBookListItem } from '@novella/api-client';

import { BookCoverGridItem } from '@/components/book-cover-grid-item';
import {
  BookCoverSkeletonTile,
  bookGridLoadingMoreKeys,
  bookGridSkeletonCount,
  skeletonKeys,
} from '@/components/book-grid-skeleton';
import { useBookGridLayout } from '@/hooks/use-book-grid-layout';
import { useFlatListCoverActivation } from '@/hooks/use-cover-activation';
import type { LibraryMessage } from '@/localization/locales/library';
import {
  NativeSearchControls,
} from '@/components/native-search-controls';
import { BOOK_SEARCH_MODE_OPTIONS } from '@/components/native-search-controls.types';
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import { useBookSearch, type BookSearchFormat } from '@/hooks/use-book-search';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

type SearchResult =
  | { key: string; kind: 'Novel'; item: BookListItem }
  | { key: string; kind: 'Comic'; item: ComicSeriesListItem };

export interface BookSearchScreenProps {
  initialFormat?: BookSearchFormat;
  initialMode?: BookSearchMode;
  initialQuery?: string;
  showBackButton?: boolean;
}

export function BookSearchScreen({
  initialFormat = 'Novel',
  initialMode = 'fuzzy',
  initialQuery = '',
  showBackButton = false,
}: BookSearchScreenProps) {
  const { t } = useTranslation('library');
  const styles = useBookSearchScreenStyles();
  const { colors } = useAppTheme();
  const search = useBookSearch();
  const [query, setQuery] = useState(initialQuery);
  const submittedInitial = useRef(false);
  const initialQueryValue = initialQuery.trim();
  // A routed query exists before the hook's first effect can commit it. Keep
  // the first frame in loading state instead of rendering a false empty page.
  const initialSearchPending =
    initialQueryValue !== '' && search.status === 'idle' && search.committedQuery === '';
  const visibleStatus = initialSearchPending ? 'loading' : search.status;
  const { columns, contentWidth, height, listKey, tileWidth } = useBookGridLayout(16);
  const results = useMemo<SearchResult[]>(() => search.format === 'Novel'
    ? search.novels.map((item) => ({ key: `Novel:${item.id}`, kind: 'Novel', item }))
    : search.comics.map((item) => ({ key: `Comic:${item.title}`, kind: 'Comic', item })),
  [search.comics, search.format, search.novels]);
  const skeletonCount =
    visibleStatus === 'loading' && results.length === 0
      ? bookGridSkeletonCount({ columns, headerOffset: 200, height, tileWidth })
      : 0;
  const loadingMoreKeys =
    visibleStatus === 'loadingMore'
      ? bookGridLoadingMoreKeys(results.length, columns)
      : [];
  const data: (number | SearchResult)[] = [
    ...(skeletonCount > 0 ? skeletonKeys(skeletonCount) : results),
    ...loadingMoreKeys,
  ];
  const coverActivation = useFlatListCoverActivation({
    columns,
    items: data,
    keyForItem: (item) => typeof item === 'number' ? null : item.key,
    scopeKey: `${search.committedQuery}:${search.format}:${search.mode}:${listKey}`,
  });

  useEffect(() => {
    if (submittedInitial.current) return;
    submittedInitial.current = true;
    if (initialFormat !== search.format) search.changeFormat(initialFormat);
    if (initialMode !== search.mode) search.changeMode(initialMode);
    if (initialQueryValue) {
      void search.submit(initialQueryValue, { format: initialFormat, mode: initialMode });
    }
  }, [initialFormat, initialMode, initialQuery, search]);

  return (
    <NativeScreenScaffold
      actions={[
        {
          accessibilityLabel: t('search.modeAccessibility'),
          icon: 'adjustmentsHorizontal',
          id: 'search-mode',
          menuItems: BOOK_SEARCH_MODE_OPTIONS.map((option) => ({
            icon: option.androidIcon,
            id: `search-mode:${option.value}`,
            label: t(option.labelKey),
            selected: search.mode === option.value,
          })),
        },
      ]}
      largeTitle
      {...(showBackButton ? { onBackPress: () => router.back() } : {})}
      onActionPress={(id) => {
        if (!id.startsWith('search-mode:')) return;
        const mode = id.slice('search-mode:'.length) as BookSearchMode;
        if (BOOK_SEARCH_MODE_OPTIONS.some((option) => option.value === mode)) {
          search.changeMode(mode);
        }
      }}
      showBackButton={showBackButton}
      title={t('search.title')}
    >
      <FlatList
        ListEmptyComponent={
          <SearchEmpty
            committedQuery={
              search.committedQuery || (initialSearchPending ? initialQueryValue : '')
            }
            error={search.error}
            hasHistory={search.history.length > 0}
            onRetry={search.retry}
            status={visibleStatus}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <NativeSearchControls
              format={search.format}
              mode={search.mode}
              onFormatChange={search.changeFormat}
              onModeChange={search.changeMode}
              onQueryChange={setQuery}
              onSubmit={(value) => {
                setQuery(value);
                Keyboard.dismiss();
                void search.submit(value);
              }}
              query={query}
            />
            {visibleStatus === 'idle' && search.history.length > 0 ? (
              <View style={styles.historySection}>
                <View style={styles.historyHeader}>
                  <Text style={styles.sectionTitle}>{t('search.recent')}</Text>
                  <Pressable accessibilityLabel={t('search.clearHistory')} onPress={() => void search.clearHistory()}>
                    <IconTrash color={colors.secondaryLabel as string} size={18} />
                  </Pressable>
                </View>
                <View style={styles.historyWrap}>
                  {search.history.map((item) => (
                    <Pressable
                      accessibilityLabel={t('search.searchFor', { query: item })}
                      accessibilityRole="button"
                      key={item}
                      onLongPress={() => void search.removeHistory(item)}
                      onPress={() => {
                        setQuery(item);
                        void search.submit(item);
                      }}
                      style={styles.historyChip}
                    >
                      <Text numberOfLines={1} style={styles.historyLabel}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            {search.committedQuery && search.status !== 'loading' ? (
              <Text style={styles.resultSummary}>
                {t('search.resultSummary', {
                  format: search.format === 'Novel' ? t('formats.novels') : t('formats.comics'),
                  page: Math.max(1, search.page),
                  totalPages: Math.max(1, search.totalPages),
                })}
              </Text>
            ) : null}
          </View>
        }
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={data}
        extraData={coverActivation.activatedKeys}
        key={listKey}
        keyExtractor={searchItemKey}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        numColumns={columns}
        onEndReached={search.loadMore}
        onEndReachedThreshold={0.6}
        onViewableItemsChanged={coverActivation.onViewableItemsChanged}
        renderItem={({ item }) => typeof item === 'number' ? (
          <BookCoverSkeletonTile tileWidth={tileWidth} />
        ) : item.kind === 'Novel' ? (
          <BookCoverGridItem
            book={item.item}
            networkImageEnabled={coverActivation.activatedKeys.has(item.key)}
            onPress={() => router.push({
              pathname: '/book/[id]',
              params: {
                cover: item.item.coverUrl,
                id: String(item.item.id),
                placeholder: item.item.coverPlaceholder ?? '',
                title: item.item.title,
                type: 'Novel',
              },
            })}
            tileWidth={tileWidth}
          />
        ) : (
          <BookCoverGridItem
            book={comicToBookListItem(item.item)}
            networkImageEnabled={coverActivation.activatedKeys.has(item.key)}
            onPress={() => router.push({
              pathname: '/book/[id]',
              params: {
                cover: item.item.coverUrl,
                id: String(item.item.id),
                placeholder: item.item.coverPlaceholder ?? '',
                title: item.item.title,
                type: 'Comic',
              },
            })}
            tileWidth={tileWidth}
          />
        )}
        showsVerticalScrollIndicator={false}
        viewabilityConfig={coverActivation.viewabilityConfig}
      />
    </NativeScreenScaffold>
  );
}

function searchItemKey(item: number | SearchResult): string {
  return typeof item === 'number' ? `skeleton-${item}` : item.key;
}

function SearchEmpty({
  committedQuery,
  error,
  hasHistory,
  onRetry,
  status,
}: {
  committedQuery: string;
  error: LibraryMessage | null;
  hasHistory: boolean;
  onRetry(): void;
  status: string;
}) {
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation('common');
  const styles = useBookSearchScreenStyles();
  const { colors } = useAppTheme();
  if (status === 'loading' || status === 'loadingMore') return null;
  if (status === 'error') {
    return (
      <View style={styles.empty}>
        <Text selectable style={styles.emptyTitle}>{t('search.failed')}</Text>
        <Text selectable style={styles.emptyText}>
          {error?.kind === 'raw' ? error.text : error ? t(error.key) : null}
        </Text>
        <Pressable
          accessibilityLabel={tCommon('accessibility.retry')}
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retryButton}
        >
          <Text style={styles.retryLabel}>{tCommon('actions.retry')}</Text>
        </Pressable>
      </View>
    );
  }
  if (committedQuery) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{t('search.noResults')}</Text>
        <Text style={styles.emptyText}>{t('search.noResultsDescription')}</Text>
      </View>
    );
  }
  if (hasHistory) return null;
  return (
    <View style={styles.empty}>
      <IconSearch color={colors.secondaryLabel as string} size={34} strokeWidth={1.7} />
      <Text style={styles.emptyTitle}>{t('search.emptyTitle')}</Text>
      <Text style={styles.emptyText}>{t('search.emptyDescription')}</Text>
    </View>
  );
}

const useBookSearchScreenStyles = createThemedStyles((colors) => ({
  content: { gap: 14, paddingBottom: 100, paddingHorizontal: 16 },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 56 },
  emptyText: { color: colors.secondaryLabel, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyTitle: { color: colors.label, fontSize: 17, fontWeight: '700' },
  header: { gap: 14, paddingTop: 8 },
  historyChip: { backgroundColor: colors.card, borderCurve: 'continuous', borderRadius: 10, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 8 },
  historyHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  historyLabel: { color: colors.label, fontSize: 14 },
  historySection: { gap: 10 },
  historyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultSummary: { color: colors.secondaryLabel, fontSize: 13, fontVariant: ['tabular-nums'] },
  retryButton: { backgroundColor: colors.accent, borderCurve: 'continuous', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryLabel: { color: colors.onPrimaryContainer, fontWeight: '700' },
  row: { gap: 10 },
  sectionTitle: { color: colors.label, fontSize: 16, fontWeight: '700' },
}));

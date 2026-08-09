import { router, Stack } from 'expo-router';
import { IconPhotoOff } from '@tabler/icons-react-native';
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

import type { BookListItem, ComicOrder } from '@novella/api-client';

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
import { useComicListPage } from '@/hooks/use-comic-list';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export function ComicListScreen() {
  const { t } = useTranslation('library');
  const styles = useComicListScreenStyles();
  const { colors } = useAppTheme();
  const {
    books,
    changeOrder,
    error,
    loadMore,
    order,
    refresh,
    retry,
    status,
  } = useComicListPage('latest');
  const { columns, contentWidth, height, listKey, tileWidth } = useBookGridLayout(20);
  const skeletonCount =
    status === 'loading' && books.length === 0
      ? bookGridSkeletonCount({ columns, headerOffset: 110, height, tileWidth })
      : 0;
  const loadingMoreKeys =
    status === 'loadingMore'
      ? bookGridLoadingMoreKeys(books.length, columns)
      : [];
  const data: (number | BookListItem)[] = [
    ...(skeletonCount > 0 ? skeletonKeys(skeletonCount) : books),
    ...loadingMoreKeys,
  ];
  const orderOptions: readonly { label: string; value: ComicOrder }[] = [
    { label: t('catalog.orders.latest'), value: 'latest' },
    { label: t('catalog.orders.new'), value: 'new' },
    { label: t('catalog.orders.views'), value: 'view' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: t('catalog.allComics') }} />
      <NativeScreenScaffold
      largeTitle={false}
      onBackPress={() => router.back()}
      showBackButton
      title={t('catalog.allComics')}
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
            <View style={styles.orderBar}>
              <NativeSegmentedControl
                onValueChange={changeOrder}
                options={orderOptions}
                selectedValue={order}
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              colors={[colors.accent as string]}
              onRefresh={refresh}
              refreshing={status === 'refreshing'}
              tintColor={colors.accent as string}
            />
          }
          renderItem={({ item }) =>
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
                    type: item.type ?? 'Comic',
                  },
                })}
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
  const styles = useComicListScreenStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.emptyState}>
      <IconPhotoOff color={colors.secondaryLabel as string} size={44} strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>{t('catalog.noComics')}</Text>
      <Text style={styles.emptyDescription}>
        {t('catalog.noComicsDescription')}
      </Text>
    </View>
  );
}

function ErrorState({ error, onRetry }: { error: LibraryMessage; onRetry(): void }) {
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation('common');
  const styles = useComicListScreenStyles();
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

const useComicListScreenStyles = createThemedStyles((colors) => ({
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
  orderBar: {
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
}));

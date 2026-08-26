import { Stack, router, useLocalSearchParams } from 'expo-router';
import { IconListDetails } from '@tabler/icons-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ApiError, type BookDetail, type ComicInfo } from '@novella/api-client';

import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import { ReaderChapterList, type ReaderChapterListItem } from '@/components/reader-chapter-list';
import { bookDetails, reader } from '@/services/client';
import {
  publishReaderChapterSelection,
  type ReaderChapterKind,
} from '@/services/reader-chapter-selection';

type ChapterSheetMessage =
  | { kind: 'key'; key: 'errors.chaptersAuth' | 'errors.chaptersLoad' | 'errors.chaptersNetwork' }
  | { kind: 'raw'; text: string };

export function ReaderChapterSheetScreen() {
  const { t } = useTranslation('reader');
  const {
    bookId: rawBookId,
    readerKey = '',
    sortNum: rawSortNum,
    type: rawType,
  } = useLocalSearchParams<{
    bookId: string;
    readerKey?: string;
    sortNum?: string;
    type?: string;
  }>();
  const bookId = Number(rawBookId);
  const kind: ReaderChapterKind = rawType === 'Comic' ? 'Comic' : 'Novel';
  const currentSortNum = Number(rawSortNum);
  const palette = useBookDetailRouteTheme(bookId, null, null, true).palette;
  const [source, setSource] = useState<BookDetail | ComicInfo | null>(null);
  const [error, setError] = useState<ChapterSheetMessage | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSource(kind === 'Comic' ? await reader.loadComicInfo(bookId) : await bookDetails.load(bookId));
    } catch (cause) {
      setError(getChapterSheetMessage(cause));
    }
  }, [bookId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<ReaderChapterListItem[]>(() => {
    if (!source) return [];
    if (kind === 'Comic') {
      const info = source as ComicInfo;
      return info.chapters.map((chapter) => ({
        id: chapter.id,
        isCurrent: chapter.sortNum === currentSortNum,
        sortNum: chapter.sortNum,
        subtitle: t('chapters.pageCount', { count: chapter.pageCount }),
        title: chapter.title,
      }));
    }
    const book = source as BookDetail;
    return book.chapters.map((chapter, index) => ({
      id: chapter.id,
      isCurrent: index + 1 === currentSortNum,
      sortNum: index + 1,
      title: chapter.title,
    }));
  }, [currentSortNum, kind, source, t]);

  const savedChapterId = source?.readPosition?.chapterId;
  const selectChapter = useCallback((item: ReaderChapterListItem) => {
    publishReaderChapterSelection({
      bookId,
      kind,
      openPosition:
        item.sortNum === currentSortNum || item.id === savedChapterId
          ? 'saved'
          : 'start',
      readerKey,
      sortNum: item.sortNum,
    });
    router.back();
  }, [bookId, currentSortNum, kind, readerKey, savedChapterId]);

  const heading = (
    <View style={styles.heading}>
      <IconListDetails color={palette.primary} size={22} strokeWidth={2} />
      <Text style={[styles.headingTitle, { color: palette.onSurface }]}>{t('titles.chapters')}</Text>
    </View>
  );

  return (
    <NativeRouteBottomSheet bookId={bookId} snapPoints={['50%', '100%']}>
      <Stack.Screen options={{ headerShown: false, title: t('titles.chapters') }} />
      <ReaderChapterList
        emptyState={
          <View style={styles.centered}>
            {!source && !error ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <Text style={[styles.error, { color: palette.onSurfaceVariant }]}>
                {error?.kind === 'raw' ? error.text : error ? t(error.key) : null}
              </Text>
            )}
          </View>
        }
        header={heading}
        items={items}
        onSelect={selectChapter}
        palette={palette}
      />
    </NativeRouteBottomSheet>
  );
}

function getChapterSheetMessage(error: unknown): ChapterSheetMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.chaptersAuth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.chaptersNetwork' };
    return { kind: 'raw', text: error.message };
  }
  if (error instanceof Error && error.message) return { kind: 'raw', text: error.message };
  return { kind: 'key', key: 'errors.chaptersLoad' };
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center', minHeight: 180, padding: 24 },
  error: { fontSize: 14, textAlign: 'center' },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 16,
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  headingTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
});

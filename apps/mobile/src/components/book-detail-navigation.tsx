import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import type { BookDetailNavigationProps } from '@/components/book-detail-navigation.types';
import { useSettledLayout } from '@/hooks/use-settled-layout';
import { hasSearchableQuickSearchTags } from '@/services/book-quick-search';
import { toBookCommentRouteParams } from '@/services/comment-target';

const openVersions = (bookId: number, seriesTitle: string) => {
  router.push({
    pathname: '/book/[id]/versions',
    params: { id: String(bookId), title: seriesTitle },
  });
};

export function BookDetailNavigation({
  book,
  palette,
  seriesTitle,
}: BookDetailNavigationProps) {
  const { t } = useTranslation('book');
  const { t: tCommon } = useTranslation('common');
  const { height, width } = useSettledLayout();
  const isComic = book?.type === 'Comic';
  // On an iPad landscape detail page the leading toolbar item floats over the
  // full-height cover. Hide it and keep the same chevron in the trailing group
  // instead, so the artwork stays unobstructed.
  const backOnTrailingEdge = Platform.OS === 'ios' && Platform.isPad && width > height;
  const backButton = (
    <Stack.Toolbar.Button
      accessibilityLabel={tCommon('accessibility.back')}
      icon="chevron.left"
      onPress={() => router.back()}
      tintColor={palette.primary}
    />
  );
  return (
    <>
      <Stack.Screen
        options={{
          contentStyle: { backgroundColor: palette.surface },
          headerBackVisible: false,
          headerTintColor: palette.primary,
          title: '',
        }}
      />
      {backOnTrailingEdge ? null : (
        <Stack.Toolbar placement="left">{backButton}</Stack.Toolbar>
      )}
      {book || backOnTrailingEdge ? (
        <Stack.Toolbar placement="right">
          {backOnTrailingEdge ? backButton : null}
          <Stack.Toolbar.Button
            accessibilityLabel={t('navigation.bookTags')}
            hidden={!book || !hasSearchableQuickSearchTags(book.classification.tags)}
            icon="tag"
            tintColor={palette.primary}
            onPress={() => {
              if (!book) return;
              router.push({
                pathname: '/book/[id]/tags',
                params: { id: String(book.id), ...(book.type ? { type: book.type } : {}) },
              });
            }}
          />
          <Stack.Toolbar.Button
            accessibilityLabel={t('navigation.comments')}
            hidden={!book}
            icon="bubble.left"
            tintColor={palette.primary}
            onPress={() => {
              if (!book) return;
              router.push({
                pathname: '/book/[id]/comments',
                params: toBookCommentRouteParams({
                  bookId: book.id,
                }),
              });
            }}
          />
          {isComic ? (
            <Stack.Toolbar.Menu
              accessibilityLabel={t('navigation.moreActions')}
              hidden={!book}
              icon="ellipsis"
              tintColor={palette.primary}
            >
              <Stack.Toolbar.MenuAction
                icon="person.crop.rectangle"
                onPress={() => {
                  if (!book) return;
                  router.push({
                    pathname: '/book/[id]/uploader',
                    params: { id: String(book.id), type: 'Comic' },
                  });
                }}
              >
                {t('navigation.uploader')}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                icon="books.vertical"
                onPress={() => {
                  if (!book) return;
                  openVersions(book.id, seriesTitle ?? book.title);
                }}
              >
                {t('navigation.switchVersion')}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          ) : (
            <Stack.Toolbar.Button
              accessibilityLabel={t('navigation.uploaderInformation')}
              hidden={!book}
              icon="person.crop.rectangle"
              tintColor={palette.primary}
              onPress={() => {
                if (!book) return;
                router.push({
                  pathname: '/book/[id]/uploader',
                  params: { id: String(book.id), ...(book.type ? { type: book.type } : {}) },
                });
              }}
            />
          )}
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

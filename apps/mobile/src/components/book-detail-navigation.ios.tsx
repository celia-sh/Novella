import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IosTopBarBackground } from '@/components/ios-top-bar-background';
import type { BookDetailNavigationProps } from '@/components/book-detail-navigation.types';
import { hasSearchableQuickSearchTags } from '@/services/book-quick-search';

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
  topBarBackgroundVisible,
}: BookDetailNavigationProps) {
  const { t } = useTranslation('book');
  const { t: tCommon } = useTranslation('common');
  const isComic = book?.type === 'Comic';
  return (
    <>
      <Stack.Screen
        options={{
          contentStyle: { backgroundColor: palette.surface },
          headerBackground: () => (
            <IosTopBarBackground visible={topBarBackgroundVisible} />
          ),
          headerStyle: { backgroundColor: 'transparent' },
          headerBackVisible: false,
          headerTintColor: palette.primary,
          headerTransparent: true,
          title: '',
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel={tCommon('accessibility.back')}
          icon="chevron.left"
          onPress={() => router.back()}
          tintColor={palette.primary}
        />
      </Stack.Toolbar>
      {book ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={t('navigation.bookTags')}
            hidden={!hasSearchableQuickSearchTags(book.classification.tags)}
            icon="tag"
            tintColor={palette.primary}
            onPress={() =>
              router.push({
                pathname: '/book/[id]/tags',
                params: { id: String(book.id), ...(book.type ? { type: book.type } : {}) },
              })
            }
          />
          <Stack.Toolbar.Button
            accessibilityLabel={t('navigation.comments')}
            icon="bubble.left"
            tintColor={palette.primary}
            onPress={() =>
              router.push({ pathname: '/book/[id]/comments', params: { id: String(book.id) } })
            }
          />
          {isComic ? (
            <Stack.Toolbar.Menu
              accessibilityLabel={t('navigation.moreActions')}
              icon="ellipsis"
              tintColor={palette.primary}
            >
              <Stack.Toolbar.MenuAction
                icon="person.crop.rectangle"
                onPress={() =>
                  router.push({
                    pathname: '/book/[id]/uploader',
                    params: { id: String(book.id), type: 'Comic' },
                  })
                }
              >
                {t('navigation.uploader')}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                icon="books.vertical"
                onPress={() => openVersions(book.id, seriesTitle ?? book.title)}
              >
                {t('navigation.switchVersion')}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          ) : (
            <Stack.Toolbar.Button
              accessibilityLabel={t('navigation.uploaderInformation')}
              icon="person.crop.rectangle"
              tintColor={palette.primary}
              onPress={() =>
                router.push({
                  pathname: '/book/[id]/uploader',
                  params: { id: String(book.id), ...(book.type ? { type: book.type } : {}) },
                })
              }
            />
          )}
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

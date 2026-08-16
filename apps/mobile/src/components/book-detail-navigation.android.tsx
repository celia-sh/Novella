import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconMessage, IconTag, IconUserScreen } from '@tabler/icons-react-native';
import { Host } from '@expo/ui';

import type { BookDetail } from '@novella/api-client';

import { NativeSelectionMenu } from '../../modules/novella-ui';
import type { BookDetailNavigationProps } from '@/components/book-detail-navigation.types';
import { hasSearchableQuickSearchTags } from '@/services/book-quick-search';
import { toBookCommentRouteParams } from '@/services/comment-target';
import { useAppColorScheme } from '@/theme/app-theme';

export function BookDetailNavigation({ book, palette, seriesTitle }: BookDetailNavigationProps) {
  return (
    <Stack.Screen
      options={{
        contentStyle: { backgroundColor: palette.surface },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: palette.onSurface,
        headerTransparent: true,
        ...(book
          ? {
              headerRight: () => (
                <AndroidHeaderActions
                  book={book}
                  palette={palette}
                  {...(seriesTitle === undefined ? {} : { seriesTitle })}
                  showTags={hasSearchableQuickSearchTags(book.classification.tags)}
                />
              ),
            }
          : {}),
        title: '',
      }}
    />
  );
}

function AndroidHeaderActions({
  book,
  palette,
  seriesTitle,
  showTags,
}: {
  book: BookDetail;
  palette: BookDetailNavigationProps['palette'];
  seriesTitle?: string;
  showTags: boolean;
}) {
  const { t } = useTranslation('book');
  const [menuOpen, setMenuOpen] = useState(false);
  const colorScheme = useAppColorScheme();
  const isComic = book.type === 'Comic';
  const typeParam = book.type ? { type: book.type } : {};
  const comicMenuItems = [
    { icon: 'user' as const, label: t('navigation.uploader') },
    { icon: 'books' as const, label: t('navigation.switchVersion') },
  ];
  const openUploader = () =>
    router.push({ pathname: '/book/[id]/uploader', params: { id: String(book.id), ...typeParam } });
  const openVersions = () =>
    router.push({
      pathname: '/book/[id]/versions',
      params: { id: String(book.id), title: seriesTitle ?? book.title },
    });
  return (
    <View style={styles.actions}>
      {showTags ? (
        <HeaderAction
          accessibilityLabel={t('navigation.bookTags')}
          color={palette.onSurface}
          icon={IconTag}
          onPress={() =>
            router.push({ pathname: '/book/[id]/tags', params: { id: String(book.id), ...typeParam } })
          }
        />
      ) : null}
      <HeaderAction
        accessibilityLabel={t('navigation.comments')}
        color={palette.onSurface}
        icon={IconMessage}
        onPress={() =>
          router.push({
            pathname: '/book/[id]/comments',
            params: toBookCommentRouteParams({
              bookId: book.id,
              bookType: book.type,
              ...(seriesTitle === undefined ? {} : { seriesTitle }),
            }),
          })
        }
      />
      {isComic ? (
        <Host colorScheme={colorScheme} style={styles.menuHost}>
          <NativeSelectionMenu
            expanded={menuOpen}
            items={comicMenuItems}
            onExpandedChange={setMenuOpen}
            onItemSelected={(index: number) => {
              if (index === 0) openUploader();
              else if (index === 1) openVersions();
            }}
            selectedIndex={-1}
            triggerIcon="dots"
          />
        </Host>
      ) : (
        <HeaderAction
          accessibilityLabel={t('navigation.uploaderInformation')}
          color={palette.onSurface}
          icon={IconUserScreen}
          onPress={openUploader}
        />
      )}
    </View>
  );
}

function HeaderAction({
  accessibilityLabel,
  color,
  icon: Icon,
  onPress,
}: {
  accessibilityLabel: string;
  color: string;
  icon: typeof IconMessage;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Icon color={color} size={24} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  actions: { alignItems: 'center', flexDirection: 'row', marginRight: -12 },
  menuHost: { height: 48, width: 48 },
  pressed: { opacity: 0.6 },
});

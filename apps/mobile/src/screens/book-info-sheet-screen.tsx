import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  IconFileDescription,
  IconId,
  IconRefresh,
  IconTag,
  IconUserCircle,
} from '@tabler/icons-react-native';

import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { BookHtmlContent } from '@/components/book-html-content';
import { PublicUserAvatar } from '@/components/public-user-avatar';
import {
  BOOK_SEARCH_ROUTE,
  normalizeQuickSearchTags,
  resolveTagQuickSearch,
  toBookSearchRouteParams,
} from '@/services/book-quick-search';
import { useBookInfo } from '@/hooks/use-book-info';
import type { BookDetailKind } from '@/hooks/use-book-detail';
import type { BookDetailPalette } from '@/theme/book-detail-theme';

export type BookInfoSheetVariant = 'introduction' | 'tags' | 'uploader';

export interface BookInfoSheetScreenProps {
  bookId: number;
  kind: BookDetailKind;
  variant: BookInfoSheetVariant;
}

export function BookInfoSheetScreen({ bookId, kind, variant }: BookInfoSheetScreenProps) {
  const { t } = useTranslation('book');
  const { t: tCommon } = useTranslation('common');
  const { book, error, isLoading, reload } = useBookInfo(bookId, kind);
  const [contentWidth, setContentWidth] = useState(1);
  const { palette } = useBookDetailRouteTheme(
    bookId,
    book?.coverUrl ?? null,
    book?.coverPlaceholder ?? null,
  );
  const searchFormat = book?.type === 'Comic' || kind === 'Comic' ? 'Comic' : 'Novel';
  const tags = book ? normalizeQuickSearchTags(book.classification.tags) : [];
  const openTagSearch = (tag: string) => {
    const searchTarget = resolveTagQuickSearch(tag);
    if (searchTarget === null) return;

    router.replace({
      pathname: BOOK_SEARCH_ROUTE,
      params: toBookSearchRouteParams(searchTarget, searchFormat),
    });
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      onLayout={(event) => setContentWidth(Math.max(1, event.nativeEvent.layout.width - 48))}
      showsVerticalScrollIndicator={false}
      style={[
        styles.scroll,
        { backgroundColor: palette.surface },
        variant === 'introduction' && styles.scrollFill,
      ]}
    >
      {isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : null}
      {error ? (
        <View style={styles.state}>
          <Text style={[styles.errorText, { color: palette.error }]}>
            {error.kind === 'raw' ? error.text : t(error.key)}
          </Text>
          <Pressable
            accessibilityLabel={tCommon('accessibility.retry')}
            accessibilityRole="button"
            onPress={reload}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <IconRefresh color={palette.primary} size={18} strokeWidth={2} />
            <Text style={[styles.retryLabel, { color: palette.primary }]}>
              {tCommon('actions.retry')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {book && variant === 'tags' && tags.length > 0 ? (
        <View style={styles.sheetSection}>
          <View style={styles.sheetHeading}>
            <IconTag color={palette.primary} size={22} strokeWidth={2} />
            <Text style={[styles.sheetTitle, { color: palette.onSurface }]}>
              {t('info.bookTags')}
            </Text>
          </View>
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Pressable
                accessibilityLabel={t('info.searchTag', { tag })}
                accessibilityRole="button"
                key={tag}
                onPress={() => openTagSearch(tag)}
                style={({ pressed }) => [
                  styles.tag,
                  {
                    backgroundColor: palette.surfaceContainerHighest,
                    borderColor: palette.outlineVariant,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.tagLabel, { color: palette.onSurface }]}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {book && variant === 'uploader' ? (
        <View style={styles.sheetSection}>
          <View style={styles.sheetHeading}>
            <IconUserCircle color={palette.primary} size={22} strokeWidth={2} />
            <Text style={[styles.sheetTitle, { color: palette.onSurface }]}>
              {t('info.uploaderInformation')}
            </Text>
          </View>
          <Text style={[styles.description, { color: palette.onSurfaceVariant }]}>
            {t('info.uploaderDescription')}
          </Text>
          <View style={[styles.uploaderCard, { backgroundColor: palette.surfaceContainerHighest }]}>
            <UploaderAvatar
              avatarUrl={book.user?.avatarUrl ?? ''}
              palette={palette}
              userId={book.user?.id ?? 0}
              userName={book.user?.userName ?? ''}
            />
            <View style={styles.uploaderText}>
              <Text numberOfLines={2} style={[styles.uploaderName, { color: palette.onSurface }]}>
                {book.user?.userName.trim() || t('info.unknownUploader')}
              </Text>
              <Text style={[styles.description, { color: palette.onSurfaceVariant }]}>
                {book.user && book.user.id > 0
                  ? t('info.uploader')
                  : t('info.noUploaderProfile')}
              </Text>
            </View>
          </View>
          {book.user && book.user.id > 0 ? (
            <View style={[styles.infoItem, { backgroundColor: palette.surfaceContainerHighest }]}>
              <IconId color={palette.primary} size={20} strokeWidth={2} />
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: palette.onSurfaceVariant }]}>
                  {t('info.uid')}
                </Text>
                <Text selectable style={[styles.infoValue, { color: palette.onSurface }]}>
                  {book.user.id}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      {book && variant === 'introduction' ? (
        <View style={styles.sheetSection}>
          <View style={styles.sheetHeading}>
            <IconFileDescription color={palette.primary} size={22} strokeWidth={2} />
            <Text style={[styles.sheetTitle, { color: palette.onSurface }]}>
              {t('info.introduction')}
            </Text>
          </View>
          <BookHtmlContent
            contentWidth={contentWidth}
            html={book.introduction}
            textColor={palette.onSurface}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function UploaderAvatar({
  avatarUrl,
  palette,
  userId,
  userName,
}: {
  avatarUrl: string;
  palette: BookDetailPalette;
  userId: number;
  userName: string;
}) {
  return (
    <PublicUserAvatar
      avatarUrl={avatarUrl}
      fallbackBackground={palette.surfaceContainerHighest}
      fallbackColor={palette.onSurface}
      size={56}
      userId={userId}
      userName={userName}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 48,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  description: { fontSize: 13, lineHeight: 18 },
  errorText: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  infoItem: { alignItems: 'flex-start', borderRadius: 16, flexDirection: 'row', gap: 12, padding: 14 },
  infoLabel: { fontSize: 12, lineHeight: 16 },
  infoText: { flex: 1, gap: 4 },
  infoValue: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  pressed: { opacity: 0.68 },
  retryButton: { alignItems: 'center', flexDirection: 'row', gap: 7, padding: 8 },
  retryLabel: { fontSize: 15, fontWeight: '600' },
  scroll: { alignSelf: 'stretch', width: '100%' },
  scrollFill: { flex: 1 },
  sheetHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sheetSection: { gap: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  state: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  tag: { borderRadius: 8, borderWidth: 0.5, paddingHorizontal: 12, paddingVertical: 7 },
  tagLabel: { fontSize: 14, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uploaderCard: { alignItems: 'center', borderRadius: 20, flexDirection: 'row', gap: 14, padding: 16 },
  uploaderName: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  uploaderText: { flex: 1, gap: 4 },
});

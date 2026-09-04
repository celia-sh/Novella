import { IconCheck } from '@tabler/icons-react-native';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BookDetailPalette } from '@/theme/book-detail-theme';
import { useAppTheme } from '@/theme/app-theme';

const CHAPTER_ROW_HEIGHT = 58;
const CHAPTER_SEPARATOR_HEIGHT = StyleSheet.hairlineWidth;

export interface ReaderChapterListItem {
  id: number;
  sortNum: number;
  title: string;
  subtitle?: string;
  isCurrent: boolean;
}

export interface ReaderChapterListProps {
  emptyState?: ReactElement;
  header?: ReactElement;
  items: readonly ReaderChapterListItem[];
  onSelect: (item: ReaderChapterListItem) => void;
  palette: BookDetailPalette;
}

/** Virtualized chapter list styled with the shared book-detail palette. */
export function ReaderChapterList({ emptyState, header, items, onSelect, palette }: ReaderChapterListProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation('reader');
  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={items}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: palette.outlineVariant }]} />
      )}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={emptyState ?? null}
      ListHeaderComponent={header ?? null}
      renderItem={({ item }) => (
        <Pressable
          accessibilityLabel={t('accessibility.openChapter', {
            number: item.sortNum,
            title: item.title,
          })}
          accessibilityRole="button"
          accessibilityState={{ selected: item.isCurrent }}
          onPress={() => onSelect(item)}
          style={({ pressed }) => [
            styles.row,
            item.isCurrent && {
              backgroundColor: palette.primaryContainer,
            },
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.numberSlot,
              item.isCurrent && { backgroundColor: palette.primary },
            ]}
          >
            {item.isCurrent ? (
              <IconCheck color={palette.onPrimary} size={17} strokeWidth={2.6} />
            ) : (
              <Text style={[styles.number, { color: palette.onSurfaceVariant }]}>
                {item.sortNum}
              </Text>
            )}
          </View>
          <View style={styles.copy}>
            <Text
              numberOfLines={1}
              style={[
                styles.title,
                { color: item.isCurrent ? palette.onPrimaryContainer : palette.onSurface },
                item.isCurrent && styles.selectedTitle,
              ]}
            >
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.subtitle,
                  {
                    color: item.isCurrent
                      ? palette.onPrimaryContainer
                      : palette.onSurfaceVariant,
                  },
                ]}
              >
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      )}
      showsVerticalScrollIndicator={false}
      style={[
        styles.list,
        { backgroundColor: colors.background },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  copy: { flex: 1, gap: 3 },
  list: { flex: 1 },
  number: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    textAlign: 'center',
  },
  numberSlot: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pressed: { opacity: 0.62 },
  row: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 14,
    height: CHAPTER_ROW_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectedTitle: { fontWeight: '700' },
  separator: {
    height: CHAPTER_SEPARATOR_HEIGHT,
    marginLeft: 58,
    marginRight: 12,
  },
  subtitle: { fontSize: 12, lineHeight: 16 },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
});

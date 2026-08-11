import { IconCheck, IconGripVertical } from '@tabler/icons-react-native';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type GestureResponderEvent,
} from 'react-native';

import {
  normalizeCoverUrl,
  type BookListItem,
} from '@novella/api-client';

import { BookCoverImage } from '@/components/book-cover-image';
import { BookTypeBadgeIcon } from '@/components/book-type-badge';
import {
  resolveBookCategoryBadge,
  resolveBookLevelBadge,
} from '@/services/book-badge-definitions';
import { createThemedStyles } from '@/theme/app-theme';

export const BOOK_COVER_ASPECT_RATIO = 2 / 3;
const BOOK_COVER_CORNER_RADIUS = 12;

interface BookCoverGridItemProps {
  accessibilityActions?: readonly AccessibilityActionInfo[];
  animateCachedImage?: boolean;
  book: BookListItem;
  interactionState?: 'default' | 'selected' | 'sorting';
  networkImageEnabled?: boolean;
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  onPress?: () => void;
  onPressOut?: () => void;
  /** Leaderboard position; renders a gold/silver/bronze badge for ranks 1-3. */
  rank?: number;
  tileWidth: number;
}

export function BookCoverGridItem({
  accessibilityActions,
  animateCachedImage,
  book,
  interactionState = 'default',
  networkImageEnabled = true,
  onAccessibilityAction,
  onLongPress,
  onPress,
  onPressOut,
  rank,
  tileWidth,
}: BookCoverGridItemProps) {
  const { t } = useTranslation('book');
  const styles = useBookCoverGridItemStyles();
  const categoryBadge = resolveBookCategoryBadge(book.category);
  const coverUrl = normalizeCoverUrl(book.coverUrl);
  const levelBadge = resolveBookLevelBadge({
    interiorLevel: book.interiorLevel,
    level: book.level,
  });

  return (
    <Pressable
      {...(accessibilityActions ? { accessibilityActions: [...accessibilityActions] } : {})}
      accessibilityLabel={book.title}
      accessibilityRole="button"
      accessibilityState={{ selected: interactionState === 'selected' }}
      delayLongPress={180}
      onAccessibilityAction={onAccessibilityAction}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressOut={onPressOut}
      style={[styles.item, { width: tileWidth }]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.coverFrame,
          { aspectRatio: BOOK_COVER_ASPECT_RATIO, width: tileWidth },
        ]}
      >
        <BookCoverImage
          accessibilityLabel={t('cover.accessibility', { title: book.title })}
          {...(animateCachedImage === undefined ? {} : { animateCachedImage })}
          blurHash={book.coverPlaceholder}
          networkImageEnabled={networkImageEnabled}
          source={coverUrl}
        />

        {levelBadge ? (
          <BookTypeBadgeIcon
            badge={levelBadge}
            containerStyle={styles.levelBadgePosition}
          />
        ) : null}
        {categoryBadge ? (
          <BookTypeBadgeIcon
            badge={categoryBadge}
            containerStyle={styles.categoryBadgePosition}
          />
        ) : null}
        {rank !== undefined && rank > 0 && rank <= 3 ? <RankBadge rank={rank} /> : null}
        {interactionState !== 'default' ? (
          <View
            pointerEvents="none"
            style={[
              styles.interactionOverlay,
              interactionState === 'selected' ? styles.selectedOverlay : styles.sortingOverlay,
            ]}
          >
            {interactionState === 'selected' ? (
              <IconCheck color="#FFFFFF" size={34} strokeWidth={2.5} />
            ) : (
              <IconGripVertical color="#FFFFFF" size={36} strokeWidth={2.2} />
            )}
          </View>
        ) : null}
      </View>
      <View style={[styles.titleContainer, { width: tileWidth }]}>
        <NativeText numberOfLines={2} style={styles.title}>
          {book.title}
        </NativeText>
      </View>
    </Pressable>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles = useBookCoverGridItemStyles();
  const color = rank === 1 ? '#FFD700' : rank === 2 ? '#78909C' : '#CD7F32';
  return (
    <View style={[styles.rankBadge, { backgroundColor: color }]}>
      <NativeText style={styles.rankLabel}>{String(rank)}</NativeText>
    </View>
  );
}

const useBookCoverGridItemStyles = createThemedStyles((colors) => ({
  categoryBadgePosition: {
    bottom: 0,
    position: 'absolute',
    right: 0,
  },
  coverFrame: {
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: BOOK_COVER_CORNER_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  interactionOverlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  item: {
    alignItems: 'center',
  },
  levelBadgePosition: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  rankBadge: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: BOOK_COVER_CORNER_RADIUS,
    left: 0,
    minHeight: 28,
    justifyContent: 'center',
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    top: 0,
  },
  rankLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  selectedOverlay: {
    backgroundColor: 'rgba(217, 71, 93, 0.72)',
  },
  sortingOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  title: {
    color: colors.label,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  titleContainer: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
}));

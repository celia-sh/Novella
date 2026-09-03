import {
  IconAlertCircle,
  IconChevronRight,
  IconRefresh,
  IconSpeakerphone,
  IconWorld,
} from '@tabler/icons-react-native';
import { router } from 'expo-router';
import { Card, Skeleton } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useAnnouncements,
  type AnnouncementListEntry,
} from '@/hooks/use-announcements';
import { formatDate } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

const ANNOUNCEMENT_CARD_HEIGHT = 122;
const SKELETON_ROWS = [0, 1, 2, 3, 4];

export function AnnouncementCenterScreen() {
  const styles = useAnnouncementCenterStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const {
    items,
    loadMore,
    loading,
    loadingMore,
    loadMoreError,
    refresh,
    refreshing,
    retry,
    retryLoadMore,
    retryServer,
    serverError,
  } = useAnnouncements();

  return (

      <FlatList
        contentContainerStyle={[
          styles.content,
          items.length === 0 && !loading && styles.emptyContent,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        data={items}
        keyExtractor={(item) => `${item.source}:${item.id}`}
        ListEmptyComponent={loading
          ? <AnnouncementListSkeleton />
          : (
              <AnnouncementEmptyContent
                onRetry={retry}
                serverError={serverError}
              />
            )}
        ListFooterComponent={loadingMore
          ? <AnnouncementListSkeleton rows={1} />
          : loadMoreError
            ? (
                <SourceWarning
                  message={t('announcements.errors.partialSite')}
                  onRetry={() => void retryLoadMore()}
                />
              )
            : null}
        ListHeaderComponent={items.length > 0 && serverError
          ? (
              <View style={styles.warningStack}>
                <SourceWarning
                  message={t('announcements.errors.partialSite')}
                  onRetry={() => void retryServer()}
                />
              </View>
            )
          : null}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            colors={[colors.accent as string]}
            onRefresh={() => void refresh()}
            refreshing={refreshing}
            tintColor={colors.accent as string}
          />
        }
        renderItem={({ item }) => <AnnouncementCard item={item} />}
        showsVerticalScrollIndicator={false}
        style={styles.root}
      />

  );
}

function AnnouncementEmptyContent({
  onRetry,
  serverError,
}: {
  onRetry(): void;
  serverError: string | null;
}) {
  const { t } = useTranslation('community');
  if (serverError) {
    return (
      <AnnouncementState
        description={serverError}
        icon="error"
        onRetry={onRetry}
        title={t('announcements.errors.list')}
      />
    );
  }
  return (
    <AnnouncementState
      description={t('announcements.empty')}
      icon="empty"
      title={t('announcements.empty')}
    />
  );
}

function AnnouncementCard({ item }: { item: AnnouncementListEntry }) {
  const styles = useAnnouncementCenterStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const sourceLabel = t('announcements.siteSource');
  const date = formatDate(item.publishedAt, locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Pressable
      accessibilityLabel={t('announcements.accessibility.openItem', {
        source: sourceLabel,
        title: item.title,
      })}
      accessibilityRole="button"
      onPress={() => router.push({
        pathname: '/announcement/[source]/[id]',
        params: {
          id: item.id,
          source: item.source,
        },
      })}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.card} variant="secondary">
        <Card.Body style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={styles.iconBox}>
              <IconWorld color={colors.onPrimaryContainer as string} size={21} strokeWidth={2} />
            </View>
            <View style={styles.cardCopy}>
              <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
              {item.summary ? (
                <Text numberOfLines={2} style={styles.summary}>{item.summary}</Text>
              ) : null}
            </View>
            <IconChevronRight color={colors.secondaryLabel as string} size={20} />
          </View>
          <Text numberOfLines={1} style={styles.metaText}>
            {t('announcements.sourceMeta', { date, source: sourceLabel })}
          </Text>
        </Card.Body>
      </Card>
    </Pressable>
  );
}

function AnnouncementListSkeleton({ rows = 5 }: { rows?: number }) {
  const styles = useAnnouncementCenterStyles();
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.skeletonStack}
    >
      {SKELETON_ROWS.slice(0, rows).map((key) => (
        <Card key={`announcement-skeleton-${key}`} style={styles.card} variant="secondary">
          <Card.Body style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <Skeleton style={[styles.skeletonIcon, { backgroundColor: colors.card }]} />
              <View style={styles.cardCopy}>
                <Skeleton style={[styles.skeletonTitle, { backgroundColor: colors.card }]} />
                <Skeleton style={[styles.skeletonLine, { backgroundColor: colors.card }]} />
                <Skeleton style={[styles.skeletonShort, { backgroundColor: colors.card }]} />
              </View>
              <Skeleton style={[styles.skeletonChevron, { backgroundColor: colors.card }]} />
            </View>
            <Skeleton style={[styles.skeletonMeta, { backgroundColor: colors.card }]} />
          </Card.Body>
        </Card>
      ))}
    </View>
  );
}

function SourceWarning({ message, onRetry }: { message: string; onRetry(): void }) {
  const styles = useAnnouncementCenterStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('common');
  return (
    <View style={styles.warning}>
      <IconAlertCircle color={colors.error as string} size={18} />
      <Text style={styles.warningText}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.retryAction, pressed && styles.pressed]}
      >
        <IconRefresh color={colors.accent as string} size={16} />
        <Text style={styles.retryText}>{t('actions.retry')}</Text>
      </Pressable>
    </View>
  );
}

function AnnouncementState({
  description,
  icon,
  onRetry,
  title,
}: {
  description: string;
  icon: 'empty' | 'error';
  onRetry?: () => void;
  title: string;
}) {
  const styles = useAnnouncementCenterStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('common');
  const StateIcon = icon === 'error' ? IconAlertCircle : IconSpeakerphone;
  return (
    <View style={styles.state}>
      <StateIcon
        color={(icon === 'error' ? colors.error : colors.secondaryLabel) as string}
        size={42}
        strokeWidth={1.6}
      />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.stateButton, pressed && styles.pressed]}
        >
          <IconRefresh color={colors.accent as string} size={17} />
          <Text style={styles.retryText}>{t('actions.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useAnnouncementCenterStyles = createThemedStyles((colors) => ({
  card: {
    borderCurve: 'continuous',
    borderRadius: 20,
    height: ANNOUNCEMENT_CARD_HEIGHT,
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 14,
  },
  cardCopy: { flex: 1, gap: 5 },
  cardTitle: { color: colors.label, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  cardTopRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  content: { gap: 10, paddingBottom: 48, paddingHorizontal: 12, paddingTop: 10 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.primaryContainer,
    borderCurve: 'continuous',
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  metaText: { color: colors.secondaryLabel, fontSize: 12, lineHeight: 16, paddingLeft: 54 },
  pressed: { opacity: 0.68 },
  retryAction: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingVertical: 4 },
  retryText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  root: { flex: 1 },
  skeletonChevron: { borderRadius: 6, height: 20, width: 20 },
  skeletonIcon: { borderRadius: 13, height: 42, width: 42 },
  skeletonLine: { borderRadius: 6, height: 12, width: '100%' },
  skeletonMeta: { borderRadius: 6, height: 12, marginLeft: 54, width: '44%' },
  skeletonShort: { borderRadius: 6, height: 12, width: '72%' },
  skeletonStack: { gap: 10 },
  skeletonTitle: { borderRadius: 6, height: 16, width: '58%' },
  state: { alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 56 },
  stateButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stateDescription: {
    color: colors.secondaryLabel,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  stateTitle: { color: colors.label, fontSize: 17, fontWeight: '700' },
  summary: { color: colors.secondaryLabel, fontSize: 14, lineHeight: 20 },
  warning: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningStack: { gap: 8 },
  warningText: { color: colors.secondaryLabel, flex: 1, fontSize: 13, lineHeight: 18 },
}));

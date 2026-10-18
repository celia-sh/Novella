import {
  IconAlertCircle,
  IconRefresh,
  IconSpeakerphone,
} from '@tabler/icons-react-native';
import { router, Stack } from 'expo-router';
import { Skeleton } from 'panelui-native/components/skeleton';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { HorizontalSafeArea } from '@/components/horizontal-safe-area';
import {
  useAnnouncements,
  type AnnouncementListEntry,
} from '@/hooks/use-announcements';
import { PAGE_PADDING, useWideLayout } from '@/hooks/use-wide-layout';
import { formatDate } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { AnnouncementDetailPane } from '@/screens/announcement-detail-screen';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

const SKELETON_ROWS = [0, 1, 2, 3, 4];
const GROUP_RADIUS = 16;

export function AnnouncementCenterScreen() {
  const styles = useAnnouncementCenterStyles();
  const { t } = useTranslation('community');
  const { isWide, usableWidth } = useWideLayout();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const announcements = useAnnouncements();
  const { items } = announcements;

  if (!isWide) {
    return (
      <HorizontalSafeArea style={styles.root}>
        <Stack.Screen options={{ headerLargeTitle: true, title: t('announcements.title') }} />
        <AnnouncementList {...announcements} />
      </HorizontalSafeArea>
    );
  }

  // Landscape is a master-detail split: the list stays put on the left and
  // the selected announcement, with its comments, reads on the right.
  const selected = items.find((item) => entryKey(item) === selectedKey) ?? items[0] ?? null;
  const listWidth = Math.round(Math.min(380, Math.max(300, usableWidth * 0.36)));
  const detailWidth = usableWidth - listWidth - StyleSheet.hairlineWidth;

  return (
    <HorizontalSafeArea style={[styles.root, styles.splitRow]}>
      {/* No title: the list pane already reads as the announcement list, and an
          empty title lets the top bar collapse so both panes start at the top. */}
      <Stack.Screen options={{ headerLargeTitle: false, title: '' }} />
      <View style={{ width: listWidth }}>
        <AnnouncementList
          {...announcements}
          onSelect={(item) => setSelectedKey(entryKey(item))}
          selectedKey={selected ? entryKey(selected) : null}
        />
      </View>
      <View style={styles.splitDivider} />
      <View style={styles.detailPane}>
        {selected ? (
          <AnnouncementDetailPane
            embedded
            id={selected.id}
            key={entryKey(selected)}
            paneWidth={detailWidth}
          />
        ) : null}
      </View>
    </HorizontalSafeArea>
  );
}

function AnnouncementList({
  items,
  loadMore,
  loading,
  loadingMore,
  loadMoreError,
  onSelect,
  refresh,
  refreshing,
  retry,
  retryLoadMore,
  retryServer,
  selectedKey = null,
  serverError,
}: ReturnType<typeof useAnnouncements> & {
  onSelect?: (item: AnnouncementListEntry) => void;
  selectedKey?: string | null;
}) {
  const styles = useAnnouncementCenterStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        items.length === 0 && !loading && styles.emptyContent,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={entryKey}
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
          : undefined}
      ListHeaderComponent={items.length > 0 && serverError
        ? (
            <SourceWarning
              message={t('announcements.errors.partialSite')}
              onRetry={() => void retryServer()}
            />
          )
        : undefined}
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
      renderItem={({ index, item }) => (
        <AnnouncementRow
          first={index === 0}
          item={item}
          last={index === items.length - 1 && !loadingMore}
          onPress={onSelect ? () => onSelect(item) : undefined}
          selected={entryKey(item) === selectedKey}
        />
      )}
      showsVerticalScrollIndicator={false}
      style={styles.list}
    />
  );
}

function entryKey(item: AnnouncementListEntry): string {
  return `${item.source}:${item.id}`;
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
  return <AnnouncementState icon="empty" title={t('announcements.empty')} />;
}

/** One row of the inset grouped list: date, title, then a two-line summary.
 * Rows carry their own corner rounding so the group survives pagination. */
function AnnouncementRow({
  first,
  item,
  last,
  onPress,
  selected,
}: {
  first: boolean;
  item: AnnouncementListEntry;
  last: boolean;
  onPress?: (() => void) | undefined;
  selected: boolean;
}) {
  const styles = useAnnouncementCenterStyles();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const date = formatDate(item.publishedAt, locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Pressable
      accessibilityLabel={t('announcements.accessibility.openItem', {
        source: t('announcements.siteSource'),
        title: item.title,
      })}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress ?? (() => router.push({
        pathname: '/announcement/[source]/[id]',
        params: {
          id: item.id,
          source: item.source,
        },
      }))}
      style={({ pressed }) => [
        styles.row,
        first && styles.rowFirst,
        last && styles.rowLast,
        (pressed || selected) && styles.rowHighlighted,
      ]}
    >
      <View style={[styles.rowBody, !last && styles.rowSeparator]}>
        <Text numberOfLines={1} style={styles.rowDate}>{date}</Text>
        <Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text>
        {item.summary ? (
          <Text numberOfLines={2} style={styles.rowSummary}>{item.summary}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function AnnouncementListSkeleton({ rows = 5 }: { rows?: number }) {
  const styles = useAnnouncementCenterStyles();
  const { colors } = useAppTheme();
  const keys = SKELETON_ROWS.slice(0, rows);
  const skeletonColor = { backgroundColor: colors.surfaceContainerHighest };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {keys.map((key, index) => (
        <View
          key={`announcement-skeleton-${key}`}
          style={[
            styles.row,
            index === 0 && styles.rowFirst,
            index === keys.length - 1 && styles.rowLast,
          ]}
        >
          <View style={[styles.rowBody, index < keys.length - 1 && styles.rowSeparator]}>
            <Skeleton style={[styles.skeletonDate, skeletonColor]} />
            <Skeleton style={[styles.skeletonTitle, skeletonColor]} />
            <Skeleton style={[styles.skeletonLine, skeletonColor]} />
            <Skeleton style={[styles.skeletonShort, skeletonColor]} />
          </View>
        </View>
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
  description?: string;
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
        size={40}
        strokeWidth={1.6}
      />
      <Text style={styles.stateTitle}>{title}</Text>
      {description ? <Text style={styles.stateDescription}>{description}</Text> : null}
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
  content: { paddingBottom: 40, paddingHorizontal: PAGE_PADDING, paddingTop: 8 },
  detailPane: { flex: 1 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  list: { flex: 1 },
  pressed: { opacity: 0.68 },
  retryAction: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingVertical: 4 },
  retryText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  root: { backgroundColor: colors.background, flex: 1 },
  row: { backgroundColor: colors.card, borderCurve: 'continuous', paddingLeft: PAGE_PADDING },
  rowBody: { gap: 3, paddingRight: PAGE_PADDING, paddingVertical: 13 },
  rowDate: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 18 },
  rowFirst: { borderTopLeftRadius: GROUP_RADIUS, borderTopRightRadius: GROUP_RADIUS },
  rowHighlighted: { backgroundColor: colors.surfaceContainerHighest },
  rowLast: { borderBottomLeftRadius: GROUP_RADIUS, borderBottomRightRadius: GROUP_RADIUS },
  rowSeparator: { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth },
  rowSummary: { color: colors.secondaryLabel, fontSize: 15, lineHeight: 21 },
  rowTitle: { color: colors.label, fontSize: 17, fontWeight: '600', lineHeight: 23 },
  skeletonDate: { borderRadius: 5, height: 11, marginBottom: 4, width: '28%' },
  skeletonLine: { borderRadius: 6, height: 13, marginTop: 6, width: '100%' },
  skeletonShort: { borderRadius: 6, height: 13, marginTop: 4, width: '64%' },
  skeletonTitle: { borderRadius: 6, height: 17, width: '62%' },
  splitDivider: { backgroundColor: colors.separator, width: StyleSheet.hairlineWidth },
  splitRow: { flexDirection: 'row' },
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
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  stateTitle: { color: colors.label, fontSize: 17, fontWeight: '600' },
  warning: {
    alignItems: 'center',
    marginVertical: 12,
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: GROUP_RADIUS,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: 12,
  },
  warningText: { color: colors.secondaryLabel, flex: 1, fontSize: 14, lineHeight: 19 },
}));

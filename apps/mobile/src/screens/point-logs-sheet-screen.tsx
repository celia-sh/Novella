import { IconChartLine, IconCoins, IconHistory, IconRefresh } from '@tabler/icons-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PointLogItem } from '@novella/api-client';
import type { PointLogKind } from '@novella/client-core';

import { formatDate, formatRelativeTime } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { pointLogs } from '@/services/client';
import { createThemedStyles, resolveAccentHex, useAppTheme } from '@/theme/app-theme';

const PAGE_SIZE = 20;

const SOURCE_LABEL_KEYS = {
  SignIn: 'pointLogs.sources.signIn',
  Read: 'pointLogs.sources.read',
  PublishNovel: 'pointLogs.sources.publishNovel',
  PublishComic: 'pointLogs.sources.publishComic',
  Thread: 'pointLogs.sources.thread',
  Reply: 'pointLogs.sources.reply',
  BookComment: 'pointLogs.sources.bookComment',
  Invite: 'pointLogs.sources.invite',
  DownloadNovel: 'pointLogs.sources.downloadNovel',
  DownloadComic: 'pointLogs.sources.downloadComic',
  ShareNovel: 'pointLogs.sources.shareNovel',
  ShareComic: 'pointLogs.sources.shareComic',
  ShopPurchase: 'pointLogs.sources.shopPurchase',
  Admin: 'pointLogs.sources.admin',
} as const;

const SPEND_SOURCES = new Set(['DownloadNovel', 'DownloadComic', 'ShopPurchase']);

export interface PointLogsSheetScreenProps {
  kind: PointLogKind;
}

export function PointLogsSheetScreen({ kind }: PointLogsSheetScreenProps) {
  const insets = useSafeAreaInsets();
  const locale = useAppLocale();
  const { colors } = useAppTheme();
  const styles = usePointLogsStyles();
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const [items, setItems] = useState<PointLogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const loadingRef = useRef(false);
  const nextPageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const numberFormatter = new Intl.NumberFormat(locale);
  const title = kind === 'coin' ? t('pointLogs.coinTitle') : t('pointLogs.experienceTitle');
  const Icon = kind === 'coin' ? IconCoins : IconChartLine;

  const loadPage = useCallback(async (reset: boolean) => {
    if (loadingRef.current) return;
    const page = reset ? 1 : nextPageRef.current;
    if (!reset && !hasMoreRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    if (reset) setError(false);
    try {
      const response = await pointLogs.loadPage(kind, page, PAGE_SIZE);
      setItems((current) => reset ? response.items : [...current, ...response.items]);
      nextPageRef.current = response.page + 1;
      hasMoreRef.current = response.page < response.totalPages && response.items.length > 0;
      setLoaded(true);
      setError(false);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    nextPageRef.current = 1;
    hasMoreRef.current = true;
    setItems([]);
    setLoaded(false);
    setError(false);
    void loadPage(true);
  }, [kind, loadPage]);

  const retry = () => {
    void loadPage(items.length === 0);
  };

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        items.length === 0 && styles.emptyContent,
        { paddingBottom: Math.max(32, insets.bottom + 16) },
      ]}
      data={items}
      keyExtractor={(item, index) => `${item.occurredAt}-${item.refId ?? 'none'}-${index}`}
      ListEmptyComponent={(
        <View style={styles.state}>
          {loading ? (
            <>
              <ActivityIndicator color={resolveAccentHex(colors.accent)} />
              <Text style={styles.stateTitle}>{t('pointLogs.loading')}</Text>
            </>
          ) : null}
          {!loading && error ? (
            <>
              <IconRefresh color={colors.secondaryLabel as string} size={40} strokeWidth={1.5} />
              <Text style={styles.stateTitle}>{t('pointLogs.loadFailed')}</Text>
              <Pressable
                accessibilityLabel={tCommon('accessibility.retry')}
                accessibilityRole="button"
                onPress={retry}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <IconRefresh color={resolveAccentHex(colors.accent)} size={18} strokeWidth={2} />
                <Text style={styles.retryLabel}>{t('pointLogs.retry')}</Text>
              </Pressable>
            </>
          ) : null}
          {!loading && !error && loaded ? (
            <>
              <IconHistory color={colors.secondaryLabel as string} size={40} strokeWidth={1.5} />
              <Text style={styles.stateTitle}>{t('pointLogs.empty')}</Text>
            </>
          ) : null}
        </View>
      )}
      ListFooterComponent={items.length > 0 && (loading || error) ? (
        <View style={styles.footer}>
          {loading ? <ActivityIndicator color={resolveAccentHex(colors.accent)} /> : null}
          {!loading && error ? (
            <Pressable
              accessibilityLabel={tCommon('accessibility.retry')}
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <IconRefresh color={resolveAccentHex(colors.accent)} size={18} strokeWidth={2} />
              <Text style={styles.retryLabel}>{t('pointLogs.retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      ListHeaderComponent={(
        <View style={styles.header}>
          <Icon color={resolveAccentHex(colors.accent)} size={22} strokeWidth={2} />
          <Text style={styles.title}>{title}</Text>
        </View>
      )}
      onEndReached={() => {
        if (loaded) void loadPage(false);
      }}
      onEndReachedThreshold={0.4}
      showsVerticalScrollIndicator={false}
      style={[styles.scroll, { backgroundColor: colors.background }]}
      renderItem={({ item }) => (
        <PointLogRow item={item} locale={locale} numberFormatter={numberFormatter} />
      )}
    />
  );
}

function PointLogRow({
  item,
  locale,
  numberFormatter,
}: {
  item: PointLogItem;
  locale: Parameters<typeof formatRelativeTime>[1];
  numberFormatter: Intl.NumberFormat;
}) {
  const styles = usePointLogsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('settings');
  const sourceKey = SOURCE_LABEL_KEYS[item.source as keyof typeof SOURCE_LABEL_KEYS];
  const source = sourceKey ? t(sourceKey) : item.source;
  const label = item.amount < 0 && !SPEND_SOURCES.has(item.source)
    ? `${source}${t('pointLogs.reclaimedSuffix')}`
    : source;
  const occurredAt = formatRelativeTime(item.occurredAt, locale)
    || formatDate(item.occurredAt, locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      <View style={styles.copy}>
        <Text style={styles.source}>{label}</Text>
        <Text style={styles.time}>{occurredAt}</Text>
      </View>
      <View style={styles.amountColumn}>
        <Text style={[styles.amount, { color: item.amount >= 0 ? resolveAccentHex(colors.accent) : colors.error as string }]}>
          {item.amount >= 0 ? '+' : ''}{numberFormatter.format(item.amount)}
        </Text>
        <Text style={styles.balance}>
          {t('pointLogs.balance', { balance: numberFormatter.format(item.balance) })}
        </Text>
      </View>
    </View>
  );
}

const usePointLogsStyles = createThemedStyles((colors) => ({
  amount: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  amountColumn: { alignItems: 'flex-end', gap: 2 },
  balance: { color: colors.secondaryLabel, fontSize: 12, lineHeight: 17 },
  content: { paddingHorizontal: 24, paddingTop: 28 },
  copy: { flex: 1, gap: 3 },
  emptyContent: { flexGrow: 1 },
  footer: { alignItems: 'center', minHeight: 48, paddingTop: 16 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingBottom: 20 },
  pressed: { opacity: 0.68 },
  retryButton: { alignItems: 'center', flexDirection: 'row', gap: 7, padding: 8 },
  retryLabel: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 16, minHeight: 68, paddingVertical: 12 },
  scroll: { flex: 1 },
  source: { color: colors.label, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  state: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', minHeight: 240 },
  stateTitle: { color: colors.secondaryLabel, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  time: { color: colors.secondaryLabel, fontSize: 12, lineHeight: 17 },
  title: { color: colors.label, fontSize: 17, fontWeight: '700', lineHeight: 22 },
}));

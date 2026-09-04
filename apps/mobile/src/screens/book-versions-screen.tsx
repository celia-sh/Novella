import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
  IconBooks,
  IconCheck,
  IconRefresh,
} from '@tabler/icons-react-native';

import type { ComicSeriesDetail } from '@novella/api-client';

import { PublicUserAvatar } from '@/components/public-user-avatar';
import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import type { BookUserMessage } from '@/hooks/use-book-detail';
import { reader } from '@/services/client';
import {
  createComicBookDetailParams,
  updateComicVersionInDetail,
  type RootStackNavigation,
} from '@/services/book-version-navigation';
import { useAppTheme } from '@/theme/app-theme';

export interface BookVersionsScreenProps {
  /** Id of the version currently open in the detail page below. */
  bookId: number;
  seriesTitle: string;
}

export function BookVersionsScreen({ bookId, seriesTitle }: BookVersionsScreenProps) {
  const { t } = useTranslation('book');
  const { t: tCommon } = useTranslation('common');
  const { colors } = useAppTheme();
  const navigation = useNavigation<RootStackNavigation>('/');
  const { palette } = useBookDetailRouteTheme(bookId, null, null, true);
  const [detail, setDetail] = useState<ComicSeriesDetail | null>(null);
  const [error, setError] = useState<BookUserMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDetail(await reader.loadComicSeriesInfo(seriesTitle));
    } catch (cause) {
      setError(cause instanceof Error
        ? { kind: 'raw', text: cause.message }
        : { kind: 'key', key: 'errors.versions.fallback' });
    } finally {
      setIsLoading(false);
    }
  }, [seriesTitle]);

  useEffect(() => { void load(); }, [load]);

  const openVersion = (
    versionId: number,
    versionTitle: string,
    coverUrl: string,
    coverPlaceholder: string | null,
  ) => {
    const params = createComicBookDetailParams({
      coverPlaceholder,
      coverUrl,
      seriesTitle,
      title: versionTitle,
      versionId,
    });
    // The version picker is presented above the detail route. Update that
    // existing route before dismissing the picker so changing versions does
    // not add a second detail page to the back stack.
    if (updateComicVersionInDetail(navigation, params)) return;
    router.replace({ pathname: '/book/[id]', params });
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      style={[
        styles.scroll,
        { backgroundColor: colors.background },
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
            onPress={load}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <IconRefresh color={palette.primary} size={18} strokeWidth={2} />
            <Text style={[styles.retryLabel, { color: palette.primary }]}>
              {tCommon('actions.retry')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {detail ? (
        <View style={styles.sheetSection}>
          <View style={styles.sheetHeading}>
            <IconBooks color={palette.primary} size={22} strokeWidth={2} />
            <Text style={[styles.sheetTitle, { color: palette.onSurface }]}>
              {t('versions.title')}
            </Text>
          </View>
          <Text style={[styles.description, { color: palette.onSurfaceVariant }]}>
            {t('versions.summary', { count: detail.volumes.length, title: detail.title })}
          </Text>
          <View style={styles.versionList}>
            {detail.volumes.map((version) => {
              const isCurrent = version.id === bookId;
              return (
                <Pressable
                  accessibilityLabel={t('versions.accessibility', {
                    current: isCurrent ? t('versions.currentAccessibilitySuffix') : '',
                    title: version.title,
                  })}
                  accessibilityRole="button"
                  key={version.id}
                  onPress={() => openVersion(
                    version.id,
                    version.title,
                    version.coverUrl,
                    version.coverPlaceholder,
                  )}
                  style={({ pressed }) => [
                    styles.versionRow,
                    { backgroundColor: palette.surfaceContainerHighest },
                    pressed && styles.pressed,
                  ]}
                >
                  <PublicUserAvatar
                    avatarUrl={version.uploader.avatarUrl}
                    fallbackBackground={palette.surfaceContainerHighest}
                    fallbackColor={palette.onSurface}
                    size={40}
                    userId={version.uploader.id}
                    userName={version.uploader.userName}
                  />
                  <View style={styles.versionText}>
                    <Text numberOfLines={2} style={[styles.versionTitle, { color: palette.onSurface }]}>
                      {version.title}
                    </Text>
                    <Text style={[styles.versionMeta, { color: palette.onSurfaceVariant }]}>
                      {version.uploader.userName.trim() || t('versions.unknownUploader')} ·{' '}
                      {t('versions.chapterCount', { count: version.chapters.length })}
                    </Text>
                  </View>
                  {isCurrent ? (
                    <View
                      style={[
                        styles.currentBadge,
                        { backgroundColor: palette.primaryContainer },
                      ]}
                    >
                      <IconCheck color={palette.onPrimaryContainer} size={16} strokeWidth={2.4} />
                      <Text style={[styles.currentLabel, { color: palette.onPrimaryContainer }]}>
                        {t('versions.current')}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48, paddingHorizontal: 24, paddingTop: 28 },
  currentBadge: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  currentLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, lineHeight: 15 },
  description: { fontSize: 13, lineHeight: 18 },
  errorText: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  pressed: { opacity: 0.68 },
  retryButton: { alignItems: 'center', flexDirection: 'row', gap: 7, padding: 8 },
  retryLabel: { fontSize: 15, fontWeight: '600' },
  scroll: {},
  sheetHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sheetSection: { gap: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  state: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  versionList: { borderRadius: 16, overflow: 'hidden' },
  versionMeta: { fontSize: 13, lineHeight: 18 },
  versionRow: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    gap: 6,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  versionText: { flex: 1, gap: 3 },
  versionTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
});

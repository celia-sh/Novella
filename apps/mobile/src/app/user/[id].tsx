import {
  IconArrowBackUp,
  IconBook,
  IconMessage,
  IconMessages,
  IconRefresh,
  IconUserCircle,
} from '@tabler/icons-react-native';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PublicUserAvatar } from '@/components/public-user-avatar';
import { usePublicUserProfile } from '@/hooks/use-public-user-profile';
import { formatDate } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { createThemedStyles, resolveAccentHex, useAppTheme } from '@/theme/app-theme';

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = Number(id);
  return <PublicUserProfileContent userId={userId} />;
}

function PublicUserProfileContent({ userId }: { userId: number }) {
  const styles = usePublicUserProfileStyles();
  const { colors } = useAppTheme();
  const locale = useAppLocale();
  const { t } = useTranslation('user');
  const { error, isLoading, reload, summary } = usePublicUserProfile(userId);
  const numberFormatter = new Intl.NumberFormat(locale);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      {isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={resolveAccentHex(colors.accent)} />
          <Text style={styles.stateText}>{t('profile.loading')}</Text>
        </View>
      ) : null}
      {!isLoading && error ? (
        <View style={styles.state}>
          <IconUserCircle color={colors.secondaryLabel as string} size={44} strokeWidth={1.5} />
          <Text style={styles.stateText}>{t('profile.loadFailed')}</Text>
          <Pressable
            accessibilityLabel={t('profile.retry')}
            accessibilityRole="button"
            onPress={() => void reload()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <IconRefresh color={resolveAccentHex(colors.accent)} size={18} strokeWidth={2} />
            <Text style={styles.retryLabel}>{t('profile.retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      {!isLoading && !error && summary ? (
        <View style={styles.profile}>
          <View style={styles.identity}>
            <PublicUserAvatar
              avatarUrl={summary.avatarUrl}
              size={80}
              userId={0}
              userName={summary.userName}
            />
            <View style={styles.identityCopy}>
              <Text style={styles.userName}>{summary.userName}</Text>
              <View style={styles.identityLine}>
                <Text style={styles.role}>{summary.role}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.meta}>{t('profile.level', { level: numberFormatter.format(summary.level) })}</Text>
              </View>
              <Text style={styles.joinedAt}>
                {t('profile.joinedAt', {
                  date: formatDate(summary.registeredAt, locale, { dateStyle: 'medium' }),
                })}
              </Text>
            </View>
          </View>
          <View style={styles.stats}>
            <ProfileStat
              icon={<IconBook color={resolveAccentHex(colors.accent)} size={20} strokeWidth={2} />}
              label={t('profile.stats.books')}
              value={numberFormatter.format(summary.bookCount)}
            />
            <ProfileStat
              icon={<IconMessages color={resolveAccentHex(colors.accent)} size={20} strokeWidth={2} />}
              label={t('profile.stats.threads')}
              value={numberFormatter.format(summary.communityThreadCount)}
            />
            <ProfileStat
              icon={<IconArrowBackUp color={resolveAccentHex(colors.accent)} size={20} strokeWidth={2} />}
              label={t('profile.stats.replies')}
              value={numberFormatter.format(summary.communityReplyCount)}
            />
            <ProfileStat
              icon={<IconMessage color={resolveAccentHex(colors.accent)} size={20} strokeWidth={2} />}
              label={t('profile.stats.comments')}
              value={numberFormatter.format(summary.commentCount)}
            />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ProfileStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  const styles = usePublicUserProfileStyles();
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const usePublicUserProfileStyles = createThemedStyles((colors) => ({
  content: { flexGrow: 1, paddingBottom: 44, paddingHorizontal: 24, paddingTop: 32 },
  dot: { color: colors.secondaryLabel, fontSize: 14 },
  identity: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', gap: 18 },
  identityCopy: { flex: 1, minWidth: 0 },
  identityLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  joinedAt: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 19, marginTop: 6 },
  meta: { color: colors.secondaryLabel, fontSize: 14, lineHeight: 20 },
  profile: { alignItems: 'stretch' },
  pressed: { opacity: 0.68 },
  retryButton: { alignItems: 'center', flexDirection: 'row', gap: 7, padding: 8 },
  retryLabel: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  root: { flex: 1 },
  role: { color: colors.label, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  stat: {
    alignItems: 'center', backgroundColor: colors.card, borderColor: colors.separator,
    borderCurve: 'continuous', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
    gap: 5, justifyContent: 'center', minHeight: 96, paddingHorizontal: 8, paddingVertical: 12,
    width: '48%',
  },
  statLabel: { color: colors.secondaryLabel, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  statValue: { color: colors.label, fontSize: 20, fontVariant: ['tabular-nums'], fontWeight: '700', lineHeight: 25 },
  stats: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginTop: 28 },
  state: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', minHeight: 280 },
  stateText: { color: colors.secondaryLabel, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  userName: { color: colors.label, fontSize: 22, fontWeight: '700', lineHeight: 29 },
}));

import { IconMail, IconPencil, IconRefresh, IconUserCircle } from '@tabler/icons-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HorizontalSafeArea } from '@/components/horizontal-safe-area';
import { PublicUserAvatar } from '@/components/public-user-avatar';
import { useProfile } from '@/hooks/use-profile';
import { usePublicUserProfile } from '@/hooks/use-public-user-profile';
import { formatDate } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { createThemedStyles, resolveAccentHex, useAppTheme } from '@/theme/app-theme';

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = Number(id);
  return <PublicUserProfileContent userId={userId} />;
}

/**
 * Profile sheet opened from avatars. It opens at half height, so everything
 * that matters — who this is, what they have done, and the one action — fits
 * above that detent: identity beside the avatar, the four counts in a single
 * row, then the action. Your own profile offers editing instead of a private
 * message to yourself.
 */
function PublicUserProfileContent({ userId }: { userId: number }) {
  const styles = usePublicUserProfileStyles();
  const { colors } = useAppTheme();
  const locale = useAppLocale();
  const { t } = useTranslation('user');
  const { error, isLoading, reload, summary } = usePublicUserProfile(userId);
  const { profile } = useProfile();
  const numberFormatter = new Intl.NumberFormat(locale);
  const isSelf = summary !== null && profile?.id === summary.id;

  return (
    <HorizontalSafeArea style={[styles.root, { backgroundColor: colors.background }]}>
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      style={styles.list}
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
              size={72}
              userId={0}
              userName={summary.userName}
            />
            <View style={styles.identityCopy}>
              <Text numberOfLines={1} style={styles.userName}>{summary.userName}</Text>
              <View style={styles.tags}>
                {isSelf ? <Tag accent label={t('profile.you')} /> : null}
                {summary.role ? <Tag label={summary.role} /> : null}
                <Tag label={t('profile.level', { level: numberFormatter.format(summary.level) })} />
              </View>
              <Text style={styles.joinedAt}>
                {t('profile.joinedAt', {
                  date: formatDate(summary.registeredAt, locale, { dateStyle: 'medium' }),
                })}
              </Text>
            </View>
          </View>
          <View style={styles.stats}>
            {[
              { label: t('profile.stats.books'), value: summary.bookCount },
              { label: t('profile.stats.threads'), value: summary.communityThreadCount },
              { label: t('profile.stats.replies'), value: summary.communityReplyCount },
              { label: t('profile.stats.comments'), value: summary.commentCount },
            ].map((stat, index) => (
              <Fragment key={stat.label}>
                {index > 0 ? <View style={styles.statDivider} /> : null}
                <View accessible accessibilityLabel={`${stat.label} ${stat.value}`} style={styles.stat}>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statValue}>
                    {numberFormatter.format(stat.value)}
                  </Text>
                  <Text numberOfLines={1} style={styles.statLabel}>{stat.label}</Text>
                </View>
              </Fragment>
            ))}
          </View>
          {isSelf ? (
            <Pressable
              accessibilityLabel={t('profile.editProfile')}
              accessibilityRole="button"
              onPress={() => router.push('/settings/profile')}
              style={({ pressed }) => [styles.action, styles.secondaryAction, pressed && styles.pressed]}
            >
              <IconPencil color={resolveAccentHex(colors.accent)} size={19} strokeWidth={2} />
              <Text style={styles.secondaryActionText}>{t('profile.editProfile')}</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel={t('profile.sendMessage')}
              accessibilityRole="button"
              onPress={() => router.push(`/messages/${summary.id}`)}
              style={({ pressed }) => [styles.action, styles.primaryAction, pressed && styles.pressed]}
            >
              <IconMail color="#FFFFFF" size={19} strokeWidth={2} />
              <Text style={styles.primaryActionText}>{t('profile.sendMessage')}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </ScrollView>
    </HorizontalSafeArea>
  );
}

function Tag({ accent = false, label }: { accent?: boolean; label: string }) {
  const styles = usePublicUserProfileStyles();
  return (
    <View style={[styles.tag, accent && styles.accentTag]}>
      <Text numberOfLines={1} style={[styles.tagText, accent && styles.accentTagText]}>{label}</Text>
    </View>
  );
}

const usePublicUserProfileStyles = createThemedStyles((colors) => ({
  accentTag: { backgroundColor: colors.primaryContainer },
  accentTagText: { color: colors.onPrimaryContainer },
  action: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  content: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 20, paddingTop: 28 },
  identity: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  identityCopy: { flex: 1, gap: 6, minWidth: 0 },
  joinedAt: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 18 },
  list: { flex: 1 },
  pressed: { opacity: 0.68 },
  primaryAction: { backgroundColor: colors.accent },
  primaryActionText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  profile: { alignItems: 'stretch' },
  retryButton: { alignItems: 'center', flexDirection: 'row', gap: 7, padding: 8 },
  retryLabel: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  root: { flex: 1 },
  secondaryAction: { backgroundColor: colors.card },
  secondaryActionText: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  stat: { alignItems: 'center', flex: 1, gap: 2, minWidth: 0, paddingHorizontal: 4 },
  statDivider: {
    alignSelf: 'stretch',
    backgroundColor: colors.separator,
    marginVertical: 4,
    width: StyleSheet.hairlineWidth,
  },
  statLabel: { color: colors.secondaryLabel, fontSize: 12, lineHeight: 16 },
  statValue: {
    color: colors.label,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    lineHeight: 25,
  },
  stats: {
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    marginTop: 20,
    paddingVertical: 14,
  },
  state: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', minHeight: 240 },
  stateText: { color: colors.secondaryLabel, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  tag: {
    backgroundColor: colors.surfaceContainerHighest,
    borderCurve: 'continuous',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: { color: colors.secondaryLabel, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  tags: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  userName: { color: colors.label, fontSize: 22, fontWeight: '700', lineHeight: 28 },
}));

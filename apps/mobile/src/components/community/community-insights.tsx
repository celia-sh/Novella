import {
  IconChevronRight,
  IconFlame,
  IconTrophy,
} from '@tabler/icons-react-native';
import { Divider, Surface, TouchableRipple } from 'react-native-paper';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  CommunityActiveUserItem,
  CommunityHotRankItem,
} from '@novella/api-client';

import { PublicUserAvatar } from '@/components/public-user-avatar';
import { useAppLocale } from '@/localization/localization-provider';
import {
  formatCommunityCount,
  formatCommunityTime,
} from '@/services/community-utils';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

const RANK_COLORS = ['#F59E0B', '#FB7185', '#60A5FA'];

export function CommunityHotDiscussions({
  items,
  onOpenThread,
}: {
  items: CommunityHotRankItem[];
  onOpenThread(item: CommunityHotRankItem): void;
}) {
  const styles = useCommunityInsightsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();

  return (
    <Surface elevation={0} style={styles.surface}>
      <View style={styles.body}>
        <View style={styles.header}>
          <IconFlame color={colors.accent as string} size={18} strokeWidth={2} />
          <Text style={styles.title}>{t('insights.hotDiscussions')}</Text>
        </View>
        {items.map((thread, index) => (
          <View key={thread.id}>
            {index > 0 ? <Divider style={styles.divider} /> : null}
            <TouchableRipple
              accessibilityLabel={t('accessibility.openThread', { title: thread.title })}
              accessibilityRole="button"
              borderless
              onPress={() => onOpenThread(thread)}
              style={styles.ripple}
            >
              <View style={styles.row}>
                <CommunityRankBadge rank={index + 1} />
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={styles.rowTitle}>{thread.title}</Text>
                  <Text numberOfLines={2} style={styles.rowSubtitle}>
                    {thread.boardName} · {t('insights.heat', { countLabel: formatCommunityCount(thread.heat, locale) })} · {formatCommunityTime(thread.publishedAt, locale)}
                  </Text>
                </View>
                <IconChevronRight color={colors.secondaryLabel as string} size={18} strokeWidth={2} />
              </View>
            </TouchableRipple>
          </View>
        ))}
      </View>
    </Surface>
  );
}

export function CommunityActiveMembers({ users }: { users: CommunityActiveUserItem[] }) {
  const styles = useCommunityInsightsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();

  return (
    <Surface elevation={0} style={styles.surface}>
      <View style={styles.body}>
        <View style={styles.header}>
          <IconTrophy color={colors.accent as string} size={18} strokeWidth={2} />
          <Text style={styles.title}>{t('insights.activeMembers')}</Text>
        </View>
        {users.map((user, index) => (
          <View key={user.id}>
            {index > 0 ? <Divider style={styles.divider} /> : null}
            <View style={styles.row}>
              <PublicUserAvatar
                avatarUrl={user.avatar}
                size={36}
                userId={user.id}
                userName={user.name}
              />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.rowTitle}>{user.name}</Text>
                <Text numberOfLines={2} style={styles.rowSubtitle}>
                  {user.summary || user.badge || t('insights.communityMember')}
                </Text>
              </View>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>{formatCommunityCount(user.score, locale)}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </Surface>
  );
}

export function CommunityRankBadge({ rank }: { rank: number }) {
  const styles = useCommunityInsightsStyles();
  const { colors } = useAppTheme();
  const fixedColor = RANK_COLORS[rank - 1] ?? null;
  return (
    <View
      style={[
        styles.rankBadge,
        { backgroundColor: fixedColor ? `${fixedColor}26` : colors.surfaceContainerHighest },
      ]}
    >
      <Text style={[styles.rankText, { color: fixedColor ?? colors.accent }]}>{rank}</Text>
    </View>
  );
}

const useCommunityInsightsStyles = createThemedStyles((colors) => ({
  body: { paddingHorizontal: 14, paddingVertical: 12 },
  copy: { flex: 1 },
  divider: { backgroundColor: colors.separator },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 2 },
  rankBadge: { alignItems: 'center', borderRadius: 14, height: 36, justifyContent: 'center', width: 36 },
  rankText: { fontSize: 15, fontWeight: '800' },
  ripple: { borderCurve: 'continuous', borderRadius: 14 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 8 },
  rowSubtitle: { color: colors.secondaryLabel, fontSize: 12, lineHeight: 16, marginTop: 2 },
  rowTitle: { color: colors.label, fontSize: 14, fontWeight: '600' },
  scoreBadge: { backgroundColor: colors.primaryContainer, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  scoreText: { color: colors.onPrimaryContainer, fontSize: 12, fontWeight: '700' },
  surface: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  title: { color: colors.label, fontSize: 16, fontWeight: '700' },
}));

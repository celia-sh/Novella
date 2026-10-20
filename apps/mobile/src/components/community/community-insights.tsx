import {
  IconChevronRight,
  IconFlame,
  IconTrophy,
} from '@tabler/icons-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  CommunityActiveUserItem,
  CommunityHotRankItem,
} from '@novella/api-client';

import { COMMUNITY_CARD_RADIUS } from '@/components/community/community-ui';
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
    <View>
      <View style={styles.header}>
        <IconFlame color={colors.secondaryLabel as string} size={16} strokeWidth={2} />
        <Text style={styles.title}>{t('insights.hotDiscussions')}</Text>
      </View>
      <View style={styles.group}>
        {items.map((thread, index) => (
          <Pressable
            accessibilityLabel={t('accessibility.openThread', { title: thread.title })}
            accessibilityRole="button"
            key={thread.id}
            onPress={() => onOpenThread(thread)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <CommunityRankBadge rank={index + 1} />
            <View style={[styles.rowBody, index < items.length - 1 && styles.rowSeparator]}>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.rowTitle}>{thread.title}</Text>
                <Text numberOfLines={2} style={styles.rowSubtitle}>
                  {thread.boardName} · {t('insights.heat', { countLabel: formatCommunityCount(thread.heat, locale) })} · {formatCommunityTime(thread.publishedAt, locale)}
                </Text>
              </View>
              <IconChevronRight color={colors.secondaryLabel as string} size={18} strokeWidth={2} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function CommunityActiveMembers({ users }: { users: CommunityActiveUserItem[] }) {
  const styles = useCommunityInsightsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();

  return (
    <View>
      <View style={styles.header}>
        <IconTrophy color={colors.secondaryLabel as string} size={16} strokeWidth={2} />
        <Text style={styles.title}>{t('insights.activeMembers')}</Text>
      </View>
      <View style={styles.group}>
        {users.map((user, index) => (
          <View key={user.id} style={styles.row}>
            <PublicUserAvatar
              avatarUrl={user.avatar}
              size={36}
              userId={user.id}
              userName={user.name}
            />
            <View style={[styles.rowBody, index < users.length - 1 && styles.rowSeparator]}>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.rowTitle}>{user.name}</Text>
                <Text numberOfLines={2} style={styles.rowSubtitle}>
                  {user.summary || user.badge || t('insights.communityMember')}
                </Text>
              </View>
              <Text style={styles.scoreText}>{formatCommunityCount(user.score, locale)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
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
  copy: { flex: 1, gap: 2 },
  group: { backgroundColor: colors.card, borderCurve: 'continuous', borderRadius: COMMUNITY_CARD_RADIUS, overflow: 'hidden' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 6, marginBottom: 8, paddingHorizontal: 4 },
  rankBadge: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  rankText: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '700' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingLeft: 14 },
  rowBody: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, paddingRight: 14, paddingVertical: 11 },
  rowPressed: { backgroundColor: colors.surfaceContainerHighest },
  rowSeparator: { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth },
  rowSubtitle: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 18 },
  rowTitle: { color: colors.label, fontSize: 16 },
  scoreText: { color: colors.secondaryLabel, fontSize: 15, fontVariant: ['tabular-nums'] },
  title: { color: colors.secondaryLabel, fontSize: 13, fontWeight: '600' },
}));

import { IconFlame } from '@tabler/icons-react-native';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import {
  CommunityActiveMembers,
  CommunityHotDiscussions,
} from '@/components/community/community-insights';
import { useCachedCommunityHome } from '@/hooks/community-home-cache';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export function CommunityRankingsScreen() {
  const styles = useCommunityRankingsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const home = useCachedCommunityHome();

  const openThread = (item: { id: number }) => {
    router.push({
      pathname: '/thread/[id]',
      params: { id: String(item.id) },
    });
  };

  return (
    <NativeScreenScaffold
      largeTitle={false}
      onBackPress={() => router.back()}
      showBackButton
      title={t('rankings.title')}
    >
      <ScrollView
        alwaysBounceVertical
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={styles.root}
      >
        {home ? (
          <View style={styles.body}>
            {home.hotThreads.length > 0 ? (
              <CommunityHotDiscussions items={home.hotThreads} onOpenThread={openThread} />
            ) : null}
            {home.activeUsers.length > 0 ? (
              <CommunityActiveMembers users={home.activeUsers} />
            ) : null}
          </View>
        ) : (
          <View style={styles.empty}>
            <IconFlame color={colors.accent as string} size={26} strokeWidth={2} />
            <Text style={styles.emptyTitle}>{t('rankings.emptyTitle')}</Text>
            <Text style={styles.emptyDescription}>{t('rankings.emptyDescription')}</Text>
          </View>
        )}
      </ScrollView>
    </NativeScreenScaffold>
  );
}

const useCommunityRankingsStyles = createThemedStyles((colors) => ({
  body: { gap: 16 },
  content: { paddingBottom: 44, paddingHorizontal: 12, paddingTop: 8 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 96 },
  emptyDescription: {
    color: colors.secondaryLabel,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 260,
    textAlign: 'center',
  },
  emptyTitle: { color: colors.label, fontSize: 16, fontWeight: '700' },
  root: { backgroundColor: colors.background, flex: 1 },
}));

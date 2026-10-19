import { IconHeart, IconMessageCircle } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import type {
  CommunityFeedItem,
  CommunityMyReplyItem,
} from "@novella/api-client";

import {
  COMMUNITY_CARD_RADIUS,
  CommunityEmptyState,
  CommunityErrorState,
  CommunityThreadCard,
  CommunityThreadSkeleton,
} from "@/components/community/community-ui";
import { HorizontalSafeArea } from "@/components/horizontal-safe-area";
import {
  NativeSegmentedControl,
  type NativeSegmentedControlOption,
} from "@/components/native-segmented-control";
import { useMyCommunity } from "@/hooks/use-my-community";
import { usePageMargin } from "@/hooks/use-wide-layout";
import { useAppLocale } from "@/localization/localization-provider";
import { formatCommunityTime } from "@/services/community-utils";
import { createThemedStyles, useAppTheme } from "@/theme/app-theme";

type MyCommunityTab = "published" | "participated" | "favorites";

export function MyCommunityScreen() {
  const styles = useMyCommunityStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation("community");
  const locale = useAppLocale();
  const pageMargin = usePageMargin();
  const [tab, setTab] = useState<MyCommunityTab>("published");
  const { error, load, loading, overview, refresh, refreshing } =
    useMyCommunity();

  const threads =
    tab === "published"
      ? (overview?.publishedThreads ?? [])
      : (overview?.favoriteThreads ?? []);
  const replies = overview?.participatedReplies ?? [];
  const numberFormatter = new Intl.NumberFormat(locale);
  const tabOptions: readonly NativeSegmentedControlOption<MyCommunityTab>[] = [
    { label: t("myCommunity.tabs.published"), value: "published" },
    { label: t("myCommunity.tabs.participated"), value: "participated" },
    { label: t("myCommunity.tabs.favorites"), value: "favorites" },
  ];
  const localizedError = error ? t("myCommunity.loadError") : null;

  return (
    <HorizontalSafeArea style={styles.root}>
        <ScrollView
          alwaysBounceVertical
          contentContainerStyle={[styles.content, { paddingHorizontal: pageMargin }]}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              colors={[colors.accent as string]}
              onRefresh={() => void refresh()}
              refreshing={refreshing}
              tintColor={colors.accent as string}
            />
          }
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {overview ? (
            <View style={styles.profile}>
              <Text style={styles.title}>
                {overview.authorName || t("myCommunity.title")}
              </Text>
              <Text style={styles.summary}>
                {t("myCommunity.summary", {
                  favorites: numberFormatter.format(overview.favoriteThreads.length),
                  published: numberFormatter.format(overview.publishedThreads.length),
                  replies: numberFormatter.format(overview.participatedReplies.length),
                })}
              </Text>
            </View>
          ) : null}

          <View style={styles.segmented}>
            <NativeSegmentedControl<MyCommunityTab>
              enabled={!loading}
              onValueChange={setTab}
              options={tabOptions}
              selectedValue={tab}
            />
          </View>

          {loading && !overview ? (
            <View style={styles.list}>
              <CommunityThreadSkeleton />
              <CommunityThreadSkeleton />
              <CommunityThreadSkeleton />
            </View>
          ) : localizedError && !overview ? (
            <CommunityErrorState
              description={localizedError}
              onRetry={() => void load()}
              title={t("myCommunity.loadErrorTitle")}
            />
          ) : tab === "participated" ? (
            replies.length === 0 ? (
              <CommunityEmptyState
                description={t("myCommunity.participatedEmptyDescription")}
                title={t("myCommunity.participatedEmptyTitle")}
              />
            ) : (
              <View style={styles.list}>
                {replies.map((reply) => (
                  <MyReplyCard key={reply.id} reply={reply} />
                ))}
              </View>
            )
          ) : threads.length === 0 ? (
            <CommunityEmptyState
              description={
                tab === "published"
                  ? t("myCommunity.publishedEmptyDescription")
                  : t("myCommunity.favoritesEmptyDescription")
              }
              title={
                tab === "published"
                  ? t("myCommunity.publishedEmptyTitle")
                  : t("myCommunity.favoritesEmptyTitle")
              }
            />
          ) : (
            <View style={styles.list}>
              {threads.map((thread) => (
                <MyThreadCard key={thread.id} thread={thread} />
              ))}
            </View>
          )}
        </ScrollView>
    </HorizontalSafeArea>
  );
}

function MyThreadCard({ thread }: { thread: CommunityFeedItem }) {
  return (
    <CommunityThreadCard
      item={thread}
      onPress={() =>
        router.push({
          pathname: "/thread/[id]",
          params: { id: String(thread.id) },
        })
      }
    />
  );
}

function MyReplyCard({ reply }: { reply: CommunityMyReplyItem }) {
  const styles = useMyCommunityStyles();
  const { t } = useTranslation("community");
  const locale = useAppLocale();
  return (
    <Pressable
      accessibilityLabel={t("accessibility.openThread", {
        title: reply.threadTitle,
      })}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/thread/[id]",
          params: {
            id: String(reply.threadId),
            replyId: String(reply.id),
          },
        })
      }
      style={({ pressed }) => [styles.replyCard, pressed && styles.replyCardPressed]}
    >
      <View style={styles.replyHeader}>
        <Text numberOfLines={1} style={styles.boardLabel}>{reply.boardName}</Text>
        <Text style={styles.time}>
          {formatCommunityTime(reply.publishedAt, locale)}
        </Text>
      </View>
      <Text numberOfLines={2} style={styles.replyTitle}>
        {reply.threadTitle}
      </Text>
      {reply.replyToName ? (
        <Text style={styles.replyTo}>{t("labels.replyingTo", { name: reply.replyToName })}</Text>
      ) : null}
      <Text numberOfLines={4} style={styles.replyContent}>
        {reply.content}
      </Text>
      <View style={styles.replyMetrics}>
        <IconMessageCircle color={styles.metricIcon.color} size={15} />
        <Text style={styles.metricLabel}>{t("actions.openDiscussion")}</Text>
        <IconHeart color={styles.metricIcon.color} size={15} />
        <Text style={styles.metricLabel}>{reply.likes}</Text>
      </View>
    </Pressable>
  );
}

const useMyCommunityStyles = createThemedStyles((colors) => ({
  boardLabel: { color: colors.secondaryLabel, flex: 1, fontSize: 13 },
  content: { gap: 16, paddingBottom: 44, paddingTop: 8 },
  list: { gap: 12 },
  metricIcon: { color: colors.secondaryLabel },
  metricLabel: { color: colors.secondaryLabel, fontSize: 13, marginRight: 10 },
  profile: { gap: 4, paddingHorizontal: 4 },
  replyCard: {
    backgroundColor: colors.card,
    borderCurve: "continuous",
    borderRadius: COMMUNITY_CARD_RADIUS,
    gap: 8,
    padding: 16,
  },
  replyCardPressed: { backgroundColor: colors.surfaceContainerHighest },
  replyContent: { color: colors.label, fontSize: 15, lineHeight: 22 },
  replyHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  replyMetrics: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 2 },
  replyTitle: { color: colors.label, fontSize: 17, fontWeight: "600", lineHeight: 23 },
  replyTo: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  root: { backgroundColor: colors.background, flex: 1 },
  scroll: { flex: 1 },
  segmented: { minHeight: 48, width: "100%" },
  summary: { color: colors.secondaryLabel, fontSize: 15 },
  time: { color: colors.secondaryLabel, fontSize: 13 },
  title: { color: colors.label, fontSize: 26, fontWeight: "700" },
}));

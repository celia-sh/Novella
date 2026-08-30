import { IconHeart, IconMessageCircle } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { Card, Chip } from "react-native-paper";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
  CommunityEmptyState,
  CommunityErrorState,
  CommunityPaperProvider,
  CommunityThreadCard,
} from "@/components/community/community-ui";
import {
  NativeSegmentedControl,
  type NativeSegmentedControlOption,
} from "@/components/native-segmented-control";
import { useMyCommunity } from "@/hooks/use-my-community";
import { useAppLocale } from "@/localization/localization-provider";
import { formatCommunityTime } from "@/services/community-utils";
import { createThemedStyles, useAppTheme } from "@/theme/app-theme";

type MyCommunityTab = "published" | "participated" | "favorites";

export function MyCommunityScreen() {
  const styles = useMyCommunityStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation("community");
  const locale = useAppLocale();
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
    <CommunityPaperProvider>

        <ScrollView
          alwaysBounceVertical
          contentContainerStyle={styles.content}
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
          style={styles.root}
        >
          {overview ? (
            <Card mode="outlined" style={styles.profileCard}>
              <Card.Content style={styles.profileBody}>
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
              </Card.Content>
            </Card>
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
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.accent as string} size="large" />
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

    </CommunityPaperProvider>
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
          },
        })
      }
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card mode="outlined" style={styles.replyCard}>
        <Card.Content style={styles.replyBody}>
          <View style={styles.replyHeader}>
            <Chip
              compact
              mode="flat"
              style={styles.boardChip}
              textStyle={styles.boardChipText}
            >
              {reply.boardName}
            </Chip>
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
        </Card.Content>
      </Card>
    </Pressable>
  );
}

const useMyCommunityStyles = createThemedStyles((colors) => ({
  boardChip: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 999,
  },
  boardChipText: {
    color: colors.onPrimaryContainer,
    fontSize: 11,
    fontWeight: "700",
  },
  content: { gap: 16, paddingBottom: 44, paddingHorizontal: 12, paddingTop: 8 },
  list: { gap: 12 },
  loadingState: { alignItems: "center", justifyContent: "center", minHeight: 240 },
  metricIcon: { color: colors.secondaryLabel },
  metricLabel: { color: colors.secondaryLabel, fontSize: 12 },
  pressed: { opacity: 0.68 },
  profileBody: { gap: 5, padding: 17 },
  profileCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: "continuous",
    borderRadius: 20,
  },
  replyBody: { gap: 9, padding: 15 },
  replyCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: "continuous",
    borderRadius: 20,
  },
  replyContent: { color: colors.label, fontSize: 14, lineHeight: 21 },
  replyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  replyMetrics: { alignItems: "center", flexDirection: "row", gap: 5 },
  replyTitle: {
    color: colors.label,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  replyTo: { color: colors.accent, fontSize: 12, fontWeight: "600" },
  root: { backgroundColor: colors.background, flex: 1 },
  segmented: { minHeight: 48, width: "100%" },
  summary: { color: colors.secondaryLabel, fontSize: 13 },
  time: { color: colors.secondaryLabel, fontSize: 12 },
  title: { color: colors.label, fontSize: 23, fontWeight: "800" },
}));

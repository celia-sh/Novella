import {
  IconAlertCircle,
  IconEye,
  IconHeart,
  IconLock,
  IconMessageCircle,
  IconMessages,
  IconPin,
  IconRefresh,
  IconStar,
} from "@tabler/icons-react-native";
import { Skeleton } from 'panelui-native/components/skeleton';
import type { ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import type { CommunityFeedItem } from "@novella/api-client";

import { PublicUserAvatar } from "@/components/public-user-avatar";
import { useScrollGuardedPress } from "@/hooks/use-scroll-press-guard";
import { useAppLocale } from "@/localization/localization-provider";
import {
  formatCommunityCount,
  formatCommunityTime,
} from "@/services/community-utils";
import { createThemedStyles, useAppTheme } from "@/theme/app-theme";

const FEATURED_AMBER = "#F59E0B";

export function CommunityThreadCard({
  item,
  onPress,
  style,
}: {
  item: CommunityFeedItem;
  onPress(): void;
  /** Lets a grid stretch cards in the same row to one height. */
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useCommunityUiStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation("community");
  const locale = useAppLocale();
  const authorName = item.authorName
    || (item.authorIsDeleted ? t("labels.deletedUser") : t("labels.unknownUser"));
  const status = [
    item.pinned ? t("labels.pinned") : "",
    item.featured ? t("labels.featured") : "",
    item.locked ? t("labels.locked") : "",
  ].filter(Boolean).join("，");
  const boardLabel = [item.boardName, item.subCategoryLabel].filter(Boolean).join(" · ");
  const iconColor = colors.secondaryLabel as string;
  const press = useScrollGuardedPress(onPress);
  return (
    <Pressable
      accessibilityLabel={t("accessibility.thread", {
        author: item.authorIsDeleted ? t("labels.deletedUser") : item.authorName || t("labels.unknownAuthor"),
        board: item.boardName,
        replies: item.replies,
        status: status ? `，${status}` : "",
        title: item.title,
        views: item.views,
      })}
      accessibilityRole="button"
      {...press}
      style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <PublicUserAvatar
          avatarUrl={item.authorAvatar}
          size={24}
          userId={item.authorIsDeleted ? 0 : item.authorId}
          userName={authorName}
        />
        <Text numberOfLines={1} style={styles.authorLine}>
          <Text style={styles.authorName}>{authorName}</Text>
          {item.authorIsDeleted && item.authorName ? (
            <Text style={styles.deletedSuffix}>{t("labels.deletedSuffix")}</Text>
          ) : null}
          {` · ${formatCommunityTime(item.publishedAt, locale)}`}
        </Text>
        {boardLabel ? (
          <Text numberOfLines={1} style={styles.boardLabel}>{boardLabel}</Text>
        ) : null}
      </View>
      <View style={styles.titleRow}>
        {item.pinned ? (
          <IconPin color={colors.accent as string} size={15} strokeWidth={2.2} style={styles.titleIcon} />
        ) : null}
        {item.featured ? (
          <IconStar color={FEATURED_AMBER} size={15} strokeWidth={2.2} style={styles.titleIcon} />
        ) : null}
        {item.locked ? (
          <IconLock color={iconColor} size={14} strokeWidth={2.2} style={styles.titleIcon} />
        ) : null}
        <Text numberOfLines={2} style={styles.threadTitle}>{item.title}</Text>
      </View>
      {item.excerpt ? (
        <Text numberOfLines={2} style={styles.excerpt}>{item.excerpt}</Text>
      ) : null}
      <View style={styles.stats}>
        <TinyStat
          accessibilityLabel={t("accessibility.replies", { count: item.replies })}
          icon={<IconMessageCircle color={iconColor} size={14} />}
          value={formatCommunityCount(item.replies, locale)}
        />
        <TinyStat
          icon={<IconEye color={iconColor} size={14} />}
          value={formatCommunityCount(item.views, locale)}
        />
        <TinyStat
          icon={<IconHeart color={iconColor} size={14} />}
          value={formatCommunityCount(item.likes, locale)}
        />
      </View>
    </Pressable>
  );
}

export function CommunitySectionTitle({
  action,
  title,
}: {
  action?: ReactNode;
  title: string;
}) {
  const styles = useCommunityUiStyles();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function CommunityErrorState({
  description,
  onRetry,
  title,
}: {
  description: string;
  onRetry?: (() => void) | undefined;
  title?: string;
}) {
  const styles = useCommunityUiStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation("community");
  const { t: tCommon } = useTranslation("common");
  return (
    <View style={styles.state}>
      <IconAlertCircle color={colors.error as string} size={34} strokeWidth={1.7} />
      <Text style={styles.stateTitle}>{title ?? t("home.errors.loadTitle")}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.stateRetry, pressed && styles.pressed]}
        >
          <IconRefresh color={colors.accent as string} size={17} />
          <Text style={styles.stateRetryText}>{tCommon("actions.retry")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CommunityEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  const styles = useCommunityUiStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.state}>
      <IconMessages color={colors.secondaryLabel as string} size={34} strokeWidth={1.6} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
    </View>
  );
}

/** Mirrors CommunityThreadCard line for line, so the feed does not jump
 * when real cards replace it. */
export function CommunityThreadSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useCommunityUiStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.card, style]}
    >
      <View style={styles.cardHeader}>
        <Skeleton style={[styles.bone, styles.skeletonAvatar]} />
        <Skeleton style={[styles.bone, styles.skeletonMeta]} />
        <View style={styles.skeletonSpacer} />
        <Skeleton style={[styles.bone, styles.skeletonBoard]} />
      </View>
      <View style={styles.skeletonTitleSlot}>
        <Skeleton style={[styles.bone, styles.skeletonTitle]} />
      </View>
      <View style={styles.skeletonExcerpt}>
        <Skeleton style={[styles.bone, styles.skeletonTextLine]} />
        <Skeleton style={[styles.bone, styles.skeletonTextLine, styles.skeletonLineShort]} />
      </View>
      <View style={styles.stats}>
        <Skeleton style={[styles.bone, styles.skeletonStat]} />
        <Skeleton style={[styles.bone, styles.skeletonStat]} />
        <Skeleton style={[styles.bone, styles.skeletonStat]} />
      </View>
    </View>
  );
}

const POST_BODY_LINES = ['100%', '100%', '92%', '100%', '64%'] as const;

/** Stands in for a thread's post: board line, title, author, body, actions.
 * Sits on the page background, so its bones use the card colour. */
export function CommunityPostSkeleton() {
  const styles = useCommunityUiStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.post}
    >
      <Skeleton style={[styles.pageBone, styles.postBoard]} />
      <Skeleton style={[styles.pageBone, styles.postTitle]} />
      <View style={styles.postAuthor}>
        <Skeleton style={[styles.pageBone, styles.postAvatar]} />
        <View style={styles.postAuthorCopy}>
          <Skeleton style={[styles.pageBone, styles.postAuthorName]} />
          <Skeleton style={[styles.pageBone, styles.postAuthorTime]} />
        </View>
      </View>
      <View style={styles.postBody}>
        {POST_BODY_LINES.map((width, index) => (
          <Skeleton key={index} style={[styles.pageBone, styles.postLine, { width }]} />
        ))}
      </View>
      <View style={styles.postActions}>
        <Skeleton style={[styles.pageBone, styles.postAction]} />
        <Skeleton style={[styles.pageBone, styles.postAction]} />
      </View>
    </View>
  );
}

function TinyStat({
  accessibilityLabel,
  icon,
  value,
}: {
  accessibilityLabel?: string;
  icon: ReactNode;
  value: string;
}) {
  const styles = useCommunityUiStyles();
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.tinyStat}>
      {icon}
      <Text style={styles.tinyStatText}>{value}</Text>
    </View>
  );
}

export const COMMUNITY_CARD_RADIUS = 16;

const useCommunityUiStyles = createThemedStyles((colors) => ({
  // Bones on a card use the raised fill; bones on the page use the card fill.
  bone: { backgroundColor: colors.surfaceContainerHighest, borderRadius: 6 },
  pageBone: { backgroundColor: colors.card, borderRadius: 6 },
  authorLine: { color: colors.secondaryLabel, flex: 1, fontSize: 13 },
  authorName: { color: colors.label, fontWeight: "600" },
  boardLabel: { color: colors.secondaryLabel, flexShrink: 0, fontSize: 13, maxWidth: "45%" },
  card: {
    backgroundColor: colors.card,
    borderCurve: "continuous",
    borderRadius: COMMUNITY_CARD_RADIUS,
    gap: 8,
    padding: 16,
  },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardPressed: { backgroundColor: colors.surfaceContainerHighest },
  deletedSuffix: { color: colors.error, fontWeight: "600" },
  excerpt: { color: colors.secondaryLabel, fontSize: 15, lineHeight: 21 },
  post: { gap: 12 },
  postAction: { borderRadius: 18, height: 36, width: 72 },
  postActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  postAuthor: { alignItems: "center", flexDirection: "row", gap: 10 },
  postAuthorCopy: { gap: 6 },
  postAuthorName: { height: 14, width: 96 },
  postAuthorTime: { height: 11, width: 140 },
  postAvatar: { borderRadius: 18, height: 36, width: 36 },
  postBoard: { height: 13, width: 88 },
  postBody: { gap: 12, marginTop: 6 },
  postLine: { height: 15 },
  postTitle: { height: 28, width: "72%" },
  pressed: { opacity: 0.68 },
  sectionTitle: { color: colors.label, fontSize: 20, fontWeight: "700" },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  skeletonAvatar: { borderRadius: 12, height: 24, width: 24 },
  skeletonBoard: { height: 12, width: 64 },
  skeletonExcerpt: { gap: 7, paddingVertical: 2 },
  skeletonLineShort: { width: "62%" },
  skeletonMeta: { height: 12, width: 110 },
  skeletonSpacer: { flex: 1 },
  skeletonStat: { height: 12, width: 44 },
  skeletonTextLine: { height: 14, width: "100%" },
  skeletonTitle: { height: 17, width: "70%" },
  skeletonTitleSlot: { height: 23, justifyContent: "center" },
  state: { alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 40 },
  stateDescription: {
    color: colors.secondaryLabel,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  stateRetry: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 4, padding: 8 },
  stateRetryText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  stateTitle: { color: colors.label, fontSize: 17, fontWeight: "600", textAlign: "center" },
  stats: { flexDirection: "row", gap: 16, marginTop: "auto", paddingTop: 2 },
  threadTitle: {
    color: colors.label,
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 23,
  },
  tinyStat: { alignItems: "center", flexDirection: "row", gap: 4 },
  tinyStatText: {
    color: colors.secondaryLabel,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  titleIcon: { marginTop: 4 },
  titleRow: { alignItems: "flex-start", flexDirection: "row", gap: 4 },
}));

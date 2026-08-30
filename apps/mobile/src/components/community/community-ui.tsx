import {
  IconAlertCircle,
  IconBookmark,
  IconEye,
  IconHeart,
  IconLock,
  IconMessageCircle,
  IconMessages,
  IconPin,
  IconRefresh,
  IconStar,
} from "@tabler/icons-react-native";
import { Skeleton } from "heroui-native";
import {
  Button,
  Card,
  Chip,
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
} from "react-native-paper";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { CommunityFeedItem } from "@novella/api-client";

import { ProfileAvatar } from "@/components/profile-avatar";
import { useAppLocale } from "@/localization/localization-provider";
import {
  formatCommunityCount,
  formatCommunityTime,
} from "@/services/community-utils";
import {
  createThemedStyles,
  resolveAccentHex,
  resolveOnAccentHex,
  useAppTheme,
} from "@/theme/app-theme";
import { resolveStringColor } from "@/theme/color-values";

const FEATURED_AMBER = "#F59E0B";

export function CommunityPaperProvider({ children }: PropsWithChildren) {
  const { colorScheme, colors } = useAppTheme();
  const baseTheme = colorScheme === "dark" ? MD3DarkTheme : MD3LightTheme;
  const accent = resolveAccentHex(colors.accent);
  const onAccent = resolveOnAccentHex(colors.accent);
  const theme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      onPrimary: onAccent,
      onSecondaryContainer: resolveStringColor(colors.onPrimaryContainer, onAccent),
      primary: accent,
      secondaryContainer: resolveStringColor(colors.primaryContainer, accent),
    },
  };

  return <PaperProvider theme={theme}>{children}</PaperProvider>;
}

export function CommunityThreadCard({
  item,
  onPress,
}: {
  item: CommunityFeedItem;
  onPress(): void;
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
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <ProfileAvatar
              avatarUrl={item.authorAvatar}
              size={42}
              userName={authorName}
            />
            <View style={styles.cardMain}>
              <View style={styles.titleRow}>
                {item.pinned ? (
                  <IconPin
                    color={colors.accent as string}
                    size={15}
                    strokeWidth={2.4}
                  />
                ) : null}
                {item.featured ? (
                  <IconStar
                    color={FEATURED_AMBER}
                    size={15}
                    strokeWidth={2.4}
                  />
                ) : null}
                {item.locked ? (
                  <IconLock
                    color={colors.secondaryLabel as string}
                    size={14}
                    strokeWidth={2.4}
                  />
                ) : null}
                <Text numberOfLines={2} style={styles.threadTitle}>
                  {item.title}
                </Text>
                {item.replies > 0 ? (
                  <View
                    accessibilityLabel={t("accessibility.replies", { count: item.replies })}
                    style={styles.replyBadge}
                  >
                    <IconMessageCircle
                      color={colors.secondaryLabel as string}
                      size={13}
                    />
                    <Text style={styles.replyBadgeText}>
                      {formatCommunityCount(item.replies, locale)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {item.excerpt ? (
                <Text numberOfLines={2} style={styles.excerpt}>
                  {item.excerpt}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                <Chip
                  compact
                  mode="flat"
                  style={styles.accentChip}
                  textStyle={styles.accentChipText}
                >
                  {item.boardName}
                </Chip>
                {item.subCategoryLabel ? (
                  <Chip
                    compact
                    mode="flat"
                    style={styles.metaChip}
                    textStyle={styles.metaChipText}
                  >
                    {item.subCategoryLabel}
                  </Chip>
                ) : null}
              </View>
              <View style={styles.authorRow}>
                <Text numberOfLines={1} style={styles.authorLine}>
                  <Text style={styles.authorName}>{authorName}</Text>
                  {item.authorIsDeleted && item.authorName ? (
                    <Text style={styles.deletedSuffix}>{t("labels.deletedSuffix")}</Text>
                  ) : null}
                  <Text style={styles.timeSeparator}>
                    {" · "}
                    {formatCommunityTime(item.publishedAt, locale)}
                  </Text>
                </Text>
                <View style={styles.tinyStats}>
                  <TinyStat
                    icon={
                      <IconEye
                        color={colors.secondaryLabel as string}
                        size={14}
                      />
                    }
                    value={formatCommunityCount(item.views, locale)}
                  />
                  <TinyStat
                    icon={
                      <IconHeart
                        color={colors.secondaryLabel as string}
                        size={14}
                      />
                    }
                    value={formatCommunityCount(item.likes, locale)}
                  />
                  {item.favorites > 0 ? (
                    <TinyStat
                      icon={
                        <IconBookmark
                          color={colors.secondaryLabel as string}
                          size={14}
                        />
                      }
                      value={formatCommunityCount(item.favorites, locale)}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
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
  onRetry(): void;
  title?: string;
}) {
  const styles = useCommunityUiStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation("community");
  const { t: tCommon } = useTranslation("common");
  return (
    <Card mode="outlined" style={styles.stateCard}>
      <Card.Content style={styles.stateBody}>
        <View style={styles.stateIconBox}>
          <IconAlertCircle color={colors.error as string} size={22} />
        </View>
        <View style={styles.stateCopy}>
          <Text style={styles.stateTitle}>{title ?? t("home.errors.loadTitle")}</Text>
          <Text style={styles.stateDescription}>{description}</Text>
        </View>
        <Button
          compact
          icon={({ color, size }) => <IconRefresh color={color} size={size} />}
          mode="outlined"
          onPress={onRetry}
        >
          {tCommon("actions.retry")}
        </Button>
      </Card.Content>
    </Card>
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
    <Card mode="outlined" style={styles.stateCard}>
      <Card.Content style={styles.stateBody}>
        <View style={styles.stateIconBox}>
          <IconMessages color={colors.secondaryLabel as string} size={22} />
        </View>
        <View style={styles.stateCopy}>
          <Text style={styles.stateTitle}>{title}</Text>
          <Text style={styles.stateDescription}>{description}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

export function CommunityThreadSkeleton() {
  const styles = useCommunityUiStyles();
  return (
    <Card accessibilityElementsHidden mode="outlined" style={styles.card}>
      <Card.Content style={styles.skeletonBody}>
        <View style={styles.skeletonTopRow}>
          <Skeleton style={styles.skeletonAvatar} />
          <View style={styles.skeletonCopy}>
            <Skeleton style={[styles.skeletonLine, styles.skeletonTitle]} />
            <Skeleton style={[styles.skeletonLine, styles.skeletonLineWide]} />
            <Skeleton style={[styles.skeletonLine, styles.skeletonLineShort]} />
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

function TinyStat({ icon, value }: { icon: ReactNode; value: string }) {
  const styles = useCommunityUiStyles();
  return (
    <View style={styles.tinyStat}>
      {icon}
      <Text style={styles.tinyStatText}>{value}</Text>
    </View>
  );
}

const useCommunityUiStyles = createThemedStyles((colors) => ({
  accentChip: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 999,
  },
  accentChipText: {
    color: colors.onPrimaryContainer,
    fontSize: 11,
    fontWeight: "700",
  },
  authorLine: { flex: 1 },
  authorName: { color: colors.label, fontSize: 12, fontWeight: "600" },
  authorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: "continuous",
    borderRadius: 20,
    overflow: "hidden",
  },
  cardBody: { paddingHorizontal: 14, paddingVertical: 12 },
  cardMain: { flex: 1 },
  cardTopRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  deletedSuffix: { color: colors.error, fontSize: 12, fontWeight: "700" },
  excerpt: {
    color: colors.secondaryLabel,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  metaChip: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 999,
  },
  metaChipText: {
    color: colors.secondaryLabel,
    fontSize: 11,
    fontWeight: "600",
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  pressed: { opacity: 0.72 },
  replyBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 12,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  replyBadgeText: {
    color: colors.secondaryLabel,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  sectionTitle: { color: colors.label, fontSize: 21, fontWeight: "700" },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  skeletonAvatar: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 21,
    height: 42,
    width: 42,
  },
  skeletonBody: { paddingHorizontal: 14, paddingVertical: 14 },
  skeletonCopy: { flex: 1, gap: 9 },
  skeletonLine: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 6,
    height: 14,
  },
  skeletonLineShort: { width: "68%" },
  skeletonLineWide: { width: "100%" },
  skeletonTitle: { height: 22, width: "86%" },
  skeletonTopRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  stateBody: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    padding: 18,
  },
  stateCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: "continuous",
    borderRadius: 20,
  },
  stateCopy: { flex: 1, gap: 4 },
  stateDescription: {
    color: colors.secondaryLabel,
    fontSize: 13,
    lineHeight: 19,
  },
  stateIconBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  stateTitle: { color: colors.label, fontSize: 16, fontWeight: "700" },
  threadTitle: {
    color: colors.label,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  timeSeparator: { color: colors.secondaryLabel, fontSize: 12 },
  tinyStat: { alignItems: "center", flexDirection: "row", gap: 3 },
  tinyStatText: {
    color: colors.secondaryLabel,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  tinyStats: { alignItems: "center", flexDirection: "row", gap: 10 },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 4 },
}));

import { IconArrowBackUp, IconHeart, IconTrash } from '@tabler/icons-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { CommentAvatar } from '@/components/comment-avatar';

export interface CommentThreadPalette {
  accent: ColorValue;
  error: ColorValue;
  highlightBackground: ColorValue;
  label: ColorValue;
  onSurfaceVariant: ColorValue;
  separator: ColorValue;
  surfaceContainerHighest: ColorValue;
}

export interface CommentThreadLikeAction {
  count: number;
  disabled?: boolean;
  liked?: boolean;
  onPress(): void;
}

export interface CommentThreadRowProps {
  actionsDisabled?: boolean;
  avatarUrl: string;
  badge?: string | null;
  canDelete?: boolean;
  canReply?: boolean;
  content: string;
  createdAtLabel: string;
  deleted?: boolean;
  highlighted?: boolean;
  horizontalInset?: number;
  like?: CommentThreadLikeAction;
  onDelete?(): void;
  onReply?(): void;
  palette: CommentThreadPalette;
  replyToName?: string | null;
  userName: string;
  variant?: 'comment' | 'reply';
}

export interface CommentThreadChildrenProps {
  children: ReactNode;
  horizontalInset?: number;
  palette: CommentThreadPalette;
}

export function CommentThreadRow({
  actionsDisabled = false,
  avatarUrl,
  badge,
  canDelete = false,
  canReply = false,
  content,
  createdAtLabel,
  deleted = false,
  highlighted = false,
  horizontalInset = 16,
  like,
  onDelete,
  onReply,
  palette,
  replyToName,
  userName,
  variant = 'comment',
}: CommentThreadRowProps) {
  const { t } = useTranslation('community');
  const displayName = deleted ? t('labels.deletedUser') : userName || t('labels.unknownUser');
  const isReply = variant === 'reply';

  if (isReply) {
    return (
      <View
        style={[
          styles.replyRow,
          highlighted && [
            styles.highlightedRow,
            { backgroundColor: palette.highlightBackground },
          ],
        ]}
      >
        {highlighted ? (
          <View
            pointerEvents="none"
            style={[styles.highlightBar, { backgroundColor: palette.accent }]}
          />
        ) : null}

        <View style={styles.replyIdentity}>
          <CommentAvatar
            avatarUrl={avatarUrl}
            backgroundColor={palette.surfaceContainerHighest}
            color={palette.label}
            size={24}
            userName={displayName}
          />
          <Text style={[styles.replyIdentityText, { color: palette.label }]}>
            <Text style={[styles.replyName, { color: palette.label }]}>{displayName}</Text>
            {replyToName ? (
              <Text style={[styles.replyConnector, { color: palette.onSurfaceVariant }]}>
                {' '}{t('labels.repliedTo', { name: replyToName })}
              </Text>
            ) : null}
          </Text>
          {badge ? <CommentBadge label={badge} palette={palette} /> : null}
        </View>
        <Text
          selectable
          style={[styles.commentText, { color: palette.label }]}
          textBreakStrategy="simple"
        >
          {content.trim()}
        </Text>
        <CommentThreadActions
          actionsDisabled={actionsDisabled}
          canDelete={canDelete}
          canReply={canReply}
          createdAtLabel={createdAtLabel}
          {...(like ? { like } : {})}
          {...(onDelete ? { onDelete } : {})}
          {...(onReply ? { onReply } : {})}
          palette={palette}
          variant="reply"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.commentRow,
        { paddingHorizontal: horizontalInset },
        highlighted && [
          styles.highlightedRow,
          { backgroundColor: palette.highlightBackground },
        ],
      ]}
    >
      {highlighted ? (
        <View
          pointerEvents="none"
          style={[styles.highlightBar, { backgroundColor: palette.accent }]}
        />
      ) : null}

      <CommentAvatar
        avatarUrl={avatarUrl}
        backgroundColor={palette.surfaceContainerHighest}
        color={palette.label}
        size={40}
        userName={displayName}
      />
      <View style={styles.commentBody}>
        <View style={styles.identityRow}>
          <Text style={[styles.userName, { color: palette.label }]}>{displayName}</Text>
          {badge ? <CommentBadge label={badge} palette={palette} /> : null}
        </View>
        {replyToName ? (
          <Text style={[styles.replyTo, { color: palette.accent }]}>
            {t('labels.replyingTo', { name: replyToName })}
          </Text>
        ) : null}
        <Text
          selectable
          style={[styles.commentText, { color: palette.label }]}
          textBreakStrategy="simple"
        >
          {content.trim()}
        </Text>
        <CommentThreadActions
          actionsDisabled={actionsDisabled}
          canDelete={canDelete}
          canReply={canReply}
          createdAtLabel={createdAtLabel}
          {...(like ? { like } : {})}
          {...(onDelete ? { onDelete } : {})}
          {...(onReply ? { onReply } : {})}
          palette={palette}
          variant="comment"
        />
      </View>
    </View>
  );
}

export function CommentThreadChildren({
  children,
  horizontalInset = 16,
  palette,
}: CommentThreadChildrenProps) {
  return (
    <View
      style={[
        styles.replies,
        {
          borderLeftColor: palette.separator,
          marginLeft: horizontalInset + 56,
          marginRight: horizontalInset,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function CommentThreadActions({
  actionsDisabled = false,
  canDelete = false,
  canReply = false,
  createdAtLabel,
  like,
  onDelete,
  onReply,
  palette,
  variant = 'comment',
}: {
  actionsDisabled?: boolean;
  canDelete?: boolean;
  canReply?: boolean;
  createdAtLabel: string;
  like?: CommentThreadLikeAction;
  onDelete?(): void;
  onReply?(): void;
  palette: CommentThreadPalette;
  variant?: 'comment' | 'reply';
}) {
  const { t } = useTranslation('community');
  const iconSize = variant === 'comment' ? 18 : 16;
  const disabled = actionsDisabled;
  return (
    <View style={styles.commentActions}>
      <Text
        style={[
          styles.timestamp,
          { color: palette.onSurfaceVariant },
          variant === 'reply' && styles.replyTimestamp,
        ]}
      >
        {createdAtLabel}
      </Text>
      <View style={styles.actionButtons}>
        {like ? (
          <Pressable
            accessibilityLabel={like.liked ? t('accessibility.unlikeComment') : t('accessibility.likeComment')}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || like.disabled, selected: like.liked }}
            disabled={disabled || like.disabled}
            onPress={like.onPress}
            style={({ pressed }) => [
              styles.likeAction,
              (disabled || like.disabled) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <IconHeart
              color={(like.liked ? palette.accent : palette.onSurfaceVariant) as string}
              fill={(like.liked ? palette.accent : 'none') as string}
              size={iconSize}
              strokeWidth={2}
            />
            <Text style={[styles.likeCount, { color: palette.onSurfaceVariant }]}>{like.count}</Text>
          </Pressable>
        ) : null}
        {onReply ? (
          <Pressable
            accessibilityLabel={t('accessibility.replyComment')}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || !canReply }}
            disabled={disabled || !canReply}
            onPress={onReply}
            style={({ pressed }) => [
              styles.smallAction,
              (disabled || !canReply) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <IconArrowBackUp color={palette.onSurfaceVariant as string} size={iconSize} strokeWidth={2} />
          </Pressable>
        ) : null}
        {canDelete && onDelete ? (
          <Pressable
            accessibilityLabel={t('accessibility.deleteComment')}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onDelete}
            style={({ pressed }) => [
              styles.smallAction,
              disabled && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <IconTrash color={palette.error as string} size={iconSize} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function CommentBadge({ label, palette }: { label: string; palette: CommentThreadPalette }) {
  return (
    <View style={[styles.badge, { backgroundColor: palette.surfaceContainerHighest }]}>
      <Text style={[styles.badgeText, { color: palette.onSurfaceVariant }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButtons: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  commentActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  commentBody: { flex: 1, gap: 4 },
  commentRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, paddingVertical: 8 },
  disabled: { opacity: 0.42 },
  commentText: { fontSize: 14, lineHeight: 19 },
  highlightBar: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 3,
  },
  highlightedRow: { position: 'relative' },
  identityRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  likeAction: { alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 32, paddingHorizontal: 5 },
  likeCount: { fontSize: 12, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.68 },
  replies: { borderLeftWidth: 2, gap: 12, marginBottom: 8, paddingLeft: 12 },
  replyConnector: { fontWeight: '400' },
  replyIdentity: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  replyIdentityText: { flex: 1, fontSize: 12, lineHeight: 16 },
  replyName: { fontWeight: '700' },
  replyRow: { gap: 4, paddingVertical: 2 },
  replyTimestamp: { fontSize: 10 },
  replyTo: { fontSize: 12, fontWeight: '600' },
  smallAction: { alignItems: 'center', height: 32, justifyContent: 'center', minWidth: 32, paddingHorizontal: 5 },
  timestamp: { fontSize: 12 },
  userName: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
});

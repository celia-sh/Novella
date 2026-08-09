import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CommentComposeSheet } from '@/components/comment-compose-sheet';
import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import { resolveOnAccentHex, useAppTheme } from '@/theme/app-theme';

export default function AnnouncementCommentComposeRoute() {
  const { id, parentId, replyId, userName } = useLocalSearchParams<{
    id: string;
    parentId?: string;
    replyId?: string;
    userName?: string;
  }>();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const announcementId = parsePositiveInteger(id);
  const parsedParentId = parentId === undefined ? undefined : parsePositiveInteger(parentId);
  const parsedReplyId = replyId === undefined ? undefined : parsePositiveInteger(replyId);
  const invalid = announcementId === null
    || (parentId !== undefined && parsedParentId === null)
    || (replyId !== undefined && parsedReplyId === null)
    || (parsedReplyId !== undefined && parsedParentId === undefined);

  if (invalid || announcementId === null) {
    return (
      <NativeRouteBottomSheet>
        <View style={styles.errorState}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {t('announcements.errors.invalid')}
          </Text>
        </View>
      </NativeRouteBottomSheet>
    );
  }

  const replyTarget = parsedParentId == null
    ? undefined
    : {
        parentId: parsedParentId,
        ...(parsedReplyId == null ? {} : { replyId: parsedReplyId }),
      };

  return (
    <CommentComposeSheet
      onSubmitted={() => router.back()}
      palette={{
        error: colors.error,
        label: colors.label,
        onPrimary: resolveOnAccentHex(colors.accent),
        primary: colors.accent,
        secondaryLabel: colors.secondaryLabel,
        surface: colors.surface,
        surfaceContainerHighest: colors.surfaceContainerHighest,
      }}
      {...(replyTarget ? { replyTarget } : {})}
      target={{ type: 'Announcement', id: announcementId }}
      {...(userName ? { userName } : {})}
    />
  );
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

const styles = StyleSheet.create({
  errorState: { alignItems: 'center', padding: 24 },
  errorText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});

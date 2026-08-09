import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { IconSend } from '@tabler/icons-react-native';

import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import { useCommunityReplySubmission } from '@/hooks/use-community-reply-submission';
import { createThemedStyles, resolveAccentHex, resolveOnAccentHex, useAppTheme } from '@/theme/app-theme';

export function CommunityReplySheetScreen({
  parentReplyId,
  replyId,
  replyToName,
  threadId,
}: {
  parentReplyId: number | null;
  replyId: number | null;
  replyToName: string | null;
  threadId: number;
}) {
  const styles = useCommunityReplySheetStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const onAccent = resolveOnAccentHex(colors.accent);
  const accent = resolveAccentHex(colors.accent);
  const [draft, setDraft] = useState('');
  const { error, isSubmitting, submit } = useCommunityReplySubmission(
    threadId,
    replyId ?? parentReplyId ?? undefined,
  );
  const canSubmit = draft.trim().length > 0 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    if (await submit(draft.trim())) router.back();
  }

  const prompt = replyToName
    ? t('labels.replyingTo', { name: replyToName })
    : t('thread.replyToDiscussion');

  return (
    <NativeRouteBottomSheet>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={styles.root}
      >
        <TextInput
          accessibilityLabel={prompt}
          autoFocus
          maxLength={4_000}
          multiline
          onChangeText={setDraft}
          placeholder={prompt}
          placeholderTextColor={colors.secondaryLabel as string}
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceContainerHighest as string,
              color: colors.label as string,
            },
          ]}
          textAlignVertical="top"
          value={draft}
        />
        {error ? <Text style={[styles.errorText, { color: colors.error as string }]}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={isSubmitting ? t('actions.publishingReply') : t('actions.publishReply')}
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: accent },
              !canSubmit && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={onAccent} size="small" />
            ) : (
              <IconSend color={onAccent} size={18} strokeWidth={2} />
            )}
            <Text style={[styles.submitLabel, { color: onAccent }]}>
              {isSubmitting ? t('actions.publishing') : t('actions.publish')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </NativeRouteBottomSheet>
  );
}

const useCommunityReplySheetStyles = createThemedStyles((colors) => ({
  actions: { alignItems: 'flex-end' },
  content: { gap: 12, padding: 16 },
  disabled: { opacity: 0.45 },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 18 },
  input: { borderRadius: 20, fontSize: 15, lineHeight: 21, maxHeight: 148, minHeight: 104, padding: 12 },
  pressed: { opacity: 0.68 },
  root: { backgroundColor: colors.background },
  submitButton: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 7,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  submitLabel: { fontSize: 14, fontWeight: '700' },
}));

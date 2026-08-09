import { router, useLocalSearchParams } from 'expo-router';
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

import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import { useCommentSubmission } from '@/hooks/use-comment-submission';

export default function CommentComposeRoute() {
  const { t } = useTranslation('community');
  const { id, parentId, replyId, userName } = useLocalSearchParams<{
    id: string;
    parentId?: string;
    replyId?: string;
    userName?: string;
  }>();
  const bookId = Number(id);
  const { palette } = useBookDetailRouteTheme(bookId, null, null, true);
  const [draft, setDraft] = useState('');
  const replyTarget = parentId
    ? {
        parentId: Number(parentId),
        ...(replyId ? { replyId: Number(replyId) } : {}),
      }
    : undefined;
  const { error, isSubmitting, submit } = useCommentSubmission(bookId, replyTarget);
  const canSubmit = draft.trim().length > 0 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    if (await submit(draft.trim())) router.back();
  }

  const prompt = userName ? t('comments.replyTo', { name: userName }) : t('comments.write');

  return (
    <NativeRouteBottomSheet bookId={bookId}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={[styles.root, { backgroundColor: palette.surface }]}
      >
        <TextInput
          accessibilityLabel={prompt}
          autoFocus
          maxLength={4_000}
          multiline
          onChangeText={setDraft}
          placeholder={prompt}
          placeholderTextColor={palette.onSurfaceVariant}
          style={[
            styles.input,
            {
              backgroundColor: palette.surfaceContainerHighest,
              color: palette.onSurface,
            },
          ]}
          textAlignVertical="top"
          value={draft}
        />
        {error ? <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={isSubmitting ? t('comments.postingAccessibility') : t('comments.postAccessibility')}
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: palette.primary },
              !canSubmit && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={palette.onPrimary} size="small" />
            ) : (
              <IconSend color={palette.onPrimary} size={18} strokeWidth={2} />
            )}
            <Text style={[styles.submitLabel, { color: palette.onPrimary }]}>
              {isSubmitting ? t('comments.posting') : t('comments.post')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </NativeRouteBottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: 'flex-end' },
  content: { gap: 12, padding: 16 },
  disabled: { opacity: 0.45 },
  errorText: { fontSize: 13, lineHeight: 18 },
  input: { borderRadius: 20, fontSize: 15, lineHeight: 21, maxHeight: 148, minHeight: 104, padding: 12 },
  pressed: { opacity: 0.68 },
  root: {},
  submitButton: { alignItems: 'center', borderRadius: 20, flexDirection: 'row', gap: 7, height: 40, justifyContent: 'center', paddingHorizontal: 18 },
  submitLabel: { fontSize: 14, fontWeight: '700' },
});

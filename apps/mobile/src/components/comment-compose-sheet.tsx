import { IconSend } from '@tabler/icons-react-native';
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
  type ColorValue,
} from 'react-native';

import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import { useCommentSubmission } from '@/hooks/use-comment-submission';
import type { CommentTarget } from '@/services/comment-target';

export interface CommentComposePalette {
  error: ColorValue;
  label: ColorValue;
  onPrimary: ColorValue;
  primary: ColorValue;
  secondaryLabel: ColorValue;
  surface: ColorValue;
  surfaceContainerHighest: ColorValue;
}

export interface CommentComposeReplyTarget {
  parentId: number;
  replyId?: number;
}

export function CommentComposeSheet({
  bookId,
  onSubmitted,
  palette,
  replyTarget,
  target,
  userName,
}: {
  bookId?: number;
  onSubmitted(): void;
  palette: CommentComposePalette;
  replyTarget?: CommentComposeReplyTarget;
  target: CommentTarget;
  userName?: string;
}) {
  const { t } = useTranslation('community');
  const [draft, setDraft] = useState('');
  const { error, isSubmitting, submit } = useCommentSubmission(target, replyTarget);
  const canSubmit = draft.trim().length > 0 && !isSubmitting;
  const prompt = userName ? t('comments.replyTo', { name: userName }) : t('comments.write');

  async function handleSubmit() {
    if (!canSubmit) return;
    if (await submit(draft.trim())) onSubmitted();
  }

  return (
    <NativeRouteBottomSheet {...(bookId === undefined ? {} : { bookId })}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={[
          styles.root,
          { backgroundColor: palette.surface },
        ]}
      >
        <TextInput
          accessibilityLabel={prompt}
          autoFocus
          maxLength={4_000}
          multiline
          onChangeText={setDraft}
          placeholder={prompt}
          placeholderTextColor={palette.secondaryLabel}
          style={[
            styles.input,
            {
              backgroundColor: palette.surfaceContainerHighest,
              color: palette.label,
            },
          ]}
          textAlignVertical="top"
          value={draft}
        />
        {error ? <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={isSubmitting
              ? t('comments.postingAccessibility')
              : t('comments.postAccessibility')}
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
              <ActivityIndicator color={palette.onPrimary as string} size="small" />
            ) : (
              <IconSend color={palette.onPrimary as string} size={18} strokeWidth={2} />
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
  input: {
    borderRadius: 20,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 148,
    minHeight: 104,
    padding: 12,
  },
  pressed: { opacity: 0.68 },
  root: {},
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
});

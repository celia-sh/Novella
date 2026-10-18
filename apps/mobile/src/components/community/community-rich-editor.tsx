import {
  IconBlockquote,
  IconBold,
  IconItalic,
  IconList,
  IconListNumbers,
  IconStrikethrough,
  IconUnderline,
} from '@tabler/icons-react-native';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type OnChangeStateEvent,
} from 'react-native-enriched-html';

import { useAppTheme } from '@/theme/app-theme';

export interface CommunityRichEditorHandle {
  blur(): void;
  focus(): void;
  getHtml(): Promise<string>;
}

interface CommunityRichEditorProps {
  editable?: boolean;
  initialHtml?: string;
  /** Minimum height of the writing area. */
  minHeight?: number;
  onTextChange(text: string): void;
  onTouchEnd?(): void;
  onTouchStart?(): void;
  placeholder?: string;
}

interface ToolbarAction {
  active: boolean;
  blocked: boolean;
  icon: typeof IconBold;
  id: string;
  label: string;
  run(editor: EnrichedTextInputInstance): void;
}

export const CommunityRichEditor = forwardRef<
  CommunityRichEditorHandle,
  CommunityRichEditorProps
>(function CommunityRichEditor(
  {
    editable = true,
    initialHtml = '',
    minHeight = 260,
    onTextChange,
    onTouchEnd,
    onTouchStart,
    placeholder,
  },
  ref,
) {
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const editorRef = useRef<EnrichedTextInputInstance>(null);
  const [formatState, setFormatState] = useState<OnChangeStateEvent | null>(null);

  useImperativeHandle(ref, () => ({
    blur() {
      editorRef.current?.blur();
    },
    focus() {
      editorRef.current?.focus();
    },
    getHtml() {
      return editorRef.current?.getHTML() ?? Promise.resolve('');
    },
  }), []);

  const actions: ToolbarAction[] = [
    {
      active: formatState?.bold.isActive ?? false,
      blocked: formatState?.bold.isBlocking ?? false,
      icon: IconBold,
      id: 'bold',
      label: t('editor.bold'),
      run: (editor) => editor.toggleBold(),
    },
    {
      active: formatState?.italic.isActive ?? false,
      blocked: formatState?.italic.isBlocking ?? false,
      icon: IconItalic,
      id: 'italic',
      label: t('editor.italic'),
      run: (editor) => editor.toggleItalic(),
    },
    {
      active: formatState?.underline.isActive ?? false,
      blocked: formatState?.underline.isBlocking ?? false,
      icon: IconUnderline,
      id: 'underline',
      label: t('editor.underline'),
      run: (editor) => editor.toggleUnderline(),
    },
    {
      active: formatState?.strikeThrough.isActive ?? false,
      blocked: formatState?.strikeThrough.isBlocking ?? false,
      icon: IconStrikethrough,
      id: 'strikethrough',
      label: t('editor.strikethrough'),
      run: (editor) => editor.toggleStrikeThrough(),
    },
    {
      active: formatState?.blockQuote.isActive ?? false,
      blocked: formatState?.blockQuote.isBlocking ?? false,
      icon: IconBlockquote,
      id: 'blockquote',
      label: t('editor.blockquote'),
      run: (editor) => editor.toggleBlockQuote(),
    },
    {
      active: formatState?.unorderedList.isActive ?? false,
      blocked: formatState?.unorderedList.isBlocking ?? false,
      icon: IconList,
      id: 'unordered-list',
      label: t('editor.bulletedList'),
      run: (editor) => editor.toggleUnorderedList(),
    },
    {
      active: formatState?.orderedList.isActive ?? false,
      blocked: formatState?.orderedList.isBlocking ?? false,
      icon: IconListNumbers,
      id: 'ordered-list',
      label: t('editor.numberedList'),
      run: (editor) => editor.toggleOrderedList(),
    },
  ];

  return (
    <View
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.toolbar}
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        style={[styles.toolbarBar, { backgroundColor: colors.card }]}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          const disabled = !editable || action.blocked;
          return (
            <Pressable
              accessibilityLabel={action.label}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: action.active }}
              disabled={disabled}
              key={action.id}
              onPress={() => {
                const editor = editorRef.current;
                if (editor) action.run(editor);
              }}
              style={({ pressed }) => [
                styles.toolButton,
                action.active && { backgroundColor: colors.primaryContainer },
                pressed && !action.active && { backgroundColor: colors.surfaceContainerHighest },
                disabled && styles.toolButtonDisabled,
              ]}
            >
              <Icon
                color={action.active ? colors.onPrimaryContainer as string : colors.label as string}
                size={19}
                strokeWidth={2}
              />
            </Pressable>
          );
        })}
      </ScrollView>
      <EnrichedTextInput
        autoCapitalize="sentences"
        cursorColor={colors.accent}
        defaultValue={initialHtml}
        editable={editable}
        htmlStyle={{
          a: { color: colors.accent, textDecorationLine: 'underline' },
          blockquote: {
            borderColor: colors.separator,
            borderWidth: 3,
            color: colors.secondaryLabel,
            gapWidth: 10,
          },
          ol: { markerColor: colors.secondaryLabel },
          ul: { bulletColor: colors.secondaryLabel },
        }}
        linkRegex={null}
        mentionIndicators={[]}
        onChangeState={(event) => setFormatState(event.nativeEvent)}
        onChangeText={(event) => onTextChange(event.nativeEvent.value)}
        placeholder={placeholder ?? t('editor.placeholder')}
        placeholderTextColor={colors.secondaryLabel}
        ref={editorRef}
        scrollEnabled
        selectionColor={colors.primaryContainer}
        style={{
          color: colors.label,
          fontSize: 17,
          lineHeight: 26,
          minHeight,
          paddingVertical: 4,
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 12 },
  toolButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  toolButtonDisabled: { opacity: 0.4 },
  toolbar: { gap: 2, paddingHorizontal: 4, paddingVertical: 4 },
  toolbarBar: { borderCurve: 'continuous', borderRadius: 22, flexGrow: 0 },
});

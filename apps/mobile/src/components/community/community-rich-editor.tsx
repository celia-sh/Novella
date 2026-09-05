import {
  IconBlockquote,
  IconBold,
  IconItalic,
  IconList,
  IconListNumbers,
  IconStrikethrough,
  IconUnderline,
} from '@tabler/icons-react-native';
import { Button } from 'heroui-native';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
      style={[styles.container, { borderColor: colors.separator }]}
    >
      <ScrollView
        contentContainerStyle={styles.toolbar}
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              accessibilityLabel={action.label}
              accessibilityState={{ disabled: !editable || action.blocked, selected: action.active }}
              isDisabled={!editable || action.blocked}
              isIconOnly
              key={action.id}
              onPress={() => {
                const editor = editorRef.current;
                if (editor) action.run(editor);
              }}
              size="sm"
              style={action.active ? { backgroundColor: colors.primaryContainer } : undefined}
              variant={action.active ? 'secondary' : 'ghost'}
            >
              <Icon
                color={action.active ? colors.onPrimaryContainer as string : colors.label as string}
                size={19}
                strokeWidth={2}
              />
            </Button>
          );
        })}
      </ScrollView>
      <View style={[styles.divider, { backgroundColor: colors.separator }]} />
      <EnrichedTextInput
        autoCapitalize="sentences"
        cursorColor={colors.accent}
        defaultValue={initialHtml}
        editable={editable}
        htmlStyle={{
          a: { color: colors.accent, textDecorationLine: 'underline' },
          blockquote: {
            borderColor: colors.accent,
            borderWidth: 3,
            color: colors.label,
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
          backgroundColor: colors.card,
          color: colors.label,
          fontSize: 16,
          lineHeight: 24,
          minHeight: 220,
          padding: 14,
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth },
  toolbar: { gap: 4, paddingHorizontal: 8, paddingVertical: 7 },
});

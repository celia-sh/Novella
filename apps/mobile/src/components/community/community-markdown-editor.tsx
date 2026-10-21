import {
  IconBlockquote,
  IconBold,
  IconHeading,
  IconItalic,
  IconList,
  IconListNumbers,
  IconPhoto,
  IconStrikethrough,
  IconUnderline,
} from '@tabler/icons-react-native';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { CommunityHtmlContent } from '@/components/community/community-html-content';
import { showAlert } from '@/components/native-alert-dialog';
import { NativeSegmentedControl } from '@/components/native-segmented-control';
import {
  CommunityImageTooLargeError,
  pickCommunityImages,
  uploadCommunityImage,
  type CommunityImageSource,
} from '@/services/community-image-upload';
import {
  insertMarkdownBlock,
  toggleMarkdownLinePrefix,
  wrapMarkdownSelection,
  type MarkdownEdit,
  type MarkdownSelection,
} from '@/services/community-markdown-edits';
import { renderCommunityMarkdown } from '@/services/community-markdown';
import { useAppTheme } from '@/theme/app-theme';

export interface CommunityMarkdownEditorHandle {
  blur(): void;
  focus(): void;
}

interface CommunityMarkdownEditorProps {
  editable?: boolean;
  /** Minimum height of the writing area. */
  minHeight?: number;
  onChangeValue(value: string): void;
  onTouchEnd?(): void;
  onTouchStart?(): void;
  /** Reports whether images are still uploading, so the screen can hold
   * publishing until every inserted image has a URL. */
  onUploadingChange?(uploading: boolean): void;
  placeholder?: string;
  /** The post body as Markdown. */
  value: string;
}

type EditorMode = 'edit' | 'preview';

interface ToolbarAction {
  icon: typeof IconBold;
  id: string;
  label: string;
  run(value: string, selection: MarkdownSelection): MarkdownEdit;
}

/**
 * Writes a post as Markdown, the way the web's default editor does: the
 * source keeps text and images in one plain sequence that can be cut and
 * moved freely, and the preview shows it as the thread page will.
 */
export const CommunityMarkdownEditor = forwardRef<
  CommunityMarkdownEditorHandle,
  CommunityMarkdownEditorProps
>(function CommunityMarkdownEditor(
  {
    editable = true,
    minHeight = 260,
    onChangeValue,
    onTouchEnd,
    onTouchStart,
    onUploadingChange,
    placeholder,
    value,
  },
  ref,
) {
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const inputRef = useRef<TextInputInstance>(null);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [width, setWidth] = useState(0);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const uploading = upload !== null;
  // Toolbar edits and uploads read these rather than props: an upload
  // finishes long after the render that started it.
  const valueRef = useRef(value);
  valueRef.current = value;
  const selectionRef = useRef<MarkdownSelection>({ end: value.length, start: value.length });
  const pendingSelectionRef = useRef<MarkdownSelection | null>(null);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [onUploadingChange, uploading]);

  // Put the cursor where an edit left it once the new text is in the input.
  useLayoutEffect(() => {
    const selection = pendingSelectionRef.current;
    if (!selection) return;
    pendingSelectionRef.current = null;
    inputRef.current?.setSelection(selection.start, selection.end);
  }, [value]);

  const applyEdit = useCallback((edit: MarkdownEdit) => {
    valueRef.current = edit.value;
    selectionRef.current = edit.selection;
    pendingSelectionRef.current = edit.selection;
    onChangeValue(edit.value);
  }, [onChangeValue]);

  // Uploads run one at a time so images land in the order they were picked,
  // each at the cursor as soon as its URL is known.
  const insertImages = useCallback(async (sources: CommunityImageSource[]) => {
    if (sources.length === 0) return;
    setUpload({ done: 0, total: sources.length });
    let failed = 0;
    let tooLarge = false;
    for (const [index, source] of sources.entries()) {
      try {
        const image = await uploadCommunityImage(source);
        applyEdit(insertMarkdownBlock(valueRef.current, selectionRef.current, `![](${image.url})`));
      } catch (error) {
        failed += 1;
        if (error instanceof CommunityImageTooLargeError) tooLarge = true;
      }
      setUpload({ done: index + 1, total: sources.length });
    }
    setUpload(null);
    if (failed > 0) {
      showAlert(
        t('editor.imageUploadFailed'),
        tooLarge && failed === 1
          ? t('editor.imageTooLarge', { limit: new CommunityImageTooLargeError().limitMegabytes })
          : t('editor.imageUploadFailedMessage', { count: failed }),
      );
    }
  }, [applyEdit, t]);

  useImperativeHandle(ref, () => ({
    blur() {
      inputRef.current?.blur();
    },
    focus() {
      inputRef.current?.focus();
    },
  }), []);

  const actions: ToolbarAction[] = [
    {
      icon: IconBold,
      id: 'bold',
      label: t('editor.bold'),
      run: (text, selection) => wrapMarkdownSelection(text, selection, '**', '**'),
    },
    {
      icon: IconItalic,
      id: 'italic',
      label: t('editor.italic'),
      run: (text, selection) => wrapMarkdownSelection(text, selection, '*', '*'),
    },
    {
      icon: IconUnderline,
      id: 'underline',
      label: t('editor.underline'),
      run: (text, selection) => wrapMarkdownSelection(text, selection, '<u>', '</u>'),
    },
    {
      icon: IconStrikethrough,
      id: 'strikethrough',
      label: t('editor.strikethrough'),
      run: (text, selection) => wrapMarkdownSelection(text, selection, '~~', '~~'),
    },
    {
      icon: IconHeading,
      id: 'heading',
      label: t('editor.heading'),
      run: (text, selection) => toggleMarkdownLinePrefix(text, selection, /^## /u, () => '## '),
    },
    {
      icon: IconBlockquote,
      id: 'blockquote',
      label: t('editor.blockquote'),
      run: (text, selection) => toggleMarkdownLinePrefix(text, selection, /^> ?/u, () => '> '),
    },
    {
      icon: IconList,
      id: 'unordered-list',
      label: t('editor.bulletedList'),
      run: (text, selection) => toggleMarkdownLinePrefix(text, selection, /^[-*+] /u, () => '- '),
    },
    {
      icon: IconListNumbers,
      id: 'ordered-list',
      label: t('editor.numberedList'),
      run: (text, selection) => toggleMarkdownLinePrefix(
        text,
        selection,
        /^\d+\. /u,
        (index) => `${index + 1}. `,
      ),
    },
  ];

  const editing = mode === 'edit';
  const canEdit = editable && editing;
  const html = useMemo(
    () => (editing ? '' : renderCommunityMarkdown(value)),
    [editing, value],
  );

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
      style={styles.container}
    >
      <NativeSegmentedControl
        accessibilityLabel={t('editor.mode')}
        onValueChange={(next) => {
          if (next === 'preview') inputRef.current?.blur();
          setMode(next);
        }}
        options={[
          { label: t('editor.edit'), value: 'edit' },
          { label: t('editor.preview'), value: 'preview' },
        ]}
        selectedValue={mode}
      />
      {editing ? (
        <ScrollView
          contentContainerStyle={styles.toolbar}
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          style={[styles.toolbarBar, { backgroundColor: colors.card }]}
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Pressable
                accessibilityLabel={action.label}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canEdit }}
                disabled={!canEdit}
                key={action.id}
                onPress={() => applyEdit(action.run(valueRef.current, selectionRef.current))}
                style={({ pressed }) => [
                  styles.toolButton,
                  pressed && { backgroundColor: colors.surfaceContainerHighest },
                  !canEdit && styles.toolButtonDisabled,
                ]}
              >
                <Icon color={colors.label as string} size={19} strokeWidth={2} />
              </Pressable>
            );
          })}
          <View style={[styles.toolDivider, { backgroundColor: colors.separator }]} />
          <Pressable
            accessibilityLabel={t('editor.image')}
            accessibilityRole="button"
            accessibilityState={{ busy: uploading, disabled: !canEdit || uploading }}
            disabled={!canEdit || uploading}
            onPress={() => {
              void pickCommunityImages().then(insertImages);
            }}
            style={({ pressed }) => [
              styles.toolButton,
              pressed && { backgroundColor: colors.surfaceContainerHighest },
              !canEdit && styles.toolButtonDisabled,
            ]}
          >
            {uploading ? (
              <ActivityIndicator color={colors.secondaryLabel as string} size="small" />
            ) : (
              <IconPhoto color={colors.label as string} size={19} strokeWidth={2} />
            )}
          </Pressable>
        </ScrollView>
      ) : null}
      {upload ? (
        <Text accessibilityLiveRegion="polite" style={[styles.uploadStatus, { color: colors.secondaryLabel }]}>
          {t('editor.uploadingImages', { done: upload.done, total: upload.total })}
        </Text>
      ) : null}
      {editing ? (
        <TextInput
          autoCapitalize="sentences"
          cursorColor={colors.accent}
          editable={editable}
          multiline
          onChangeText={(next) => {
            valueRef.current = next;
            onChangeValue(next);
          }}
          onSelectionChange={(event) => {
            selectionRef.current = event.nativeEvent.selection;
          }}
          placeholder={placeholder ?? t('editor.placeholder')}
          placeholderTextColor={colors.secondaryLabel}
          ref={inputRef}
          scrollEnabled={false}
          selectionColor={colors.accent}
          style={[styles.input, { color: colors.label, minHeight }]}
          textAlignVertical="top"
          value={value}
        />
      ) : (
        <View style={{ minHeight }}>
          {value.trim() ? (
            <CommunityHtmlContent contentWidth={width} html={html} />
          ) : (
            <Text style={[styles.emptyPreview, { color: colors.secondaryLabel }]}>
              {t('editor.emptyPreview')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 12 },
  emptyPreview: { fontSize: 15, lineHeight: 22, paddingVertical: 4 },
  input: { fontSize: 17, lineHeight: 26, padding: 0, paddingVertical: 4 },
  toolButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  toolButtonDisabled: { opacity: 0.4 },
  toolDivider: { alignSelf: 'center', height: 20, marginHorizontal: 4, width: StyleSheet.hairlineWidth },
  toolbar: { gap: 2, paddingHorizontal: 4, paddingVertical: 4 },
  toolbarBar: { borderCurve: 'continuous', borderRadius: 22, flexGrow: 0 },
  uploadStatus: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
});

import {
  IconBlockquote,
  IconBold,
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
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type OnChangeStateEvent,
} from 'react-native-enriched-html';

import { showAlert } from '@/components/native-alert-dialog';
import { editorImageSize } from '@/services/community-image-sizing';
import {
  CommunityImageTooLargeError,
  pickCommunityImages,
  uploadCommunityImage,
  type CommunityImageSource,
} from '@/services/community-image-upload';
import { useAppTheme } from '@/theme/app-theme';

/** The text view insets its content slightly; images must fit inside it. */
const EDITOR_CONTENT_INSET = 8;

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
  /** Reports whether images are still uploading, so the screen can hold
   * publishing until every inserted image has a URL. */
  onUploadingChange?(uploading: boolean): void;
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
    onUploadingChange,
    placeholder,
  },
  ref,
) {
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const editorRef = useRef<EnrichedTextInputInstance>(null);
  const [formatState, setFormatState] = useState<OnChangeStateEvent | null>(null);
  const [editorWidth, setEditorWidth] = useState(0);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const uploading = upload !== null;

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [onUploadingChange, uploading]);

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
        const size = editorImageSize(image, editorWidth - EDITOR_CONTENT_INSET);
        editorRef.current?.setImage(image.url, size.width, size.height);
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
  }, [editorWidth, t]);

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
      onLayout={(event) => setEditorWidth(event.nativeEvent.layout.width)}
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
        <View style={[styles.toolDivider, { backgroundColor: colors.separator }]} />
        <Pressable
          accessibilityLabel={t('editor.image')}
          accessibilityRole="button"
          accessibilityState={{ busy: uploading, disabled: !editable || uploading }}
          disabled={!editable || uploading}
          onPress={() => {
            void pickCommunityImages().then(insertImages);
          }}
          style={({ pressed }) => [
            styles.toolButton,
            pressed && { backgroundColor: colors.surfaceContainerHighest },
            !editable && styles.toolButtonDisabled,
          ]}
        >
          {uploading ? (
            <ActivityIndicator color={colors.secondaryLabel as string} size="small" />
          ) : (
            <IconPhoto color={colors.label as string} size={19} strokeWidth={2} />
          )}
        </Pressable>
      </ScrollView>
      {upload ? (
        <Text accessibilityLiveRegion="polite" style={[styles.uploadStatus, { color: colors.secondaryLabel }]}>
          {t('editor.uploadingImages', { done: upload.done, total: upload.total })}
        </Text>
      ) : null}
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
        onPasteImages={(event) => {
          if (uploading) return;
          void insertImages(event.nativeEvent.images.map((image) => ({
            height: image.height,
            mimeType: image.type,
            uri: image.uri,
            width: image.width,
          })));
        }}
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
  toolDivider: { alignSelf: 'center', height: 20, marginHorizontal: 4, width: StyleSheet.hairlineWidth },
  toolbar: { gap: 2, paddingHorizontal: 4, paddingVertical: 4 },
  toolbarBar: { borderCurve: 'continuous', borderRadius: 22, flexGrow: 0 },
  uploadStatus: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
});

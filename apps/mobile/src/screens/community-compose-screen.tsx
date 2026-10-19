import { router, Stack } from 'expo-router';
import { Host } from '@expo/ui';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyboardAwareScrollView, KeyboardController } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { CommunityCatalogBoard } from '@novella/api-client';
import { COMMUNITY_STORAGE_KEYS } from '@novella/client-core';

import { CommunityPublishNavigation } from '@/components/community/community-navigation';
import {
  CommunityRichEditor,
  type CommunityRichEditorHandle,
} from '@/components/community/community-rich-editor';
import { COMMUNITY_CARD_RADIUS, CommunityErrorState } from '@/components/community/community-ui';
import { HorizontalSafeArea } from '@/components/horizontal-safe-area';
import { showAlert } from '@/components/native-alert-dialog';
import { NativePickerControl } from '@/components/native-picker-control';
import { readingColumnWidth, useWideLayout } from '@/hooks/use-wide-layout';
import { community, storage } from '@/services/client';
import { markCommunityThreadChanged } from '@/services/community-reply-events';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export function CommunityComposeScreen({
  initialBoardKey = '',
  initialSubCategoryKey = '',
  threadId,
}: {
  initialBoardKey?: string;
  initialSubCategoryKey?: string;
  threadId?: number;
}) {
  const isEditing = threadId !== undefined && threadId > 0;
  const styles = useCommunityComposeStyles();
  const { colors } = useAppTheme();
  const { isWide, pageMargin, usableWidth } = useWideLayout();
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const editorRef = useRef<CommunityRichEditorHandle>(null);
  const interactiveTouchRef = useRef(false);
  const [boards, setBoards] = useState<CommunityCatalogBoard[]>([]);
  const [boardKey, setBoardKey] = useState(initialBoardKey);
  const [subCategoryKey, setSubCategoryKey] = useState(initialSubCategoryKey);
  const [title, setTitle] = useState('');
  const [initialHtml, setInitialHtml] = useState('');
  const [contentText, setContentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadToken, setLoadToken] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeAccepted, setNoticeAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    setBoards([]);
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const home = await community.loadHome({ page: 1, size: 1 });
        const editInfo = isEditing && threadId
          ? await community.loadThreadEditInfo(threadId)
          : null;
        const notice = isEditing
          ? 'true'
          : await storage.get(COMMUNITY_STORAGE_KEYS.postNoticeAccepted);
        if (!active) return;
        setBoards(home.catalogBoards.filter((board) => board.key !== 'all'));
        if (editInfo) {
          setBoardKey(editInfo.boardKey);
          setSubCategoryKey(editInfo.subCategoryKey);
          setTitle(editInfo.title);
          setInitialHtml(editInfo.content);
          setContentText(extractCommunityPlainText(editInfo.content));
        } else if (initialBoardKey && home.catalogBoards.some((board) => board.key === initialBoardKey)) {
          setBoardKey(initialBoardKey);
        }
        setNoticeAccepted(notice === 'true');
        if (!isEditing && notice !== 'true') showFirstPostNotice();
        setLoading(false);
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : t('compose.errors.prepare'));
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [initialBoardKey, initialSubCategoryKey, isEditing, loadToken, t, threadId]);

  const [uploadingImages, setUploadingImages] = useState(false);
  const selectedBoard = useMemo(
    () => boards.find((board) => board.key === boardKey) ?? null,
    [boardKey, boards],
  );
  const canPublish = Boolean(
    noticeAccepted &&
    !publishing &&
    !uploadingImages &&
    boardKey &&
    title.trim().length >= 6 &&
    title.trim().length <= 60 &&
    contentText.trim().length >= 20 &&
    (!selectedBoard?.subCategories.length || subCategoryKey),
  );

  const markInteractiveTouch = useCallback(() => {
    interactiveTouchRef.current = true;
  }, []);

  const clearInteractiveTouch = useCallback(() => {
    setTimeout(() => {
      interactiveTouchRef.current = false;
    }, 0);
  }, []);

  const dismissEditorKeyboard = useCallback(() => {
    if (interactiveTouchRef.current) {
      interactiveTouchRef.current = false;
      return;
    }
    void KeyboardController.dismiss();
  }, []);

  const handleScrollTouchEnd = useCallback(() => {
    if (interactiveTouchRef.current) {
      interactiveTouchRef.current = false;
      return;
    }
    dismissEditorKeyboard();
  }, [dismissEditorKeyboard]);

  async function acceptNotice() {
    setError(null);
    try {
      await storage.set(COMMUNITY_STORAGE_KEYS.postNoticeAccepted, 'true');
      setNoticeAccepted(true);
    } catch (storageError) {
      setError(
        storageError instanceof Error
          ? storageError.message
          : t('compose.errors.saveNotice'),
      );
    }
  }

  const showFirstPostNotice = useCallback(() => {
    showAlert(
      t('compose.beforePostTitle'),
      t('compose.beforePostMessage'),
      [
        { style: 'cancel', text: tCommon('actions.cancel'), onPress: () => router.back() },
        { onPress: () => void acceptNotice(), text: t('actions.understand') },
      ],
    );
  }, [acceptNotice, t, tCommon]);

  async function publish() {
    if (!canPublish) return;
    setPublishing(true);
    setError(null);
    try {
      const contentHtml = await editorRef.current?.getHtml() ?? '';
      if (isEditing && threadId) {
        await community.updateThread({
          threadId,
          boardKey,
          subCategoryKey,
          title,
          contentHtml,
          contentText,
        });
      } else {
        const thread = await community.createThread({
          boardKey,
          subCategoryKey,
          title,
          contentHtml,
          contentText,
        });
        router.replace({
          pathname: '/thread/[id]',
          params: { id: String(thread.id) },
        });
        return;
      }
      markCommunityThreadChanged();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace({
          pathname: '/thread/[id]',
          params: { id: String(threadId) },
        });
      }
    } catch (publishError) {
      showAlert(
        isEditing
          ? t('compose.errors.updateDiscussionTitle')
          : t('compose.errors.publishDiscussionTitle'),
        publishError instanceof Error
          ? publishError.message
          : isEditing
            ? t('compose.errors.updateDiscussion')
            : t('compose.errors.publishDiscussion'),
      );
    } finally {
      setPublishing(false);
    }
  }

  const retryPrepare = () => {
    setError(null);
    setLoading(true);
    setLoadToken((current) => current + 1);
  };
  const errorState = error ? (
    <CommunityErrorState
      description={error}
      onRetry={retryPrepare}
      title={isEditing
        ? t('compose.errors.prepareEditTitle')
        : boards.length === 0
          ? t('compose.errors.prepareTitle')
          : t('compose.errors.publishTitle')}
    />
  ) : null;
  const showForm = !error || boards.length > 0;
  const titleTooShort = title.length > 0 && title.trim().length < 6;
  const contentTooShort = contentText.length > 0 && contentText.trim().length < 20;

  const settings = (
    <View style={styles.settingsBlock}>
      <View style={styles.group}>
        <ComposeSettingRow
          label={t('compose.board')}
          last={!selectedBoard?.subCategories.length}
        >
          <NativeMenuPicker
            enabled={!publishing}
            onValueChange={(value) => {
              setBoardKey(value);
              setSubCategoryKey('');
            }}
            options={[
              ...(boardKey ? [] : [{ label: t('compose.choose'), value: '' }]),
              ...boards.map((board) => ({ label: board.title, value: board.key })),
            ]}
            selectedValue={boardKey}
          />
        </ComposeSettingRow>
        {selectedBoard?.subCategories.length ? (
          <ComposeSettingRow label={t('compose.category')} last>
            <NativeMenuPicker
              enabled={!publishing}
              onValueChange={setSubCategoryKey}
              options={[
                ...(subCategoryKey ? [] : [{ label: t('compose.choose'), value: '' }]),
                ...selectedBoard.subCategories.map((category) => ({
                  label: category.label,
                  value: category.key,
                })),
              ]}
              selectedValue={subCategoryKey}
            />
          </ComposeSettingRow>
        ) : null}
      </View>
      {selectedBoard?.description ? (
        <Text style={styles.groupFooter}>{selectedBoard.description}</Text>
      ) : null}
      {selectedBoard?.subCategories.length && !subCategoryKey ? (
        <Text style={[styles.groupFooter, styles.validation]}>{t('compose.selectCategory')}</Text>
      ) : null}
    </View>
  );

  const writing = (
    <View style={styles.writing}>
      <View>
        <TextInput
          editable={!publishing}
          maxLength={60}
          multiline
          onChangeText={(value) => setTitle(value.replace(/\n/g, ''))}
          onTouchEnd={clearInteractiveTouch}
          onTouchStart={markInteractiveTouch}
          placeholder={t('compose.titlePlaceholder')}
          placeholderTextColor={colors.secondaryLabel}
          accessibilityLabel={t('compose.title')}
          scrollEnabled={false}
          selectionColor={colors.accent}
          style={styles.titleInput}
          submitBehavior="blurAndSubmit"
          value={title}
        />
        <View style={styles.metaRow}>
          <Text style={[styles.counter, titleTooShort && styles.validation]}>
            {titleTooShort ? t('compose.titleMinimum') : ''}
          </Text>
          <Text style={styles.counter}>{title.length}/60</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <CommunityRichEditor
        editable={!publishing}
        initialHtml={initialHtml}
        minHeight={isWide ? 360 : 280}
        onTextChange={setContentText}
        onTouchEnd={clearInteractiveTouch}
        onTouchStart={markInteractiveTouch}
        onUploadingChange={setUploadingImages}
        placeholder={t('compose.postPlaceholder')}
        ref={editorRef}
      />
      <View style={styles.metaRow}>
        <Text style={[styles.counter, contentTooShort && styles.validation]}>
          {contentTooShort ? t('compose.contentMinimum') : ''}
        </Text>
        <Text style={styles.counter}>
          {t('compose.characterCount', { count: contentText.trim().length })}
        </Text>
      </View>
    </View>
  );

  let body: ReactNode;
  if (loading) {
    body = <View style={styles.center}><ActivityIndicator /></View>;
  } else if (isWide) {
    // Landscape: the writing column takes the room, and the board, category,
    // and posting rules sit in a side panel instead of above the title.
    const panelWidth = Math.round(Math.min(320, Math.max(260, usableWidth * 0.3)));
    const writingPaneWidth = usableWidth - panelWidth - StyleSheet.hairlineWidth;
    const writingWidth = readingColumnWidth(writingPaneWidth, 24);
    body = (
      <HorizontalSafeArea style={[styles.root, styles.splitRow]}>
        <KeyboardAwareScrollView
          bottomOffset={16}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: Math.max(24, (writingPaneWidth - writingWidth) / 2) },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          disableScrollOnKeyboardHide
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          mode="layout"
          onTouchEnd={handleScrollTouchEnd}
          style={styles.scroll}
        >
          {errorState}
          {showForm ? writing : null}
        </KeyboardAwareScrollView>
        <View style={styles.splitDivider} />
        <ScrollView
          contentContainerStyle={[styles.panelContent, { paddingHorizontal: pageMargin }]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          style={[styles.fixedPane, { width: panelWidth }]}
        >
          {showForm ? settings : null}
          {!isEditing ? (
            <View style={styles.rules}>
              <Text style={styles.rulesTitle}>{t('compose.beforePostTitle')}</Text>
              <Text style={styles.rulesText}>{t('compose.beforePostMessage')}</Text>
            </View>
          ) : null}
        </ScrollView>
      </HorizontalSafeArea>
    );
  } else {
    body = (
      <HorizontalSafeArea style={styles.root}>
        <KeyboardAwareScrollView
          bottomOffset={16}
          contentContainerStyle={[styles.content, { paddingHorizontal: pageMargin }]}
          contentInsetAdjustmentBehavior="automatic"
          disableScrollOnKeyboardHide
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          mode="layout"
          onTouchEnd={handleScrollTouchEnd}
          style={styles.scroll}
        >
          {errorState}
          {showForm ? (
            <>
              {settings}
              {writing}
            </>
          ) : null}
        </KeyboardAwareScrollView>
      </HorizontalSafeArea>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? t('navigation.editPost') : t('navigation.newPost') }} />
      <View style={styles.root}>{body}</View>
      <CommunityPublishNavigation
        accessibilityLabel={isEditing ? t('accessibility.saveThread') : t('accessibility.publishDiscussion')}
        disabled={!canPublish}
        onPublish={() => void publish()}
      />
    </>
  );
}

/** A row of the inset settings group: label on the left, control on the right. */
function ComposeSettingRow({
  children,
  label,
  last,
}: {
  children: ReactNode;
  label: string;
  last: boolean;
}) {
  const styles = useCommunityComposeStyles();
  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingRowBody, !last && styles.settingSeparator]}>
        <Text style={styles.settingLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

/** SwiftUI menu picker hosted inside an RN row. */
function NativeMenuPicker({
  enabled,
  onValueChange,
  options,
  selectedValue,
}: {
  enabled: boolean;
  onValueChange(value: string): void;
  options: { label: string; value: string }[];
  selectedValue: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Host matchContents seedColor={colors.accent}>
      <NativePickerControl
        enabled={enabled}
        onValueChange={onValueChange}
        options={options}
        selectedValue={selectedValue}
      />
    </Host>
  );
}

function extractCommunityPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>(?=\s*)/giu, '\n')
    .replace(/<\/p>/giu, '\n')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const useCommunityComposeStyles = createThemedStyles((colors) => ({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: 20, paddingBottom: 48, paddingTop: 8 },
  counter: { color: colors.secondaryLabel, fontSize: 13 },
  // ScrollView defaults to flexGrow/flexShrink 1; pin the side panel to its width.
  fixedPane: { flexGrow: 0, flexShrink: 0 },
  divider: { backgroundColor: colors.separator, height: StyleSheet.hairlineWidth },
  group: { backgroundColor: colors.card, borderCurve: 'continuous', borderRadius: COMMUNITY_CARD_RADIUS, overflow: 'hidden' },
  groupFooter: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },
  metaRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginTop: 4 },
  panelContent: { gap: 24, paddingBottom: 32, paddingTop: 8 },
  root: { backgroundColor: colors.background, flex: 1 },
  rules: { gap: 6, paddingHorizontal: 16 },
  rulesText: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 19 },
  rulesTitle: { color: colors.label, fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1 },
  settingLabel: { color: colors.label, flex: 1, fontSize: 17 },
  settingRow: { paddingLeft: 16 },
  settingRowBody: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingRight: 8,
  },
  settingSeparator: { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth },
  settingsBlock: { gap: 8 },
  splitDivider: { backgroundColor: colors.separator, width: StyleSheet.hairlineWidth },
  splitRow: { flexDirection: 'row' },
  titleInput: {
    color: colors.label,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
    padding: 0,
  },
  validation: { color: colors.error },
  writing: { gap: 12 },
}));

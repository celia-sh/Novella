import { router, Stack } from 'expo-router';
import {
  Chip,
  FieldError,
  Input,
  Label,
  Spinner,
  TextField,
} from 'heroui-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { CommunityCatalogBoard } from '@novella/api-client';
import { COMMUNITY_STORAGE_KEYS } from '@novella/client-core';

import { CommunityPublishNavigation } from '@/components/community/community-navigation';
import {
  CommunityRichEditor,
  type CommunityRichEditorHandle,
} from '@/components/community/community-rich-editor';
import {
  CommunityErrorState,
  CommunityPaperProvider,
} from '@/components/community/community-ui';
import { showAlert } from '@/components/native-alert-dialog';
import { community, storage } from '@/services/client';
import { markCommunityThreadChanged } from '@/services/community-reply-events';
import { createThemedStyles } from '@/theme/app-theme';

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
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const editorRef = useRef<CommunityRichEditorHandle>(null);
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

  const selectedBoard = useMemo(
    () => boards.find((board) => board.key === boardKey) ?? null,
    [boardKey, boards],
  );
  const canPublish = Boolean(
    noticeAccepted &&
    !publishing &&
    boardKey &&
    title.trim().length >= 6 &&
    title.trim().length <= 60 &&
    contentText.trim().length >= 20 &&
    (!selectedBoard?.subCategories.length || subCategoryKey),
  );

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

  return (
    <CommunityPaperProvider>
      <>
        <Stack.Screen options={{ title: isEditing ? t('navigation.editPost') : t('navigation.newPost') }} />

          <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={88}
            style={styles.root}
          >
        {loading ? (
          <View style={styles.center}><Spinner /></View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <CommunityErrorState
                description={error}
                onRetry={() => {
                  setError(null);
                  setLoading(true);
                  setLoadToken((current) => current + 1);
                }}
                title={isEditing
                  ? t('compose.errors.prepareEditTitle')
                  : boards.length === 0
                    ? t('compose.errors.prepareTitle')
                    : t('compose.errors.publishTitle')}
              />
            ) : null}

            {!error || boards.length > 0 ? (
              <>
                <View style={styles.fieldGroup}>
              <Text style={styles.fieldHeading}>{t('compose.board')}</Text>
              <View style={styles.chips}>
                {boards.map((board) => (
                  <Chip
                    accessibilityState={{ selected: board.key === boardKey }}
                    color={board.key === boardKey ? 'accent' : 'default'}
                    key={board.key}
                    onPress={() => {
                      setBoardKey(board.key);
                      setSubCategoryKey('');
                    }}
                    variant={board.key === boardKey ? 'primary' : 'soft'}
                  >
                    {board.title}
                  </Chip>
                ))}
              </View>
              {selectedBoard?.description ? <Text style={styles.helper}>{selectedBoard.description}</Text> : null}
            </View>

            {selectedBoard?.subCategories.length ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldHeading}>{t('compose.category')}</Text>
                <View style={styles.chips}>
                  {selectedBoard.subCategories.map((category) => (
                    <Chip
                      accessibilityState={{ selected: category.key === subCategoryKey }}
                      color={category.key === subCategoryKey ? 'accent' : 'default'}
                      key={category.key}
                      onPress={() => setSubCategoryKey(category.key)}
                      variant={category.key === subCategoryKey ? 'primary' : 'soft'}
                    >
                      {category.label}
                    </Chip>
                  ))}
                </View>
                {!subCategoryKey ? <Text style={styles.validation}>{t('compose.selectCategory')}</Text> : null}
              </View>
            ) : null}

            <TextField isInvalid={title.length > 0 && title.trim().length < 6}>
              <Label>
                <Label.Text styles={{ text: styles.fieldHeading }}>{t('compose.title')}</Label.Text>
              </Label>
              <Input
                editable={!publishing}
                maxLength={60}
                onChangeText={setTitle}
                placeholder={t('compose.titlePlaceholder')}
                value={title}
              />
              <View style={styles.counterRow}>
                <FieldError>{t('compose.titleMinimum')}</FieldError>
                <Text style={styles.counter}>{title.length}/60</Text>
              </View>
            </TextField>

            <View style={styles.fieldGroup}>
              <View style={styles.counterRow}>
                <Text style={styles.fieldHeading}>{t('compose.post')}</Text>
                <Text style={styles.counter}>{t('compose.characterCount', { count: contentText.trim().length })}</Text>
              </View>
              <CommunityRichEditor
                editable={!publishing}
                initialHtml={initialHtml}
                onTextChange={setContentText}
                placeholder={t('compose.postPlaceholder')}
                ref={editorRef}
              />
              {contentText.length > 0 && contentText.trim().length < 20 ? (
                <Text style={styles.validation}>{t('compose.contentMinimum')}</Text>
              ) : null}
                </View>
              </>
            ) : null}
          </ScrollView>
        )}
          </KeyboardAvoidingView>

        <CommunityPublishNavigation
          accessibilityLabel={isEditing ? t('accessibility.saveThread') : t('accessibility.publishDiscussion')}
          disabled={!canPublish}
          onPublish={() => void publish()}
        />
      </>
    </CommunityPaperProvider>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  content: { gap: 20, padding: 16, paddingBottom: 48 },
  counter: { color: colors.secondaryLabel, fontSize: 12 },
  counterRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  fieldGroup: { gap: 9 },
  fieldHeading: { color: colors.label, fontSize: 15, fontWeight: '700' },
  helper: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 19 },
  root: { backgroundColor: colors.background, flex: 1 },
  validation: { color: colors.error, fontSize: 12 },
}));

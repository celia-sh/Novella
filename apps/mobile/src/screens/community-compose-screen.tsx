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
  Platform,
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
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import { NativeStackScrollEdgeMarker } from '@/components/native-stack-scroll-edge-marker';
import { showAlert } from '@/components/native-alert-dialog';
import { community, storage } from '@/services/client';
import { createThemedStyles } from '@/theme/app-theme';

export function CommunityComposeScreen({
  initialBoardKey = '',
  initialSubCategoryKey = '',
}: {
  initialBoardKey?: string;
  initialSubCategoryKey?: string;
}) {
  const styles = useCommunityComposeStyles();
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const editorRef = useRef<CommunityRichEditorHandle>(null);
  const [boards, setBoards] = useState<CommunityCatalogBoard[]>([]);
  const [boardKey, setBoardKey] = useState(initialBoardKey);
  const [subCategoryKey, setSubCategoryKey] = useState(initialSubCategoryKey);
  const [title, setTitle] = useState('');
  const [contentText, setContentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadToken, setLoadToken] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeAccepted, setNoticeAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      community.loadHome({ page: 1, size: 1 }),
      storage.get(COMMUNITY_STORAGE_KEYS.postNoticeAccepted),
    ]).then(([home, notice]) => {
      if (!active) return;
      setBoards(home.catalogBoards.filter((board) => board.key !== 'all'));
      if (initialBoardKey && home.catalogBoards.some((board) => board.key === initialBoardKey)) {
        setBoardKey(initialBoardKey);
      }
      setNoticeAccepted(notice === 'true');
      if (notice !== 'true') showFirstPostNotice();
      setLoading(false);
    }).catch((loadError: unknown) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : t('compose.errors.prepare'));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [initialBoardKey, initialSubCategoryKey, loadToken, t]);

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
      const thread = await community.createThread({
        boardKey,
        subCategoryKey,
        title,
        contentHtml,
        contentText,
      });
      router.replace({
        pathname: '/thread/[id]',
        params: { id: String(thread.id), initialTitle: thread.title },
      });
    } catch (publishError) {
      showAlert(
        t('compose.errors.publishDiscussionTitle'),
        publishError instanceof Error
          ? publishError.message
          : t('compose.errors.publishDiscussion'),
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <CommunityPaperProvider>
      <>
        <Stack.Screen options={{ title: t('navigation.newPost') }} />
      <NativeScreenScaffold
        actions={[
          {
            accessibilityLabel: t('accessibility.publishDiscussion'),
            enabled: canPublish,
            icon: 'check',
            id: 'publish',
          },
        ]}
        largeTitle={false}
        onActionPress={(id) => {
          if (id === 'publish') void publish();
        }}
        onBackPress={() => router.back()}
        showBackButton
        title={t('navigation.newPost')}
      >
        <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.root}
      >
        {loading ? (
          <View style={styles.center}><Spinner /></View>
        ) : (
          <NativeStackScrollEdgeMarker>
          <ScrollView
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {error ? (
              <CommunityErrorState
                description={error}
                onRetry={() => {
                  setError(null);
                  if (boards.length === 0) {
                    setLoading(true);
                    setLoadToken((current) => current + 1);
                  }
                }}
                title={boards.length === 0 ? t('compose.errors.prepareTitle') : t('compose.errors.publishTitle')}
              />
            ) : null}

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
                onTextChange={setContentText}
                placeholder={t('compose.postPlaceholder')}
                ref={editorRef}
              />
              {contentText.length > 0 && contentText.trim().length < 20 ? (
                <Text style={styles.validation}>{t('compose.contentMinimum')}</Text>
              ) : null}
            </View>
          </ScrollView>
          </NativeStackScrollEdgeMarker>
        )}
      </KeyboardAvoidingView>
      </NativeScreenScaffold>
        <CommunityPublishNavigation disabled={!canPublish} onPublish={() => void publish()} />
      </>
    </CommunityPaperProvider>
  );
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

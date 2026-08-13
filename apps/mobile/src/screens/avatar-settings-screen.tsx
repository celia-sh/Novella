import { FieldError, Input, Label, TextField } from 'heroui-native';
import type { TFunction } from 'i18next';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  parseAvatarSource,
  resolveAvatarUrl,
  type AvatarSource,
} from '@novella/client-core';

import { NativeSegmentedControl } from '@/components/native-segmented-control';
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import { NativeStackScrollEdgeMarker } from '@/components/native-stack-scroll-edge-marker';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useProfile } from '@/hooks/use-profile';
import { profile as profileUseCase } from '@/services/client';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

type AvatarDrafts = Record<AvatarSource, string>;
type AvatarError =
  | { kind: 'key'; key: 'avatar.errors.invalidSource' | 'avatar.errors.updateFailed' }
  | { kind: 'raw'; text: string };

export function AvatarSettingsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useAvatarSettingsScreenStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('settings');
  const { error: loadError, profile, reload, status } = useProfile();
  const hydratedProfileId = useRef<number | null>(null);
  const [source, setSource] = useState<AvatarSource>('url');
  const [drafts, setDrafts] = useState<AvatarDrafts>({ qq: '', qqGroup: '', url: '' });
  const [error, setError] = useState<AvatarError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile || hydratedProfileId.current === profile.id) return;
    hydratedProfileId.current = profile.id;
    const initial = parseAvatarSource(profile.avatarUrl);
    setSource(initial.source);
    setDrafts((current) => ({ ...current, [initial.source]: initial.value }));
  }, [profile]);

  if (!profile) {
    return (
      <NativeScreenScaffold
        largeTitle={false}
        onBackPress={() => router.back()}
        showBackButton
        title={t('avatar.title')}
      >
        <View style={styles.loadingRoot}>
          {status === 'loading' ? <ActivityIndicator color={colors.accent as string} /> : null}
          <Text style={styles.loadingTitle}>
            {loadError ? t('avatar.loadFailed') : t('avatar.loadingProfile')}
          </Text>
          {status !== 'loading' ? (
            <Pressable onPress={() => void reload()} style={styles.retryButton}>
              <Text style={styles.retryLabel}>{t('avatar.tryAgain')}</Text>
            </Pressable>
          ) : null}
        </View>
      </NativeScreenScaffold>
    );
  }

  const value = drafts[source];
  const fieldCopy = getAvatarFieldCopy(source, t);
  const previewUrl = getPreviewUrl(source, value, profile.avatarUrl);

  async function save() {
    if (saving) return;
    setError(null);
    let avatarUrl: string;
    try {
      avatarUrl = resolveAvatarUrl(source, value);
    } catch {
      setError({ kind: 'key', key: 'avatar.errors.invalidSource' });
      return;
    }
    setSaving(true);
    try {
      await profileUseCase.setAvatar(avatarUrl);
      router.back();
    } catch (saveError) {
      setError(saveError instanceof Error
        ? { kind: 'raw', text: saveError.message }
        : { kind: 'key', key: 'avatar.errors.updateFailed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <NativeScreenScaffold
      largeTitle={false}
      onBackPress={() => router.back()}
      showBackButton
      title={t('avatar.title')}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <NativeStackScrollEdgeMarker>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(28, insets.bottom + 20) }]}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.introduction}>
          <Text style={styles.title}>{t('avatar.changeTitle')}</Text>
          <Text style={styles.description}>{t('avatar.description')}</Text>
        </View>

        <View style={styles.previewCard}>
          <ProfileAvatar avatarUrl={previewUrl} size={64} userName={profile.userName} />
          <View style={styles.previewCopy}>
            <Text numberOfLines={1} style={styles.previewName}>{profile.userName || t('avatar.profileAvatar')}</Text>
            <Text style={styles.previewDescription}>{t('avatar.livePreview')}</Text>
          </View>
        </View>

        <NativeSegmentedControl
          enabled={!saving}
          onValueChange={(nextSource) => {
            setSource(nextSource);
            setError(null);
          }}
          options={[
            { label: t('avatar.sources.imageUrl'), value: 'url' },
            { label: t('avatar.sources.qqAvatar'), value: 'qq' },
            { label: t('avatar.sources.qqGroup'), value: 'qqGroup' },
          ] as const}
          selectedValue={source}
        />

        <View style={styles.fieldGroup}>
          <TextField isDisabled={saving} isInvalid={error !== null}>
            <Label>{fieldCopy.label}</Label>
            <Input
              accessibilityLabel={fieldCopy.label}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={source === 'url' ? 'url' : 'number-pad'}
              onChangeText={(nextValue) => {
                setDrafts((current) => ({ ...current, [source]: nextValue }));
                setError(null);
              }}
              onSubmitEditing={() => void save()}
              placeholder={fieldCopy.placeholder}
              returnKeyType="done"
              value={value}
            />
            {error ? (
              <FieldError>{error.kind === 'raw' ? error.text : t(error.key)}</FieldError>
            ) : (
              <Text style={styles.fieldHint}>{fieldCopy.hint}</Text>
            )}
          </TextField>
        </View>

        <Pressable
          accessibilityLabel={saving ? t('avatar.saving') : t('avatar.save')}
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void save()}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, saving && styles.disabled]}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : null}
          <Text style={styles.saveLabel}>{saving ? t('avatar.saving') : t('avatar.save')}</Text>
        </Pressable>
        </ScrollView>
        </NativeStackScrollEdgeMarker>
      </KeyboardAvoidingView>
    </NativeScreenScaffold>
  );
}

function getPreviewUrl(source: AvatarSource, value: string, fallback: string): string {
  if (!value.trim()) return fallback;
  try {
    return resolveAvatarUrl(source, value);
  } catch {
    return fallback;
  }
}

function getAvatarFieldCopy(
  source: AvatarSource,
  t: TFunction<'settings'>,
): { hint: string; label: string; placeholder: string } {
  switch (source) {
    case 'url':
      return {
        hint: t('avatar.hints.imageUrl'),
        label: t('avatar.fields.imageUrl'),
        placeholder: 'https://example.com/avatar.jpg',
      };
    case 'qq':
      return {
        hint: t('avatar.hints.qqNumber'),
        label: t('avatar.fields.qqNumber'),
        placeholder: t('avatar.placeholders.qqNumber'),
      };
    case 'qqGroup':
      return {
        hint: t('avatar.hints.qqGroupNumber'),
        label: t('avatar.fields.qqGroupNumber'),
        placeholder: t('avatar.placeholders.qqGroupNumber'),
      };
  }
}

const useAvatarSettingsScreenStyles = createThemedStyles((colors) => ({
  content: { gap: 22, paddingHorizontal: 20, paddingTop: 24 },
  description: { color: colors.secondaryLabel, fontSize: 16, lineHeight: 23 },
  disabled: { opacity: 0.55 },
  fieldGroup: { gap: 8 },
  fieldHint: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 18, paddingHorizontal: 2 },
  introduction: { gap: 7 },
  loadingRoot: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: 14, justifyContent: 'center', padding: 24 },
  loadingTitle: { color: colors.secondaryLabel, fontSize: 15, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  previewCard: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 20, flexDirection: 'row', gap: 14, padding: 16 },
  previewCopy: { flex: 1, gap: 3 },
  previewDescription: { color: colors.secondaryLabel, fontSize: 14 },
  previewName: { color: colors.label, fontSize: 17, fontWeight: '700' },
  retryButton: { padding: 10 },
  retryLabel: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  root: { backgroundColor: colors.background, flex: 1 },
  saveButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52, paddingHorizontal: 18 },
  saveLabel: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  title: { color: colors.label, fontSize: 30, fontWeight: '700', letterSpacing: -0.6, lineHeight: 36 },
}));

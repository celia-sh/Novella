import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { showAlert } from '@/components/native-alert-dialog';

import {
  NativeGroupedList,
  NativeGroupedListRow,
  NativeGroupedListSection,
} from '@/components/native-grouped-list';
import { ProfileAvatar } from '@/components/profile-avatar';
import { DisclosureIcon, NativeListValue } from '@/components/settings-row-accessories';
import { useAuthentication } from '@/hooks/use-authentication';
import { useProfile } from '@/hooks/use-profile';
import { formatDate } from '@/localization/formatters';
import type { AppLocale } from '@/localization/locale';
import { useAppLocale } from '@/localization/localization-provider';
import { authentication, profile as profileUseCase } from '@/services/client';

type CopyableProfileField = 'email' | 'inviteCode' | 'uid' | 'userName';

export function ProfileScreen() {
  const auth = useAuthentication();
  const locale = useAppLocale();
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const { error, profile, reload, status } = useProfile();
  const [copiedField, setCopiedField] = useState<CopyableProfileField | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [resettingInviteCode, setResettingInviteCode] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function copy(field: CopyableProfileField, value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    await Clipboard.setStringAsync(normalized);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopiedField(field);
    copyTimer.current = setTimeout(() => setCopiedField(null), 1_200);
  }

  async function checkIn() {
    if (!profile || profile.growth.signedToday || checkingIn) return;
    setCheckingIn(true);
    try {
      const outcome = await profileUseCase.checkIn();
      showAlert(
        t('profile.checkIn.successTitle'),
        t('profile.checkIn.successMessage', {
          reward: outcome.result.reward,
          streak: outcome.result.streak,
        }),
      );
    } catch (checkInError) {
      showAlert(
        t('profile.checkIn.failedTitle'),
        checkInError instanceof Error ? checkInError.message : t('profile.tryAgain'),
      );
    } finally {
      setCheckingIn(false);
    }
  }

  function openPointLogs(kind: 'experience' | 'coin') {
    router.push({ pathname: '/settings/point-logs', params: { kind } });
  }

  function confirmResetInviteCode() {
    if (!profile || resettingInviteCode) return;
    showAlert(t('profile.resetInvite.confirmTitle'), t('profile.resetInvite.confirmMessage'), [
      { style: 'cancel', text: tCommon('actions.cancel') },
      {
        style: 'destructive',
        text: tCommon('actions.confirm'),
        onPress: () => {
          setResettingInviteCode(true);
          void profileUseCase.resetInviteCode()
            .then((outcome) => {
              showAlert(
                t('profile.resetInvite.successTitle'),
                t('profile.resetInvite.successMessage', { code: outcome.result.inviteCode }),
              );
            })
            .catch((resetError) => {
              showAlert(
                t('profile.resetInvite.failedTitle'),
                resetError instanceof Error ? resetError.message : t('profile.tryAgain'),
              );
            })
            .finally(() => setResettingInviteCode(false));
        },
      },
    ]);
  }

  function confirmSignOut() {
    if (signingOut || auth.status === 'signingOut') return;
    showAlert(t('profile.signOut.confirmTitle'), t('profile.signOut.confirmMessage'), [
      { style: 'cancel', text: tCommon('actions.cancel') },
      {
        style: 'destructive',
        text: t('profile.signOut.title'),
        onPress: () => {
          setSigningOut(true);
          void authentication.signOut().catch((signOutError) => {
            setSigningOut(false);
            showAlert(
              t('profile.signOut.failedTitle'),
              signOutError instanceof Error ? signOutError.message : t('profile.tryAgain'),
            );
          });
        },
      },
    ]);
  }

  return (
    <NativeGroupedList
      testID="profile-screen"
    >
      {!profile ? (
        <NativeGroupedListSection title={t('profile.sections.profile')}>
          <NativeGroupedListRow
            description={error ? t('profile.tryAgain') : t('profile.retrieving')}
            disabled={status === 'loading'}
            icon={error ? 'profileError' : 'profileStatus'}
            {...(status === 'loading' ? {} : { onPress: () => void reload() })}
            title={status === 'loading' ? t('profile.loading') : t('profile.loadFailed')}
            trailing={status === 'loading' ? undefined : <DisclosureIcon />}
          />
        </NativeGroupedListSection>
      ) : (
        <>
          <NativeGroupedListSection title={t('profile.sections.personal')}>
            <NativeGroupedListRow
              description={t('profile.avatarDescription')}
              icon="avatar"
              onPress={() => router.push('/settings/avatar')}
              title={t('profile.avatarTitle')}
              trailing={(
                <ProfileAvatar
                  avatarUrl={profile.avatarUrl}
                  size={42}
                  userName={profile.userName}
                />
              )}
            />
            <CopyableValueRow
              copied={copiedField === 'uid'}
              icon="uid"
              label="UID"
              onCopy={() => void copy('uid', String(profile.id))}
              value={String(profile.id)}
            />
            <CopyableValueRow
              copied={copiedField === 'userName'}
              icon="userName"
              label={t('profile.fields.username')}
              onCopy={() => void copy('userName', profile.userName)}
              value={displayValue(profile.userName, t('profile.unavailable'))}
            />
            <CopyableValueRow
              copied={copiedField === 'email'}
              icon="email"
              label={t('profile.fields.email')}
              onCopy={() => void copy('email', profile.email)}
              value={displayValue(profile.email, t('profile.unavailable'))}
            />
            <CopyableValueRow
              copied={copiedField === 'inviteCode'}
              disabled={!profile.inviteCode.trim()}
              icon="inviteCode"
              label={t('profile.fields.inviteCode')}
              onCopy={() => void copy('inviteCode', profile.inviteCode)}
              value={profile.inviteCode.trim()
                ? '•'.repeat(profile.inviteCode.trim().length)
                : t('profile.unavailable')}
            />
            <StaticValueRow icon="userGroup" label={t('profile.fields.userGroup')} value={displayValue(profile.groupName, t('profile.unavailable'))} />
            <StaticValueRow icon="registered" label={t('profile.fields.registered')} value={formatProfileDate(profile.registeredAt, locale, t('profile.unavailable'))} />
          </NativeGroupedListSection>

          <NativeGroupedListSection title={t('profile.sections.growth')}>
            <StaticValueRow
              description={t('profile.fields.levelDescription')}
              icon="level"
              label={t('profile.fields.level')}
              value={t('profile.fields.levelValue', { level: profile.growth.level })}
            />
            <StaticValueRow
              description={t('profile.tapToViewLogs')}
              icon="experience"
              label={t('profile.fields.experience')}
              onPress={() => openPointLogs('experience')}
              value={new Intl.NumberFormat(locale).format(profile.growth.experience)}
            />
            <StaticValueRow
              description={t('profile.tapToViewLogs')}
              icon="coins"
              label={t('profile.fields.coins')}
              onPress={() => openPointLogs('coin')}
              value={new Intl.NumberFormat(locale).format(profile.growth.coin)}
            />
            <NativeGroupedListRow
              description={t('profile.shopDescription')}
              icon="shop"
              onPress={() => router.push('/settings/shop')}
              title={t('profile.shopTitle')}
              trailing={<DisclosureIcon />}
            />
            <NativeGroupedListRow
              description={profile.growth.signedToday
                ? t('profile.checkIn.signedDescription', { days: profile.growth.signInStreak })
                : t('profile.checkIn.availableDescription', { days: profile.growth.signInStreak })}
              disabled={profile.growth.signedToday || checkingIn}
              icon="checkIn"
              {...(profile.growth.signedToday ? {} : { onPress: () => void checkIn() })}
              title={checkingIn ? t('profile.checkIn.checking') : t('profile.checkIn.title')}
              trailing={<NativeListValue>{profile.growth.signedToday ? t('profile.checkIn.done') : t('profile.checkIn.action')}</NativeListValue>}
            />
          </NativeGroupedListSection>
        </>
      )}

      <NativeGroupedListSection title={t('profile.sections.account')}>
        <NativeGroupedListRow
          description={t('profile.resetInvite.description')}
          disabled={!profile}
          icon="inviteCode"
          onPress={confirmResetInviteCode}
          title={t('profile.resetInvite.title')}
        />
        <NativeGroupedListRow
          description={t('profile.signOut.description')}
          disabled={signingOut || auth.status === 'signingOut'}
          icon="signOut"
          onPress={confirmSignOut}
          title={signingOut || auth.status === 'signingOut' ? t('profile.signOut.signing') : t('profile.signOut.title')}
        />
      </NativeGroupedListSection>
    </NativeGroupedList>
  );
}

function CopyableValueRow({
  copied,
  disabled = false,
  icon,
  label,
  onCopy,
  value,
}: {
  copied: boolean;
  disabled?: boolean;
  icon: 'email' | 'inviteCode' | 'uid' | 'userName';
  label: string;
  onCopy: () => void;
  value: string;
}) {
  const { t } = useTranslation('settings');
  return (
    <NativeGroupedListRow
      {...(disabled ? {} : { description: copied ? t('profile.copied') : t('profile.tapToCopy') })}
      disabled={disabled}
      icon={icon}
      onPress={onCopy}
      title={label}
      trailing={<NativeListValue>{copied ? t('profile.copied') : value}</NativeListValue>}
    />
  );
}

function StaticValueRow({
  description,
  icon,
  label,
  onPress,
  value,
}: {
  description?: string;
  icon: 'coins' | 'experience' | 'level' | 'registered' | 'userGroup';
  label: string;
  onPress?: () => void;
  value: string;
}) {
  return (
    <NativeGroupedListRow
      {...(description ? { description } : {})}
      icon={icon}
      {...(onPress ? { onPress } : {})}
      title={label}
      trailing={<NativeListValue>{value}</NativeListValue>}
    />
  );
}

function displayValue(value: string, unavailable: string): string {
  return value.trim() || unavailable;
}

function formatProfileDate(value: string | null, locale: AppLocale, unavailable: string): string {
  if (!value) return unavailable;
  return formatDate(value, locale) || unavailable;
}

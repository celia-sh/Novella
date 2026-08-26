import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AuthFormError,
  AuthFormLayout,
  AuthSubmitButton,
} from '@/components/auth-form-layout';
import { VerificationCodeField } from '@/components/auth-fields';
import { authFlowSession } from '@/services/auth-flow-session';
import { authentication } from '@/services/client';

type ResetVerifyError =
  | { kind: 'key'; key: 'verification.invalidCode' | 'resetPassword.errors.sendCodeFailed' }
  | { kind: 'raw'; text: string };

export default function ResetPasswordVerifyRoute() {
  const [draft] = useState(() => authFlowSession.getPasswordReset());
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<ResetVerifyError | null>(null);
  const { t } = useTranslation('auth');

  useEffect(() => {
    if (!draft) router.replace('/reset-password');
  }, [draft]);

  useEffect(() => {
    if (cooldown === 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function resend() {
    if (!draft) return;
    setError(null);
    setIsSending(true);
    try {
      await authentication.sendResetCode(draft.email);
      setCooldown(60);
    } catch (sendError) {
      setError(getResetVerifyError(sendError));
    } finally {
      setIsSending(false);
    }
  }

  function continueToPassword() {
    if (!draft) return;
    if (code.length !== 4) {
      setError({ kind: 'key', key: 'verification.invalidCode' });
      return;
    }
    authFlowSession.setPasswordReset({ ...draft, code });
    router.push('/reset-password/new-password');
  }

  if (!draft) return null;
  return (
    <AuthFormLayout
      description={t('resetPassword.verify.description', { email: draft.email })}
      title={t('resetPassword.verify.title')}
    >
      <View style={styles.form}>
        <VerificationCodeField
          cooldown={cooldown}
          error={Boolean(error && code.length !== 4)}
          isSending={isSending}
          onChangeText={setCode}
          onSend={() => void resend()}
          value={code}
        />
        <AuthFormError message={error?.kind === 'raw' ? error.text : error ? t(error.key) : null} />
        <AuthSubmitButton
          idleLabel={t('resetPassword.verify.continue')}
          isSubmitting={false}
          onPress={continueToPassword}
          submittingLabel={t('resetPassword.verify.continue')}
        />
      </View>
    </AuthFormLayout>
  );
}

function getResetVerifyError(error: unknown): ResetVerifyError {
  return error instanceof Error
    ? { kind: 'raw', text: error.message }
    : { kind: 'key', key: 'resetPassword.errors.sendCodeFailed' };
}

const styles = StyleSheet.create({ form: { gap: 18 } });

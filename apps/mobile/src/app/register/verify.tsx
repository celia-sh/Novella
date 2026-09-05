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

type RegisterVerifyError =
  | { kind: 'key'; key: 'verification.invalidCode' | 'register.errors.sendCodeFailed' | 'register.errors.createAccountFailed' }
  | { kind: 'raw'; text: string };

export default function RegisterVerifyRoute() {
  const [draft] = useState(() => authFlowSession.getRegistration());
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [isSending, setIsSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<RegisterVerifyError | null>(null);
  const { t } = useTranslation('auth');

  useEffect(() => {
    if (!draft) router.replace('/register');
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
      await authentication.sendRegisterCode(draft.email);
      setCooldown(60);
    } catch (sendError) {
      setError(getRegisterVerifyError(sendError, 'register.errors.sendCodeFailed'));
    } finally {
      setIsSending(false);
    }
  }

  async function submit() {
    if (!draft) return;
    if (code.length !== 4) {
      setError({ kind: 'key', key: 'verification.invalidCode' });
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authentication.register({ ...draft, code });
      authFlowSession.clearRegistration();
    } catch (submitError) {
      setError(getRegisterVerifyError(submitError, 'register.errors.createAccountFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!draft) return null;
  return (
    <AuthFormLayout
      description={t('register.verify.description', { email: draft.email })}
      title={t('register.verify.title')}
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
          idleLabel={t('register.verify.submit')}
          isSubmitting={isSubmitting}
          onPress={() => void submit()}
          submittingLabel={t('register.verify.submitting')}
        />
      </View>
    </AuthFormLayout>
  );
}

function getRegisterVerifyError(
  error: unknown,
  fallback: Extract<RegisterVerifyError, { kind: 'key' }>['key'],
): RegisterVerifyError {
  return error instanceof Error
    ? { kind: 'raw', text: error.message }
    : { kind: 'key', key: fallback };
}

const styles = StyleSheet.create({ form: { gap: 18 } });

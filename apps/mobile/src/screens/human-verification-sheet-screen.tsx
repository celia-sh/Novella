import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { TurnstileWebView } from '@/components/turnstile-web-view';
import { TURNSTILE_LOAD_ERROR_CODES, type TurnstileMessage } from '@/services/turnstile';
import {
  closeTurnstileSession,
  markTurnstileSessionPresented,
  useTurnstileSession,
} from '@/services/turnstile-session';
import { createThemedStyles, resolveAccentHex, useAppTheme } from '@/theme/app-theme';

/** The visible page gets longer than the invisible path before it calls a load stuck. */
const SHEET_TIMEOUT_MS = 30_000;

/**
 * Visible Turnstile challenge for a form's pending token request. Settles the
 * session exactly once: with a token, or as cancelled when dismissed.
 */
export function HumanVerificationSheetScreen() {
  const session = useTurnstileSession();
  const styles = useHumanVerificationStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('auth');
  const sessionRef = useRef(session);
  const settledRef = useRef(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [waitingForClick, setWaitingForClick] = useState(false);

  if (session) sessionRef.current = session;

  useEffect(() => {
    if (sessionRef.current) markTurnstileSessionPresented(sessionRef.current);
    return () => {
      const current = sessionRef.current;
      if (!current) return;
      if (!settledRef.current) current.onCancel();
      closeTurnstileSession(current);
    };
  }, []);

  // A page that neither passes, asks for a click, nor errors is stuck.
  useEffect(() => {
    if (errorCode !== null || waitingForClick) return undefined;
    const timer = setTimeout(() => setErrorCode('timeout'), SHEET_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [errorCode, generation, waitingForClick]);

  const onMessage = useCallback((message: TurnstileMessage) => {
    switch (message.type) {
      case 'token':
        if (settledRef.current) return;
        settledRef.current = true;
        sessionRef.current?.onToken(message.token);
        router.back();
        return;
      case 'interactive':
        setWaitingForClick(message.visible);
        return;
      case 'error':
        setErrorCode(message.code);
        return;
      case 'expired':
        return;
    }
  }, []);

  const retry = useCallback(() => {
    setErrorCode(null);
    setWaitingForClick(false);
    setGeneration((value) => value + 1);
  }, []);

  if (!session) return null;

  return (
    <View style={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.title}>{t('captcha.sheetTitle')}</Text>
        <Text style={styles.subtitle}>{t('captcha.sheetDescription')}</Text>
      </View>
      {errorCode === null ? (
        <TurnstileWebView
          action={session.action}
          appearance="always"
          key={generation}
          onMessage={onMessage}
        />
      ) : (
        <View accessibilityLiveRegion="polite" style={styles.failure}>
          <Text style={styles.failureText}>
            {TURNSTILE_LOAD_ERROR_CODES.has(errorCode)
              ? t('captcha.loadFailed')
              : t('captcha.failed', { code: errorCode })}
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={retry}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={[styles.retry, { color: resolveAccentHex(colors.accent) }]}>
              {t('captcha.retry')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const useHumanVerificationStyles = createThemedStyles((colors) => ({
  content: {
    backgroundColor: colors.background,
    gap: 20,
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  // Same height as the widget, so the sheet does not jump when a load fails.
  failure: { alignItems: 'center', flexDirection: 'row', gap: 12, height: 65 },
  failureText: { color: colors.error, flex: 1, fontSize: 15, lineHeight: 21 },
  heading: { gap: 5 },
  pressed: { opacity: 0.68 },
  retry: { fontSize: 15, fontWeight: '600' },
  subtitle: { color: colors.secondaryLabel, fontSize: 14, lineHeight: 20 },
  title: { color: colors.label, fontSize: 20, fontWeight: '700', lineHeight: 26 },
}));

import { toast } from 'react-native-pretty-toast';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthentication } from '@/hooks/use-authentication';
import { useClientSession } from '@/hooks/use-client-session';

const RECONNECT_TOAST_ID = 'novella-client-reconnecting';
const SESSION_EXPIRED_TOAST_ID = 'novella-session-expired';

export interface ClientSessionFeedbackProps {
  hasStoredSession: boolean;
  sessionDecided: boolean;
}

export function ClientSessionFeedback({
  hasStoredSession,
  sessionDecided,
}: ClientSessionFeedbackProps) {
  const session = useClientSession();
  const authentication = useAuthentication();
  const { t } = useTranslation('common');
  const reconnectToastId = useRef<string | null>(null);
  const recoveryObserved = useRef(false);
  const previousAuthStatus = useRef(authentication.status);

  useEffect(() => {
    if (!sessionDecided) return;

    if (session.status === 'reconnecting') {
      recoveryObserved.current = hasStoredSession || authentication.status === 'authenticated';
      if (!recoveryObserved.current || reconnectToastId.current) return;

      reconnectToastId.current = toast.show(
        {
          autoDismiss: false,
          enableSwipeDismiss: false,
          icon: 'arrow.triangle.2.circlepath',
          id: RECONNECT_TOAST_ID,
          message: t('connection.reconnectingMessage'),
          title: t('connection.reconnectingTitle'),
        },
        { force: true },
      );
      return;
    }

    if (session.status !== 'ready' || !recoveryObserved.current) return;
    recoveryObserved.current = false;
    if (!reconnectToastId.current) return;

    toast.update(reconnectToastId.current, {
      autoDismiss: true,
      duration: 1_800,
      enableSwipeDismiss: true,
      icon: 'checkmark.circle.fill',
      message: t('connection.reconnectedMessage'),
      title: t('connection.reconnectedTitle'),
    });
    reconnectToastId.current = null;
  }, [authentication.status, hasStoredSession, session.status, sessionDecided, t]);

  useEffect(() => {
    const previousStatus = previousAuthStatus.current;
    previousAuthStatus.current = authentication.status;
    if (!sessionDecided || authentication.status !== 'signedOut') return;
    if (previousStatus === 'signingOut') return;
    if (!hasStoredSession && !recoveryObserved.current) return;

    recoveryObserved.current = false;
    if (reconnectToastId.current) {
      toast.dismiss(reconnectToastId.current);
      reconnectToastId.current = null;
    }
    toast.show(
      {
        icon: 'person.crop.circle.badge.xmark',
        id: SESSION_EXPIRED_TOAST_ID,
        message: t('connection.sessionExpiredMessage'),
        title: t('connection.sessionExpiredTitle'),
      },
      { force: true },
    );
  }, [authentication.status, hasStoredSession, sessionDecided, t]);

  return null;
}

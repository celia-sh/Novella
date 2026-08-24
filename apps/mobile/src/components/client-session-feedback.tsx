import { toast } from '@celia-sh/react-native-pretty-toast';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthentication } from '@/hooks/use-authentication';
import { useClientSession } from '@/hooks/use-client-session';

const RECONNECT_TOAST_ID = 'novella-client-reconnecting';
const SESSION_EXPIRED_TOAST_ID = 'novella-session-expired';

export interface ClientSessionFeedbackProps {
  sessionDecided: boolean;
}

export function ClientSessionFeedback({
  sessionDecided,
}: ClientSessionFeedbackProps) {
  const session = useClientSession();
  const authentication = useAuthentication();
  const { t } = useTranslation('common');
  const reconnectToastId = useRef<string | null>(null);
  const recoveryObserved = useRef(false);
  const sessionReadyObserved = useRef(false);
  const previousAuthStatus = useRef(authentication.status);

  useEffect(() => {
    if (!sessionDecided) return;

    if (session.status === 'ready') {
      sessionReadyObserved.current = true;
      if (!recoveryObserved.current || !reconnectToastId.current) return;

      toast.update(reconnectToastId.current, {
        autoDismiss: true,
        duration: 1_800,
        enableSwipeDismiss: true,
        icon: 'checkmark.circle.fill',
        message: t('connection.reconnectedMessage'),
        title: t('connection.reconnectedTitle'),
      });
      recoveryObserved.current = false;
      reconnectToastId.current = null;
      return;
    }

    if (session.status === 'signedOut') {
      sessionReadyObserved.current = false;
    }

    if (session.status === 'reconnecting') {
      if (!sessionReadyObserved.current || reconnectToastId.current) return;
      recoveryObserved.current = true;

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
  }, [session.status, sessionDecided, t]);

  useEffect(() => {
    const previousStatus = previousAuthStatus.current;
    previousAuthStatus.current = authentication.status;
    if (!sessionDecided || authentication.status !== 'signedOut') return;
    if (previousStatus === 'signingOut') {
      sessionReadyObserved.current = false;
      recoveryObserved.current = false;
      return;
    }
    if (!sessionReadyObserved.current && !recoveryObserved.current) return;

    sessionReadyObserved.current = false;
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
  }, [authentication.status, sessionDecided, t]);

  return null;
}

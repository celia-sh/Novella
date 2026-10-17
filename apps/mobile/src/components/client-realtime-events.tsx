import { toast } from '@celia-sh/react-native-pretty-toast';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  decodeDirectMessageBlockChangedEvent,
  decodeDirectMessageEvent,
  decodeDirectMessageReadEvent,
  decodeUserGrowth,
} from '@novella/api-client';

import { useAppLocale } from '@/localization/localization-provider';
import { formatCompactNumber } from '@/localization/formatters';
import {
  directMessages,
  profile,
  subscribeClientRealtime,
  subscribeClientRealtimeReconnect,
} from '@/services/client';
import { useProfile } from '@/hooks/use-profile';
import { useClientSession } from '@/hooks/use-client-session';
import { createDirectMessageRefresh } from '@/services/direct-message-refresh';

const refreshDirectMessages = createDirectMessageRefresh(profile, directMessages);

function signedNumber(value: number, locale: 'zh-CN' | 'zh-TW'): string {
  const formatted = formatCompactNumber(Math.abs(value), locale);
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

export function ClientRealtimeEvents() {
  const { t } = useTranslation('common');
  const locale = useAppLocale();
  const { profile: currentProfile } = useProfile();
  const session = useClientSession();

  useEffect(() => subscribeClientRealtimeReconnect(() => {
    if (profile.getSnapshot()?.id) void refreshDirectMessages(true);
  }), []);

  useEffect(() => {
    if (session.status === 'ready' && currentProfile?.id) {
      void refreshDirectMessages(true);
    }
  }, [currentProfile?.id, session.status]);

  useEffect(() => {
    const unsubscribeNotificationRefresh = subscribeClientRealtime(
      'OnNotificationRefresh',
      () => {
        void profile.refresh().catch(() => undefined);
      },
    );
    const unsubscribeGrowth = subscribeClientRealtime(
      'OnGrowthUpdate',
      (payload) => {
        try {
          const growth = decodeUserGrowth(payload);
          const delta = profile.applyGrowth(growth);
          if (!delta) {
            void profile.load().catch(() => undefined);
            return;
          }

          const parts: string[] = [];
          if (delta.experienceDelta !== 0) {
            parts.push(t('realtime.experienceDelta', {
              value: signedNumber(delta.experienceDelta, locale),
            }));
          }
          if (delta.coinDelta !== 0) {
            parts.push(t('realtime.coinDelta', {
              value: signedNumber(delta.coinDelta, locale),
            }));
          }
          if (parts.length > 0) {
            toast.show({
              duration: 2_000,
              icon: delta.experienceDelta < 0 || delta.coinDelta < 0
                ? 'exclamationmark.triangle.fill'
                : 'chart.line.uptrend.xyaxis',
              message: parts.join(' · '),
              title: t('realtime.growthUpdateTitle'),
            });
          }
        } catch {
          // Ignore malformed future events; the next profile refresh remains authoritative.
        }
      },
    );

    const unsubscribeDirectMessage = subscribeClientRealtime(
      'OnDirectMessage',
      (payload) => {
        try {
          const event = decodeDirectMessageEvent(payload);
          directMessages.applyIncomingMessage(event);
          void refreshDirectMessages();
        } catch {
          // Ignore malformed events
        }
      },
    );

    const unsubscribeDirectMessageRead = subscribeClientRealtime(
      'OnDirectMessageRead',
      (payload) => {
        try {
          const event = decodeDirectMessageReadEvent(payload);
          if (currentProfile?.id) {
            directMessages.applyReadReceipt(event, currentProfile.id);
            if (event.readerId === currentProfile.id) void refreshDirectMessages();
          }
        } catch {
          // Ignore malformed events
        }
      },
    );

    const unsubscribeDirectMessageBlockChanged = subscribeClientRealtime(
      'OnDirectMessageBlockChanged',
      (payload) => {
        try {
          const event = decodeDirectMessageBlockChangedEvent(payload);
          directMessages.applyBlockChanged(event);
        } catch {
          // Ignore malformed events
        }
      },
    );

    return () => {
      unsubscribeNotificationRefresh();
      unsubscribeGrowth();
      unsubscribeDirectMessage();
      unsubscribeDirectMessageRead();
      unsubscribeDirectMessageBlockChanged();
    };
  }, [locale, t, currentProfile?.id]);

  return null;
}

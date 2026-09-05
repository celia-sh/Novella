import { toast } from '@celia-sh/react-native-pretty-toast';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { decodeUserGrowth } from '@novella/api-client';

import { useAppLocale } from '@/localization/localization-provider';
import { formatCompactNumber } from '@/localization/formatters';
import {
  profile,
  subscribeClientRealtime,
} from '@/services/client';

function signedNumber(value: number, locale: 'zh-CN' | 'zh-TW'): string {
  const formatted = formatCompactNumber(Math.abs(value), locale);
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

export function ClientRealtimeEvents() {
  const { t } = useTranslation('common');
  const locale = useAppLocale();

  useEffect(() => {
    const unsubscribeNotificationRefresh = subscribeClientRealtime(
      'OnNotificationRefresh',
      () => {
        void profile.load().catch(() => undefined);
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

    return () => {
      unsubscribeNotificationRefresh();
      unsubscribeGrowth();
    };
  }, [locale, t]);

  return null;
}

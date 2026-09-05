import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import { useProfile } from '@/hooks/use-profile';
import { useAppTheme } from '@/theme/app-theme';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { t } = useTranslation('navigation');
  const { profile } = useProfile();
  const unreadNotifications = profile?.unreadNotificationCount ?? 0;

  return (
    <NativeTabs
      iconColor={{ default: colors.secondaryLabel, selected: colors.accent }}
      tintColor={colors.accent}
    >
      <NativeTabs.Trigger name="(discover)">
        <NativeTabs.Trigger.Icon sf="safari.fill" />
        <NativeTabs.Trigger.Label>{t('tabs.discover')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(shelf)">
        <NativeTabs.Trigger.Icon sf="book.closed.fill" />
        <NativeTabs.Trigger.Label>{t('tabs.shelf')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(history)">
        <NativeTabs.Trigger.Icon sf="clock.fill" />
        <NativeTabs.Trigger.Label>{t('tabs.history')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(community)">
        <NativeTabs.Trigger.Icon sf="text.bubble.fill" />
        <NativeTabs.Trigger.Label>{t('tabs.community')}</NativeTabs.Trigger.Label>
        {unreadNotifications > 0 ? (
          <NativeTabs.Trigger.Badge>
            {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
          </NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" />
        <NativeTabs.Trigger.Label>{t('tabs.search')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

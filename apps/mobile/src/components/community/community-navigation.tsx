import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export function CommunityHomeNavigation() {
  const { t } = useTranslation('community');
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel={t('accessibility.newPost')}
        icon="square.and.pencil"
        onPress={() => router.push('/compose')}
      />
      <Stack.Toolbar.Button
        accessibilityLabel={t('accessibility.notifications')}
        icon="bell"
        onPress={() => router.push('/notifications')}
      />
      <Stack.Toolbar.Menu accessibilityLabel={t('accessibility.menu')} icon="ellipsis">
        <Stack.Toolbar.MenuAction
          icon="person.crop.circle"
          onPress={() => router.push('/mine')}
        >
          {t('navigation.myCommunity')}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon="trophy"
          onPress={() => router.push('/community-rankings')}
        >
          {t('navigation.rankings')}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

export function CommunityPublishNavigation({
  disabled,
  onPublish,
}: {
  disabled: boolean;
  onPublish(): void;
}) {
  const { t } = useTranslation('community');
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel={t('accessibility.publishDiscussion')}
        disabled={disabled}
        icon="checkmark"
        onPress={onPublish}
      />
    </Stack.Toolbar>
  );
}

export function CommunityNotificationsNavigation({
  hidden,
  onMarkAll,
}: {
  hidden: boolean;
  onMarkAll(): void;
}) {
  const { t } = useTranslation('community');
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button hidden={hidden} onPress={onMarkAll}>
        {t('actions.markAllRead')}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}

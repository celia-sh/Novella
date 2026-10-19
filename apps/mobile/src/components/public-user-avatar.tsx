import { router } from 'expo-router';
import { memo } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfileAvatar, type ProfileAvatarProps } from '@/components/profile-avatar';
import { useScrollGuardedPress } from '@/hooks/use-scroll-press-guard';

export interface PublicUserAvatarProps extends Pick<ProfileAvatarProps, 'avatarUrl' | 'fallbackBackground' | 'fallbackColor' | 'size' | 'userName'> {
  style?: StyleProp<ViewStyle>;
  userId: number;
}

/** Avatar trigger for identities whose stable server id is known. */
export const PublicUserAvatar = memo(function PublicUserAvatar({
  avatarUrl,
  fallbackBackground,
  fallbackColor,
  size = 'md',
  style,
  userId,
  userName,
}: PublicUserAvatarProps) {
  const { t } = useTranslation('user');
  const valid = Number.isSafeInteger(userId) && userId > 0;
  const press = useScrollGuardedPress((event: GestureResponderEvent) => {
    event.stopPropagation();
    router.push({
      pathname: '/user/[id]',
      params: { id: String(userId) },
    });
  });
  const avatar = (
    <ProfileAvatar
      avatarUrl={avatarUrl}
      size={size}
      userName={userName}
      {...(fallbackBackground === undefined ? {} : { fallbackBackground })}
      {...(fallbackColor === undefined ? {} : { fallbackColor })}
    />
  );

  // A deleted or unknown user has no profile to open. The avatar still claims
  // the touch, so it does nothing instead of falling through and pressing the
  // card or row it sits in; scrolling can still take the touch over.
  if (!valid) {
    return (
      <View onStartShouldSetResponder={() => true} style={style}>
        {avatar}
      </View>
    );
  }

  const name = userName.trim() || t('profile.title');

  return (
    <Pressable
      accessibilityLabel={t('accessibility.openProfile', { name })}
      accessibilityRole="button"
      {...press}
      style={({ pressed }) => [style, pressed && { opacity: 0.68 }]}
    >
      {avatar}
    </Pressable>
  );
});

import { router } from 'expo-router';
import { memo } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfileAvatar, type ProfileAvatarProps } from '@/components/profile-avatar';

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
  const avatar = (
    <ProfileAvatar
      avatarUrl={avatarUrl}
      size={size}
      userName={userName}
      {...(fallbackBackground === undefined ? {} : { fallbackBackground })}
      {...(fallbackColor === undefined ? {} : { fallbackColor })}
    />
  );

  if (!valid) return avatar;

  const name = userName.trim() || t('profile.title');
  const openProfile = (event: GestureResponderEvent) => {
    event.stopPropagation();
    router.push({
      pathname: '/user/[id]',
      params: { id: String(userId) },
    });
  };

  return (
    <Pressable
      accessibilityLabel={t('accessibility.openProfile', { name })}
      accessibilityRole="button"
      onPress={openProfile}
      style={({ pressed }) => [style, pressed && { opacity: 0.68 }]}
    >
      {avatar}
    </Pressable>
  );
});

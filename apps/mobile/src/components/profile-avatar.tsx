import { Avatar as HeroAvatar } from 'heroui-native';
import { memo } from 'react';
import type { ColorValue } from 'react-native';

export interface ProfileAvatarProps {
  avatarUrl: string;
  /** Optional fallback background for palette-based screens (e.g. book themes). */
  fallbackBackground?: ColorValue;
  /** Optional fallback text color for palette-based screens. */
  fallbackColor?: ColorValue;
  /** Pixel size, or one of heroui's named sizes (sm=40, md=48, lg=64). */
  size?: number | 'sm' | 'md' | 'lg';
  userName: string;
}

/**
 * User avatar backed by heroui's Avatar primitives: the image is rendered
 * with heroui's load/failure handling, and the fallback (initial letter, or
 * the person icon when the name is empty) is heroui's Avatar.Fallback
 * placeholder shown when the image is missing or fails to load.
 */
export const ProfileAvatar = memo(function ProfileAvatar({
  avatarUrl,
  fallbackBackground,
  fallbackColor,
  size = 'md',
  userName,
}: ProfileAvatarProps) {
  const initial = userName.trim().slice(0, 1).toUpperCase();
  const trimmedUrl = avatarUrl.trim();
  const heroSize = typeof size === 'string' ? size : undefined;
  const numericStyle =
    typeof size === 'number' ? { borderRadius: size / 2, height: size, width: size } : undefined;
  const fallbackStyles =
    fallbackBackground || fallbackColor
      ? {
          ...(fallbackBackground ? { container: { backgroundColor: fallbackBackground } } : {}),
          ...(fallbackColor ? { text: { color: fallbackColor } } : {}),
        }
      : undefined;
  return (
    <HeroAvatar
      animation="disable-all"
      {...(heroSize ? { size: heroSize } : {})}
      style={numericStyle}
    >
      {trimmedUrl ? <HeroAvatar.Image source={{ uri: trimmedUrl }} /> : null}
      <HeroAvatar.Fallback {...(fallbackStyles ? { styles: fallbackStyles } : {})}>
        {initial || undefined}
      </HeroAvatar.Fallback>
    </HeroAvatar>
  );
});

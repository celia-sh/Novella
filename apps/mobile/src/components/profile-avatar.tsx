import { Avatar } from 'panelui-native/components/avatar';
import { memo, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type ImageProps,
} from 'react-native';

const AVATAR_POINTS = { sm: 32, md: 40, lg: 56 } as const;

type AvatarSize = keyof typeof AVATAR_POINTS;

export interface ProfileAvatarProps {
  avatarUrl: string;
  /** Optional fallback background for palette-based screens (e.g. book themes). */
  fallbackBackground?: ColorValue;
  /** Optional fallback text color for palette-based screens. */
  fallbackColor?: ColorValue;
  /** Pixel size, or one of PanelUI's named sizes (sm=32, md=40, lg=56). */
  size?: number | AvatarSize;
  userName: string;
}

/** User avatar with PanelUI image loading and a palette-aware fallback. */
export const ProfileAvatar = memo(function ProfileAvatar({
  avatarUrl,
  fallbackBackground,
  fallbackColor,
  size = 'md',
  userName,
}: ProfileAvatarProps) {
  const initial = userName.trim().slice(0, 1).toUpperCase();
  const trimmedUrl = avatarUrl.trim();
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageSource = trimmedUrl && failedImageUrl !== trimmedUrl
    ? { uri: trimmedUrl }
    : undefined;
  const panelSize: AvatarSize = typeof size === 'string'
    ? size
    : size <= AVATAR_POINTS.sm + 4
      ? 'sm'
      : size <= AVATAR_POINTS.md + 8
        ? 'md'
        : 'lg';
  const dimension = typeof size === 'number' ? size : AVATAR_POINTS[size];
  const fallbackVisible = imageSource === undefined;
  const imageProps: Omit<ImageProps, 'source'> | undefined = imageSource
    ? { onError: () => setFailedImageUrl(trimmedUrl) }
    : undefined;

  useEffect(() => {
    setFailedImageUrl(null);
  }, [trimmedUrl]);

  return (
    <View style={{ height: dimension, width: dimension }}>
      <Avatar
        fallback=" "
        {...(imageProps ? { imageProps } : {})}
        size={panelSize}
        {...(imageSource ? { source: imageSource } : {})}
        style={[
          StyleSheet.absoluteFill,
          fallbackBackground ? { backgroundColor: fallbackBackground } : null,
        ]}
      />
      {fallbackVisible ? (
        <View pointerEvents="none" style={styles.fallbackOverlay}>
          <Text style={[styles.fallbackText, fallbackColor ? { color: fallbackColor } : null]}>
            {initial || '?'}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fallbackOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

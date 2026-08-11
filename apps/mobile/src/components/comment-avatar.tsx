import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';

export const CommentAvatar = memo(function CommentAvatar({
  avatarUrl,
  backgroundColor,
  color,
  size,
  userName,
}: {
  avatarUrl: string;
  backgroundColor: ColorValue;
  color: ColorValue;
  size: number;
  userName: string;
}) {
  const uri = avatarUrl.trim();
  const [failed, setFailed] = useState(false);
  const initial = userName.trim().slice(0, 1).toUpperCase() || '?';

  useEffect(() => setFailed(false), [uri]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.container,
        {
          backgroundColor,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <Text style={{ color, fontSize: Math.max(11, Math.round(size * 0.4)), fontWeight: '600' }}>
        {initial}
      </Text>
      {uri && !failed ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => setFailed(true)}
          recyclingKey={uri}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          transition={0}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

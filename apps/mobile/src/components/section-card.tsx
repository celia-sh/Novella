import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { createThemedStyles } from '@/theme/app-theme';

export function SectionCard({ children }: PropsWithChildren) {
  const styles = useSectionCardStyles();
  return <View style={styles.card}>{children}</View>;
}

const useSectionCardStyles = createThemedStyles((colors) => ({
  card: {
    backgroundColor: colors.card as string,
    borderColor: colors.separator as string,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 0.5,
    gap: 10,
    padding: 18,
    width: '100%',
  },
}));

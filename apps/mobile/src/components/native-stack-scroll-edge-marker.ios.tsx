import { Platform } from 'react-native';
import { ScrollViewMarker } from 'react-native-screens/experimental';

import type { NativeStackScrollEdgeMarkerProps } from '@/components/native-stack-scroll-edge-marker.types';

const topScrollEdgeEffect = Number(Platform.Version) >= 27 ? 'hard' : 'soft';

export function NativeStackScrollEdgeMarker({
  children,
}: NativeStackScrollEdgeMarkerProps) {
  return (
    <ScrollViewMarker
      scrollEdgeEffects={{ top: topScrollEdgeEffect }}
      style={{ flex: 1 }}
    >
      {children}
    </ScrollViewMarker>
  );
}

import { ScrollViewMarker } from 'react-native-screens/experimental';

import type { NativeStackScrollEdgeMarkerProps } from '@/components/native-stack-scroll-edge-marker.types';

export function NativeStackScrollEdgeMarker({
  children,
}: NativeStackScrollEdgeMarkerProps) {
  return (
    <ScrollViewMarker scrollEdgeEffects={{ top: 'soft' }} style={{ flex: 1 }}>
      {children}
    </ScrollViewMarker>
  );
}

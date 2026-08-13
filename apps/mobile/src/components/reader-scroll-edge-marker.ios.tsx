import { ScrollViewMarker } from 'react-native-screens/experimental';

import type { ReaderScrollEdgeMarkerProps } from '@/components/reader-scroll-edge-marker.types';

export function ReaderScrollEdgeMarker({
  children,
  style,
}: ReaderScrollEdgeMarkerProps) {
  return (
    <ScrollViewMarker
      scrollEdgeEffects={{
        bottom: 'soft',
        left: 'hidden',
        right: 'hidden',
        top: 'soft',
      }}
      style={style}
    >
      {children}
    </ScrollViewMarker>
  );
}

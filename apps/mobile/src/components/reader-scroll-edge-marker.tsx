import { View } from 'react-native';

import type { ReaderScrollEdgeMarkerProps } from '@/components/reader-scroll-edge-marker.types';

export function ReaderScrollEdgeMarker({
  children,
  style,
}: ReaderScrollEdgeMarkerProps) {
  return <View style={style}>{children}</View>;
}

import { View } from 'react-native';

import type { IosScrollViewMarkerProps } from './ios-scroll-view-marker.types';

export function IosScrollViewMarker({ children, style }: IosScrollViewMarkerProps) {
  return <View style={style}>{children}</View>;
}

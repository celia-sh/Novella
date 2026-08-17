import { ScrollViewMarker } from 'react-native-screens/experimental';

import type { IosScrollViewMarkerProps } from './ios-scroll-view-marker.types';

export function IosScrollViewMarker({ children, style }: IosScrollViewMarkerProps) {
  return (
    <ScrollViewMarker scrollEdgeEffects={{ top: 'hidden' }} style={style}>
      {children}
    </ScrollViewMarker>
  );
}

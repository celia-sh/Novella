import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface IosScrollViewMarkerProps {
  children: NonNullable<ReactNode>;
  style?: StyleProp<ViewStyle>;
}

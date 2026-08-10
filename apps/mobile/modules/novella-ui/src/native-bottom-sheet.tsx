import type { ReactNode } from 'react';

export interface NativeBottomSheetProps {
  children: ReactNode;
  containerColor: string;
  fitToContents?: boolean;
  onDismiss: () => void;
  supportsPartialExpansion?: boolean;
}

export function NativeBottomSheet(_props: NativeBottomSheetProps) {
  return null;
}

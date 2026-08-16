import { Stack } from 'expo-router';
import { useState } from 'react';

import { NativeScrollEdgeMarker } from '../../modules/novella-ui/src/native-scroll-edge-marker';
import { IosTopBarBackground } from '@/components/ios-top-bar-background';
import type { NativeScreenScaffoldProps } from '@/components/native-screen-scaffold.types';

export function NativeScreenScaffold({ children }: NativeScreenScaffoldProps) {
  const [topBarBackgroundVisible, setTopBarBackgroundVisible] = useState(false);

  return (
    <>
      <Stack.Screen options={{ headerBackground: () => null }} />
      {children}
      <IosTopBarBackground visible={topBarBackgroundVisible} />
      <NativeScrollEdgeMarker
        observesTopBarOverlap
        onTopBarBackgroundVisibilityChange={setTopBarBackgroundVisible}
      />
    </>
  );
}

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { NativeScrollEdgeMarker } from '../../modules/novella-ui/src/native-scroll-edge-marker';
import { IosTopBarBackground } from '@/components/ios-top-bar-background';
import type { NativeScreenScaffoldProps } from '@/components/native-screen-scaffold.types';

export function NativeScreenScaffold({
  children,
  largeTitle = true,
}: NativeScreenScaffoldProps) {
  const [topBarBackgroundVisible, setTopBarBackgroundVisible] = useState(!largeTitle);

  useEffect(() => {
    setTopBarBackgroundVisible(!largeTitle);
  }, [largeTitle]);

  return (
    <>
      <Stack.Screen options={{ headerBackground: () => null }} />
      {children}
      <IosTopBarBackground visible={topBarBackgroundVisible} />
      <NativeScrollEdgeMarker
        observesTopBarOverlap={largeTitle}
        onTopBarBackgroundVisibilityChange={setTopBarBackgroundVisible}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shouldUseReaderSideChrome } from '@/services/reader-display-layout';
import { getReaderVerticalBarEdge } from '@/services/reader-side-chrome';

/**
 * Whether the reader should put its title and progress into the system's
 * vertical edge bar. The native trait is the authority: a wide window alone
 * does not mean iOS placed a vertical bar, and a fold can change the answer
 * without changing the window's size class.
 *
 * Reading the trait is asynchronous, so the first frame keeps the horizontal
 * chrome and the edge layout takes over once the window reports its bar. A
 * dev client predating the native method falls back to the Duo geometry.
 */
export function useReaderSideChrome(): boolean {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const [sideChrome, setSideChrome] = useState(false);

  useEffect(() => {
    let active = true;
    // The trait can trail a rotation or a fold by one commit. Let the window
    // finish its layout pass before asking, and ask again whenever the window
    // or its safe area changes.
    const frame = requestAnimationFrame(() => {
      void getReaderVerticalBarEdge()
        .then((edge) => {
          if (!active) return;
          if (edge === null) {
            setSideChrome(shouldUseReaderSideChrome(width, height, isPad));
            return;
          }
          setSideChrome(edge !== 'unspecified');
        })
        .catch(() => {
          if (active) setSideChrome(false);
        });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [height, isPad, width, insets.bottom, insets.left, insets.right, insets.top]);

  return sideChrome;
}

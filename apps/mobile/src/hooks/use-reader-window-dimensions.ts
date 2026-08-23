import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';

interface ReaderWindowDimensions {
  height: number;
  revision: number;
  width: number;
}

/**
 * Reads window geometry from the native Dimensions change event. The revision
 * is a start signal for reader reflow; safe-area insets are sampled separately
 * after the SafeAreaProvider frame changes.
 */
export function useReaderWindowDimensions(): ReaderWindowDimensions {
  const initialWindow = Dimensions.get('window');
  const [state, setState] = useState<ReaderWindowDimensions>(() => ({
    height: initialWindow.height,
    revision: 0,
    width: initialWindow.width,
  }));

  useEffect(() => {
    const applyWindow = (window: { height: number; width: number }) => {
      setState((current) => {
        if (current.width === window.width && current.height === window.height) {
          return current;
        }
        return {
          height: window.height,
          revision: current.revision + 1,
          width: window.width,
        };
      });
    };

    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      applyWindow(window);
    });
    applyWindow(Dimensions.get('window'));
    return () => subscription.remove();
  }, []);

  return state;
}

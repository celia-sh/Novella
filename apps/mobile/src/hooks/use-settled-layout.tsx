import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useWindowDimensions } from 'react-native';
import {
  useSafeAreaInsets,
  type EdgeInsets,
} from 'react-native-safe-area-context';

/** Absorbs the intermediate window sizes iOS reports during a rotation, a Duo
 * fold, or an interactive iPadOS window resize, and gives the safe-area insets
 * time to land in the same commit. Kept short: the values arrive within a
 * couple of frames of each other, and a long hold reads as a late jump. */
export const LAYOUT_SETTLE_MS = 140;

export interface SettledLayout {
  height: number;
  insets: EdgeInsets;
  width: number;
}

const SettledLayoutContext = createContext<SettledLayout | null>(null);

/**
 * Publishes the window metrics a layout decision should use.
 *
 * A single device change reaches JS as several updates: rotation and fold
 * animate through intermediate window sizes, the safe-area insets are
 * published after the dimensions, and an interactive window resize reports
 * every intermediate width. Feeding each update into breakpoints makes one
 * change flip a grid through two or three column counts and remount the list
 * each time. Hold the previous metrics until the values have been quiet for a
 * moment, then commit the final size once, for the whole app at the same time.
 */
export function SettledLayoutProvider({ children }: { children: ReactNode }) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [settled, setSettled] = useState<SettledLayout>(() => ({
    height,
    insets,
    width,
  }));
  const settledRef = useRef(settled);

  useEffect(() => {
    const current = settledRef.current;
    if (
      current.height === height &&
      current.width === width &&
      sameInsets(current.insets, insets)
    ) {
      return;
    }
    const timer = setTimeout(() => {
      const next = { height, insets, width };
      settledRef.current = next;
      setSettled(next);
    }, LAYOUT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [height, insets, width]);

  return (
    <SettledLayoutContext.Provider value={settled}>
      {children}
    </SettledLayoutContext.Provider>
  );
}

/**
 * The settled window metrics. Falls back to the live window outside the
 * provider so isolated renders still work.
 */
export function useSettledLayout(): SettledLayout {
  const settled = useContext(SettledLayoutContext);
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return settled ?? { height, insets, width };
}

function sameInsets(a: EdgeInsets, b: EdgeInsets): boolean {
  return (
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.left === b.left &&
    a.right === b.right
  );
}

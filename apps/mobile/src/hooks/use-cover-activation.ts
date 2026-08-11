import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ViewabilityConfig,
  ViewToken,
} from 'react-native';

import {
  nearbyGridItemIndices,
  scrollGridItemIndices,
} from '@/services/cover-activation';

const COVER_VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 1,
  waitForInteraction: false,
};
const EMPTY_KEYS: ReadonlySet<string> = new Set();

interface ActivationState {
  keys: ReadonlySet<string>;
  scopeKey: string;
}

export function useFlatListCoverActivation<T>({
  columns,
  items,
  keyForItem,
  nearRows = 1,
  scopeKey,
}: {
  columns: number;
  items: readonly T[];
  keyForItem(item: T): string | null;
  nearRows?: number;
  scopeKey: string;
}) {
  const itemsRef = useRef(items);
  const columnsRef = useRef(columns);
  const keyForItemRef = useRef(keyForItem);
  const nearRowsRef = useRef(nearRows);
  const scopeKeyRef = useRef(scopeKey);
  const visibleIndicesRef = useRef<number[]>([]);
  const [activation, setActivation] = useState<ActivationState>({
    keys: EMPTY_KEYS,
    scopeKey,
  });

  itemsRef.current = items;
  columnsRef.current = columns;
  keyForItemRef.current = keyForItem;
  nearRowsRef.current = nearRows;
  scopeKeyRef.current = scopeKey;

  const activateCurrentWindow = useCallback(() => {
    const currentItems = itemsRef.current;
    const indices = nearbyGridItemIndices(
      currentItems.length,
      visibleIndicesRef.current,
      columnsRef.current,
      nearRowsRef.current,
    );
    activateKeys(
      indices.map((index) => keyForItemRef.current(currentItems[index] as T)),
      scopeKeyRef.current,
      setActivation,
    );
  }, []);

  const onViewableItemsChanged = useCallback(({
    viewableItems,
  }: {
    changed: ViewToken<T>[];
    viewableItems: ViewToken<T>[];
  }) => {
    visibleIndicesRef.current = viewableItems.flatMap((token) =>
      token.index === null ? [] : [token.index]
    );
    activateCurrentWindow();
  }, [activateCurrentWindow]);

  useEffect(() => {
    activateCurrentWindow();
  }, [columns, items, scopeKey, activateCurrentWindow]);

  return {
    activatedKeys: activation.scopeKey === scopeKey ? activation.keys : EMPTY_KEYS,
    onViewableItemsChanged,
    viewabilityConfig: COVER_VIEWABILITY_CONFIG,
  };
}

interface ScrollViewportMetrics {
  height: number;
  top: number;
}

type ScrollViewportListener = (metrics: ScrollViewportMetrics) => void;

export interface CoverScrollViewportController {
  getMetrics(): ScrollViewportMetrics;
  onLayout(event: LayoutChangeEvent): void;
  onScroll(event: NativeSyntheticEvent<NativeScrollEvent>): void;
  subscribe(listener: ScrollViewportListener): () => void;
}

export function useCoverScrollViewport(): CoverScrollViewportController {
  const metricsRef = useRef<ScrollViewportMetrics>({ height: 0, top: 0 });
  const listenersRef = useRef(new Set<ScrollViewportListener>());

  return useMemo(() => {
    const publish = () => {
      for (const listener of listenersRef.current) listener(metricsRef.current);
    };
    return {
      getMetrics: () => metricsRef.current,
      onLayout: (event: LayoutChangeEvent) => {
        metricsRef.current = {
          ...metricsRef.current,
          height: event.nativeEvent.layout.height,
        };
        publish();
      },
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        metricsRef.current = {
          ...metricsRef.current,
          top: event.nativeEvent.contentOffset.y,
        };
        publish();
      },
      subscribe: (listener: ScrollViewportListener) => {
        listenersRef.current.add(listener);
        listener(metricsRef.current);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    };
  }, []);
}

export function useScrollGridCoverActivation({
  columns,
  itemKeys,
  nearRows = 1,
  scopeKey,
  viewport,
}: {
  columns: number;
  itemKeys: readonly string[];
  nearRows?: number;
  scopeKey: string;
  viewport: CoverScrollViewportController;
}) {
  const columnsRef = useRef(columns);
  const itemKeysRef = useRef(itemKeys);
  const layoutRef = useRef({ height: 0, top: 0 });
  const nearRowsRef = useRef(nearRows);
  const scopeKeyRef = useRef(scopeKey);
  const [activation, setActivation] = useState<ActivationState>({
    keys: EMPTY_KEYS,
    scopeKey,
  });

  columnsRef.current = columns;
  itemKeysRef.current = itemKeys;
  nearRowsRef.current = nearRows;
  scopeKeyRef.current = scopeKey;

  const activateCurrentWindow = useCallback((metrics = viewport.getMetrics()) => {
    const keys = itemKeysRef.current;
    const indices = scrollGridItemIndices({
      columns: columnsRef.current,
      gridHeight: layoutRef.current.height,
      gridTop: layoutRef.current.top,
      itemCount: keys.length,
      nearRows: nearRowsRef.current,
      viewportHeight: metrics.height,
      viewportTop: metrics.top,
    });
    activateKeys(
      indices.map((index) => keys[index] ?? null),
      scopeKeyRef.current,
      setActivation,
    );
  }, [viewport]);

  const onGridLayout = useCallback((event: LayoutChangeEvent) => {
    layoutRef.current = {
      height: event.nativeEvent.layout.height,
      top: event.nativeEvent.layout.y,
    };
    activateCurrentWindow();
  }, [activateCurrentWindow]);

  useEffect(() => viewport.subscribe(activateCurrentWindow), [activateCurrentWindow, viewport]);
  useEffect(() => {
    activateCurrentWindow();
  }, [columns, itemKeys, scopeKey, activateCurrentWindow]);

  return {
    activatedKeys: activation.scopeKey === scopeKey ? activation.keys : EMPTY_KEYS,
    onGridLayout,
  };
}

function activateKeys(
  candidates: readonly (string | null)[],
  scopeKey: string,
  setActivation: Dispatch<SetStateAction<ActivationState>>,
): void {
  setActivation((current) => {
    const currentKeys = current.scopeKey === scopeKey ? current.keys : EMPTY_KEYS;
    let nextKeys: Set<string> | null = null;
    for (const key of candidates) {
      if (key === null || currentKeys.has(key)) continue;
      nextKeys ??= new Set(currentKeys);
      nextKeys.add(key);
    }
    if (nextKeys === null && current.scopeKey === scopeKey) return current;
    return { keys: nextKeys ?? new Set(currentKeys), scopeKey };
  });
}

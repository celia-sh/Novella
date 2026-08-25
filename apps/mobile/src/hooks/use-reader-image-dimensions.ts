import { useEffect, useMemo, useState } from 'react';

import {
  extractReaderImageSourcesFromHtmlBlocks,
  getKnownReaderImageDimensionsFromHtmlBlocks,
  hydrateReaderImageDimensions,
  type ReaderImageDimensions,
} from '@/services/reader-image-dimensions';

/**
 * Hydrates geometry metadata only. Image pixels are loaded by visible
 * `expo-image` instances and never gate paged chapter display.
 */
export function useReaderImageDimensions(htmlBlocks: readonly string[]) {
  const sources = useMemo(
    () => extractReaderImageSourcesFromHtmlBlocks(htmlBlocks),
    [htmlBlocks],
  );
  const immediateDimensions = useMemo(
    () => getKnownReaderImageDimensionsFromHtmlBlocks(htmlBlocks),
    [htmlBlocks],
  );
  const [state, setState] = useState<{
    dimensions: Record<string, ReaderImageDimensions>;
    htmlBlocks: readonly string[];
    ready: boolean;
  }>({ dimensions: {}, htmlBlocks: [], ready: false });

  useEffect(() => {
    let cancelled = false;
    if (sources.length === 0) {
      setState({ dimensions: {}, htmlBlocks, ready: true });
      return () => {
        cancelled = true;
      };
    }

    setState({ dimensions: immediateDimensions, htmlBlocks, ready: false });
    void hydrateReaderImageDimensions().then(() => {
      if (cancelled) return;
      setState({
        dimensions: getKnownReaderImageDimensionsFromHtmlBlocks(htmlBlocks),
        htmlBlocks,
        ready: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [htmlBlocks, immediateDimensions, sources.length]);

  return {
    dimensions: state.htmlBlocks === htmlBlocks ? state.dimensions : immediateDimensions,
    hasImages: sources.length > 0,
    isReady: state.htmlBlocks === htmlBlocks && state.ready,
    total: sources.length,
  };
}

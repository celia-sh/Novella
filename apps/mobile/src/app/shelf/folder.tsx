import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { ShelfScreen } from '@/screens/shelf-screen';
import { parseShelfMediaParam, type ShelfMediaRouteParam } from '@/services/shelf-media';

export default function ShelfFolderRoute() {
  const params = useLocalSearchParams<{
    media?: ShelfMediaRouteParam | ShelfMediaRouteParam[];
    path?: string | string[];
  }>();
  const parents = useMemo(() => decodeFolderPath(params.path), [params.path]);

  return <ShelfScreen media={parseShelfMediaParam(params.media)} parents={parents} />;
}

function decodeFolderPath(value: string | string[] | undefined): string[] {
  const serialized = Array.isArray(value) ? value[0] : value;
  if (!serialized) return [];
  try {
    const decoded: unknown = JSON.parse(serialized);
    return Array.isArray(decoded)
      ? decoded.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

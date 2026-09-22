import { useLocalSearchParams } from 'expo-router';

import { ShelfScreen } from '@/screens/shelf-screen';
import { parseShelfMediaParam, type ShelfMediaRouteParam } from '@/services/shelf-media';

export default function ShelfRoute() {
  const { media } = useLocalSearchParams<{ media?: ShelfMediaRouteParam | ShelfMediaRouteParam[] }>();
  return <ShelfScreen media={parseShelfMediaParam(media)} />;
}

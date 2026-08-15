import { useLocalSearchParams } from 'expo-router';

import { AnnouncementDetailScreen } from '@/screens/announcement-detail-screen';

export default function AnnouncementDetailRoute() {
  const { id, source } = useLocalSearchParams<{
    id: string;
    source: string;
  }>();
  return <AnnouncementDetailScreen id={id} source={source} />;
}

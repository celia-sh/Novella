import { useLocalSearchParams } from 'expo-router';

import { AnnouncementDetailScreen } from '@/screens/announcement-detail-screen';

export default function AnnouncementDetailRoute() {
  const { id, initialTitle, source } = useLocalSearchParams<{
    id: string;
    initialTitle?: string;
    source: string;
  }>();
  return (
    <AnnouncementDetailScreen
      id={id}
      {...(initialTitle ? { initialTitle } : {})}
      source={source}
    />
  );
}

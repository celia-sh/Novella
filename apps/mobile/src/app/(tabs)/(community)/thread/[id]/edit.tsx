import { Redirect, useLocalSearchParams } from 'expo-router';

import { CommunityComposeScreen } from '@/screens/community-compose-screen';

export default function CommunityThreadEditRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(id) ? id[0] ?? '' : id ?? '';
  const threadId = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  const validThreadId = Number.isSafeInteger(threadId) && threadId > 0 ? threadId : null;
  return validThreadId === null
    ? <Redirect href="/community" />
    : <CommunityComposeScreen threadId={validThreadId} />;
}

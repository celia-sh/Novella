import { useLocalSearchParams } from 'expo-router';

import { CommunityThreadScreen } from '@/screens/community-thread-screen';

export default function CommunityThreadRoute() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    parentReplyId?: string | string[];
    replyId?: string | string[];
  }>();
  const threadId = parsePositiveInteger(params.id);
  const parentReplyId = parsePositiveInteger(params.parentReplyId);
  const replyId = parsePositiveInteger(params.replyId);

  return (
    <CommunityThreadScreen
      parentReplyId={parentReplyId || null}
      replyId={replyId || null}
      threadId={threadId}
    />
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(firstParam(value) ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

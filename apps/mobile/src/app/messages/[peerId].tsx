import { Redirect, useLocalSearchParams } from 'expo-router';

import { useProfile } from '@/hooks/use-profile';
import { DirectMessageChatScreen } from '@/screens/direct-message-chat-screen';

export default function DirectMessageChatRoute() {
  const { peerId: rawPeerId } = useLocalSearchParams<{ peerId?: string }>();
  const peerId = Number(rawPeerId);
  const { profile } = useProfile();
  // There is no conversation with yourself; any link that tries to open one
  // lands on the conversation list instead of an empty, unsendable chat.
  if (!Number.isSafeInteger(peerId) || peerId <= 0 || peerId === profile?.id) {
    return <Redirect href="/messages" />;
  }
  return <DirectMessageChatScreen key={peerId} peerId={peerId} />;
}

import { Redirect, useLocalSearchParams } from 'expo-router';

import { DirectMessageChatScreen } from '@/screens/direct-message-chat-screen';

export default function DirectMessageChatRoute() {
  const { peerId: rawPeerId } = useLocalSearchParams<{ peerId?: string }>();
  const peerId = Number(rawPeerId);
  if (!Number.isSafeInteger(peerId) || peerId <= 0) {
    return <Redirect href="/messages" />;
  }
  return <DirectMessageChatScreen key={peerId} peerId={peerId} />;
}

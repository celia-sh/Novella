import { useLocalSearchParams } from 'expo-router';

import { DirectMessageConversationsScreen } from '@/screens/direct-message-conversations-screen';

export default function DirectMessagesRoute() {
  // `peer` and `open` come from a chat that was unfolded into the split view:
  // it returns here and asks for its conversation to be selected. `open`
  // changes on every request, so asking for the same peer twice still counts.
  const { open, peer } = useLocalSearchParams<{ open?: string; peer?: string }>();
  const peerId = Number(peer);
  return (
    <DirectMessageConversationsScreen
      {...(Number.isSafeInteger(peerId) && peerId > 0
        ? { requestedPeer: { peerId, request: open ?? '' } }
        : {})}
    />
  );
}

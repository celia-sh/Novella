import { Redirect, router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useProfile } from '@/hooks/use-profile';
import { useWideLayout } from '@/hooks/use-wide-layout';
import { DirectMessageChatScreen } from '@/screens/direct-message-chat-screen';
import { DirectMessageConversationsScreen } from '@/screens/direct-message-conversations-screen';

export default function DirectMessageChatRoute() {
  const { peerId: rawPeerId } = useLocalSearchParams<{ peerId?: string }>();
  const peerId = Number(rawPeerId);
  const { profile } = useProfile();
  const { isWide } = useWideLayout();
  const isFocused = useIsFocused();
  // There is no conversation with yourself; any link that tries to open one
  // lands on the conversation list instead of an empty, unsendable chat.
  const valid = Number.isSafeInteger(peerId) && peerId > 0 && peerId !== profile?.id;

  // A wide layout shows conversations in the list's split view, and there must
  // be only one: a chat that turns wide (unfolding) goes back to the list
  // below it and selects itself there, or becomes that list when there is
  // none. Otherwise going back revealed a second, identical split.
  useEffect(() => {
    if (!valid || !isWide || !isFocused) return;
    router.dismissTo({
      pathname: '/messages',
      params: { open: String(Date.now()), peer: String(peerId) },
    });
  }, [isFocused, isWide, peerId, valid]);

  if (!valid) return <Redirect href="/messages" />;
  // Shown for the moment until the list takes over, so nothing blanks out.
  if (isWide) return <DirectMessageConversationsScreen key={peerId} requestedPeer={{ peerId, request: '' }} />;
  return <DirectMessageChatScreen key={peerId} peerId={peerId} />;
}

import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { WhatsNewScreen } from '@/screens/whats-new-screen';

export default function WhatsNewRoute() {
  // The launch announcement cannot be swiped away. Opening it from Settings
  // is a voluntary read, so that presentation keeps the normal sheet gesture.
  const { source } = useLocalSearchParams<{ source?: string }>();
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: source === 'about' }} />
      <WhatsNewScreen />
    </>
  );
}

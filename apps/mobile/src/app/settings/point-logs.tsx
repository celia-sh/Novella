import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import { PointLogsSheetScreen } from '@/screens/point-logs-sheet-screen';
import type { PointLogKind } from '@novella/client-core';
import { useLocalSearchParams } from 'expo-router';

export default function PointLogsRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const logKind: PointLogKind = kind === 'coin' ? 'coin' : 'experience';
  return (
    <NativeRouteBottomSheet snapPoints={['50%', '100%']}>
      <PointLogsSheetScreen kind={logKind} />
    </NativeRouteBottomSheet>
  );
}

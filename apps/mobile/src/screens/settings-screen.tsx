import { NativeSettingsPanel } from '@/components/native-settings-panel';
import { useSettingsCheckIn } from '@/hooks/use-settings-check-in';

export function SettingsScreen() {
  useSettingsCheckIn();
  return <NativeSettingsPanel />;
}

export interface ReaderBackgroundColorSettingsProps {
  backgroundColor: string;
  description: string;
  onValueChange: (value: string) => void;
  sectionTitle: string;
  title: string;
}

/** Android/web no-op; the novel background picker is intentionally iOS-only. */
export function ReaderBackgroundColorSettings(
  _props: ReaderBackgroundColorSettingsProps,
) {
  return null;
}

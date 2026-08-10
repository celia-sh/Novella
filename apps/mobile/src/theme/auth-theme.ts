import { useAppTheme } from '@/theme/app-theme';
import {
  createAuthPalette,
  type AuthPalette,
} from '@/theme/auth-palette';

export type { AuthPalette } from '@/theme/auth-palette';

export function useAuthPalette(): AuthPalette {
  const { colorScheme, colors } = useAppTheme();
  return createAuthPalette(colors, colorScheme);
}

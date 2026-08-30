import type { ColorValue } from 'react-native';

/**
 * Converts a React Native color into the literal string required by libraries
 * that run their own CSS-style color parser (for example React Native Paper).
 * PlatformColor and DynamicColorIOS objects must use a context-appropriate
 * literal fallback instead of being hidden behind an unsafe `as string` cast.
 */
export function resolveStringColor(value: ColorValue, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

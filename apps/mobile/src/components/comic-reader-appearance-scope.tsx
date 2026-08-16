import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { NativeLightAppearanceScope } from '../../modules/novella-ui';
import { BookDetailThemeProvider } from '@/components/book-detail-theme-provider';
import { AppThemeProvider } from '@/theme/app-theme';

/** Keeps iOS comic reader UI in light semantics without changing app appearance. */
export function ComicReaderAppearanceScope({ children }: PropsWithChildren) {
  if (process.env.EXPO_OS !== 'ios') return <>{children}</>;

  return (
    <>
      <StatusBar style="dark" />
      <AppThemeProvider colorSchemeOverride="light" syncGlobalStyleTokens={false}>
        <BookDetailThemeProvider>
          <NativeLightAppearanceScope style={styles.root}>
            {children}
          </NativeLightAppearanceScope>
        </BookDetailThemeProvider>
      </AppThemeProvider>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

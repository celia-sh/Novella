import '../global.css';

import { HeroUINativeProvider } from 'heroui-native';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookDetailThemeProvider } from '@/components/book-detail-theme-provider';
import { AppLocalizationProvider } from '@/localization/localization-provider';
import { NativeAlertHost } from '@/components/native-alert-dialog';
import { useAuthentication } from '@/hooks/use-authentication';
import { hasStoredSession, startClient } from '@/services/client';
import { loadAppSettings } from '@/services/settings';
import { AppThemeProvider, useAppTheme } from '@/theme/app-theme';
import { useSystemScreenStackPreset } from '@/theme/stack-preset';

// The session probe is a local SecureStore read (no network). It is kicked off
// at module scope so the route decision (app vs sign-in welcome) is typically
// ready before the first frame paints. The splash shows the logo normally and
// auto-hides; it is never used to cover up a routing transition.

const sessionProbe = Promise.all([hasStoredSession(), loadAppSettings()]);

export default function RootLayout() {
  return (
    <AppLocalizationProvider>
      <AppThemeProvider>
        <RootLayoutContent />
      </AppThemeProvider>
    </AppLocalizationProvider>
  );
}

function RootLayoutContent() {
  const authentication = useAuthentication();
  const { t } = useTranslation('navigation');
  const { colorScheme, colors } = useAppTheme();
  const systemScreenStackPreset = useSystemScreenStackPreset();
  const usesComposeBottomSheets = process.env.EXPO_OS === 'android';
  // False until the local session probe resolves. The probe decides the very
  // first rendered screen, so a logged-in user never passes through the
  // welcome page and a first-install user goes straight to the welcome page.
  const [sessionDecided, setSessionDecided] = useState(false);
  const [hadAuthenticatedSession, setHadAuthenticatedSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    void sessionProbe.then(([stored]) => {
      if (!mounted) return;
      setHadAuthenticatedSession(stored);
      setSessionDecided(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Session init (token refresh + signalR) is a background concern shared by
  // both entry surfaces: the welcome page (first install) and the home page
  // (logged-in, which shows its existing skeletons meanwhile). A failed
  // refresh clears credentials and flips the guard back to the welcome page;
  // manual sign-out does the same.
  useEffect(() => {
    void startClient().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (authentication.status === 'authenticated') setHadAuthenticatedSession(true);
    else if (authentication.status === 'signedOut') setHadAuthenticatedSession(false);
  }, [authentication.status]);

  const hasAuthenticatedSession = authentication.status === 'authenticated'
    ? true
    : authentication.status === 'signedOut'
      ? false
      : hadAuthenticatedSession;
  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  if (!sessionDecided) {
    // A plain themed frame for the sub-frame probe window (local read only,
    // no spinner, no wrong-screen flash); it visually continues the splash.
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={[styles.blankRoot, { backgroundColor: colors.background }]} />
      </GestureHandlerRootView>
    );
  }
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <HeroUINativeProvider config={heroUIConfig}>
        <ThemeProvider value={navigationTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <BookDetailThemeProvider>
        <Stack screenOptions={systemScreenStackPreset}>
          <Stack.Protected guard={hasAuthenticatedSession}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="book/[id]" options={{ title: '' }} />
          <Stack.Screen
            name="quick-search"
            options={{
              headerLargeTitle: !usesComposeBottomSheets,
              headerShown: !usesComposeBottomSheets,
              title: t('routes.search'),
            }}
          />
          <Stack.Screen name="book/[id]/comments" options={{ headerShown: !usesComposeBottomSheets, title: t('routes.comments') }} />
          <Stack.Screen name="books" options={{ headerShown: !usesComposeBottomSheets, title: t('routes.allNovels') }} />
          <Stack.Screen name="comics" options={{ headerShown: !usesComposeBottomSheets, title: t('routes.allComics') }} />
          <Stack.Screen name="ranking" options={{ headerShown: !usesComposeBottomSheets, title: t('routes.rankings') }} />
          <Stack.Screen
            name="shelf/folder"
            options={{ headerShown: !usesComposeBottomSheets, title: t('routes.folder') }}
          />
          <Stack.Screen
            name="shelf/manage"
            options={{
              ...(usesComposeBottomSheets
                ? {
                    animation: 'none',
                    contentStyle: { backgroundColor: 'transparent' },
                  }
                : {
                    sheetAllowedDetents: 'fitToContents',
                    sheetGrabberVisible: true,
                  }),
              headerShown: false,
              presentation: usesComposeBottomSheets ? 'transparentModal' : 'formSheet',
              title: '',
            }}
          />
          <Stack.Screen
            name="book/[id]/comment-compose"
            options={{
              ...(usesComposeBottomSheets
                ? {
                    animation: 'none',
                    contentStyle: { backgroundColor: 'transparent' },
                  }
                : {
                    sheetAllowedDetents: 'fitToContents',
                    sheetGrabberVisible: false,
                  }),
              headerShown: false,
              presentation: usesComposeBottomSheets ? 'transparentModal' : 'formSheet',
              title: '',
            }}
          />
          <Stack.Screen
            name="book/[id]/introduction"
            options={{
              ...(usesComposeBottomSheets
                ? {
                    animation: 'none',
                    contentStyle: { backgroundColor: 'transparent' },
                  }
                : {
                    sheetAllowedDetents: [0.75, 1],
                    sheetGrabberVisible: true,
                    sheetInitialDetentIndex: 0,
                  }),
              headerShown: false,
              presentation: usesComposeBottomSheets ? 'transparentModal' : 'formSheet',
              title: '',
            }}
          />
          <Stack.Screen
            name="book/[id]/tags"
            options={{
              ...(usesComposeBottomSheets
                ? {
                    animation: 'none',
                    contentStyle: { backgroundColor: 'transparent' },
                  }
                : {
                    sheetAllowedDetents: 'fitToContents',
                    sheetGrabberVisible: true,
                  }),
              headerShown: false,
              presentation: usesComposeBottomSheets ? 'transparentModal' : 'formSheet',
              title: '',
            }}
          />
          <Stack.Screen
            name="book/[id]/uploader"
            options={{
              ...(usesComposeBottomSheets
                ? {
                    animation: 'none',
                    contentStyle: { backgroundColor: 'transparent' },
                  }
                : {
                    sheetAllowedDetents: 'fitToContents',
                    sheetGrabberVisible: true,
                  }),
              headerShown: false,
              presentation: usesComposeBottomSheets ? 'transparentModal' : 'formSheet',
              title: '',
            }}
          />
          <Stack.Screen
            name="book/[id]/versions"
            options={{
              ...(usesComposeBottomSheets
                ? {
                    animation: 'none',
                    contentStyle: { backgroundColor: 'transparent' },
                  }
                : {
                    sheetAllowedDetents: [0.6, 1],
                    sheetGrabberVisible: true,
                    sheetInitialDetentIndex: 0,
                  }),
              headerShown: false,
              presentation: usesComposeBottomSheets ? 'transparentModal' : 'formSheet',
              title: '',
            }}
          />
          <Stack.Screen
            name="reader/[bookId]/[sortNum]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="reader/[bookId]/chapters"
            options={{
              ...(usesComposeBottomSheets
                ? {
                    animation: 'none',
                    contentStyle: { backgroundColor: 'transparent' },
                  }
                : {
                    sheetAllowedDetents: [0.5, 1],
                    sheetGrabberVisible: true,
                    sheetInitialDetentIndex: 0,
                  }),
              headerShown: false,
              presentation: usesComposeBottomSheets ? 'transparentModal' : 'formSheet',
              title: t('routes.chapters'),
            }}
          />
          <Stack.Screen
            name="reader/[bookId]/settings"
            options={{
              ...(usesComposeBottomSheets
                ? {
                    animation: 'none',
                    contentStyle: { backgroundColor: 'transparent' },
                  }
                : {
                    sheetAllowedDetents: [0.5, 1],
                    sheetGrabberVisible: true,
                    sheetInitialDetentIndex: 0,
                  }),
              headerShown: false,
              presentation: usesComposeBottomSheets ? 'transparentModal' : 'formSheet',
              title: t('routes.reading'),
            }}
          />
          <Stack.Screen
            name="reader/[bookId]/footnote"
            options={{
              ...(usesComposeBottomSheets
                ? {
                    animation: 'none',
                    contentStyle: { backgroundColor: 'transparent' },
                  }
                : {
                    sheetAllowedDetents: [0.5, 1],
                    sheetGrabberVisible: true,
                    sheetInitialDetentIndex: 0,
                  }),
              headerShown: false,
              presentation: usesComposeBottomSheets ? 'transparentModal' : 'formSheet',
              title: t('routes.footnote'),
            }}
          />
          </Stack.Protected>
          <Stack.Protected guard={!hasAuthenticatedSession}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in/credentials" options={{ title: t('routes.signIn') }} />
            <Stack.Screen name="register" options={{ title: t('routes.createAccount') }} />
            <Stack.Screen name="register/verify" options={{ title: t('routes.verifyEmail') }} />
            <Stack.Screen name="reset-password" options={{ title: t('routes.resetPassword') }} />
            <Stack.Screen name="reset-password/verify" options={{ title: t('routes.verifyEmail') }} />
            <Stack.Screen name="reset-password/new-password" options={{ title: t('routes.newPassword') }} />
          </Stack.Protected>
        </Stack>
      <NativeAlertHost />
      </BookDetailThemeProvider>
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}

const heroUIConfig = {
  devInfo: { stylingPrinciples: false },
  toast: 'disabled' as const,
};

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  blankRoot: { flex: 1 },
});

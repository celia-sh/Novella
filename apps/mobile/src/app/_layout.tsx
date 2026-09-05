import '../global.css';

import { ToastProvider } from '@celia-sh/react-native-pretty-toast';
import { HeroUINativeProvider } from 'heroui-native';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import { BookDetailThemeProvider } from '@/components/book-detail-theme-provider';
import { ClientRealtimeEvents } from '@/components/client-realtime-events';
import { ClientSessionFeedback } from '@/components/client-session-feedback';
import { AppLocalizationProvider } from '@/localization/localization-provider';
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
        <GestureHandlerRootView style={styles.gestureRoot}>
          <ToastProvider maxQueue={3}>
            <RootLayoutContent />
          </ToastProvider>
        </GestureHandlerRootView>
      </AppThemeProvider>
    </AppLocalizationProvider>
  );
}

function RootLayoutContent() {
  const authentication = useAuthentication();
  const { t } = useTranslation('navigation');
  const { t: tAuth } = useTranslation('auth');
  const { colorScheme, colors } = useAppTheme();
  const systemScreenStackPreset = useSystemScreenStackPreset();
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

  // Session init (token refresh + SignalR) is a background concern shared by
  // both entry surfaces: the welcome page (first install) and the home page
  // (logged-in, which shows its existing skeletons meanwhile). A failed
  // refresh clears credentials and flips the guard back to the welcome page;
  // manual sign-out does the same.
  useEffect(() => {
    void startClient().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (authentication.status === 'authenticated') setHadAuthenticatedSession(true);
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
      <View style={[styles.blankRoot, { backgroundColor: colors.background }]} />
    );
  }

  return (
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
                  headerLargeTitle: true,
                  headerShown: true,
                  title: t('routes.search'),
                }}
              />
              <Stack.Screen
                name="book/[id]/comments"
                options={{ headerShown: true, title: t('routes.comments') }}
              />
              <Stack.Screen
                name="announcements"
                options={{ headerShown: true, title: t('routes.announcements') }}
              />
              <Stack.Screen
                name="announcement/[source]/[id]"
                options={{ headerShown: true, title: '' }}
              />
              <Stack.Screen
                name="books"
                options={{ headerShown: true, title: t('routes.allNovels') }}
              />
              <Stack.Screen
                name="comics"
                options={{ headerShown: true, title: t('routes.allComics') }}
              />
              <Stack.Screen
                name="ranking"
                options={{ headerShown: true, title: t('routes.rankings') }}
              />
              <Stack.Screen
                name="shelf/folder"
                options={{ headerLargeTitle: false, headerShown: true, title: t('routes.folder') }}
              />
              <Stack.Screen
                name="shelf/action"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: 'fitToContents',
                  sheetGrabberVisible: true,
                  title: '',
                }}
              />
              <Stack.Screen
                name="announcement/comment-compose"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: 'fitToContents',
                  sheetGrabberVisible: false,
                  title: '',
                }}
              />
              <Stack.Screen
                name="book/[id]/comment-compose"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: 'fitToContents',
                  sheetGrabberVisible: false,
                  title: '',
                }}
              />
              <Stack.Screen
                name="book/[id]/introduction"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.75, 1],
                  sheetGrabberVisible: true,
                  sheetInitialDetentIndex: 0,
                  title: '',
                }}
              />
              <Stack.Screen
                name="book/[id]/tags"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: 'fitToContents',
                  sheetGrabberVisible: true,
                  title: '',
                }}
              />
              <Stack.Screen
                name="book/[id]/uploader"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: 'fitToContents',
                  sheetGrabberVisible: true,
                  title: '',
                }}
              />
              <Stack.Screen
                name="book/[id]/versions"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.6, 1],
                  sheetGrabberVisible: true,
                  sheetInitialDetentIndex: 0,
                  title: '',
                }}
              />
              <Stack.Screen
                name="user/[id]"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.5, 1],
                  sheetGrabberVisible: true,
                  sheetInitialDetentIndex: 0,
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
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.5, 1],
                  sheetGrabberVisible: true,
                  sheetInitialDetentIndex: 0,
                  title: t('routes.chapters'),
                }}
              />
              <Stack.Screen
                name="reader/[bookId]/settings"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.5, 1],
                  sheetGrabberVisible: true,
                  sheetInitialDetentIndex: 0,
                  title: t('routes.reading'),
                }}
              />
            </Stack.Protected>
            <Stack.Protected guard={!hasAuthenticatedSession}>
              <Stack.Screen name="sign-in" options={{ headerShown: false }} />
              <Stack.Screen
                name="sign-in/credentials"
                options={{ headerShown: true, title: tAuth('navigation.signIn') }}
              />
              <Stack.Screen
                name="register"
                options={{ headerShown: true, title: tAuth('navigation.register') }}
              />
              <Stack.Screen
                name="register/verify"
                options={{ headerShown: true, title: tAuth('navigation.register') }}
              />
              <Stack.Screen
                name="reset-password"
                options={{ headerShown: true, title: tAuth('navigation.recover') }}
              />
              <Stack.Screen
                name="reset-password/verify"
                options={{ headerShown: true, title: tAuth('navigation.recover') }}
              />
              <Stack.Screen
                name="reset-password/new-password"
                options={{ headerShown: true, title: tAuth('navigation.recover') }}
              />
            </Stack.Protected>
          </Stack>
          <ClientSessionFeedback sessionDecided={sessionDecided} />
          <ClientRealtimeEvents />
        </BookDetailThemeProvider>
      </ThemeProvider>
    </HeroUINativeProvider>
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

import '../global.css';

import { ToastProvider } from '@celia-sh/react-native-pretty-toast';
import { PanelUIProvider } from 'panelui-native';
import { DarkTheme, DefaultTheme, router, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookDetailThemeProvider } from '@/components/book-detail-theme-provider';
import { ClientRealtimeEvents } from '@/components/client-realtime-events';
import { ClientSessionFeedback } from '@/components/client-session-feedback';
import { LayoutTransitionCover } from '@/components/layout-transition-cover';
import { SkeletonPulseProvider } from '@/components/skeleton';
import { AppLocalizationProvider } from '@/localization/localization-provider';
import { useAuthentication } from '@/hooks/use-authentication';
import { SettledLayoutProvider } from '@/hooks/use-settled-layout';
import { runAutomaticAppUpdateCheck } from '@/services/app-update-alerts';
import { shouldShowAuthenticatedRoutes } from '@/services/auth-route-guard';
import { hasStoredSession, startClient } from '@/services/client';
import { loadAppSettings } from '@/services/settings';
import {
  currentAppVersion,
  hasPendingWhatsNew,
  loadWhatsNewState,
  markWhatsNewSeen,
  useWhatsNewLastSeenVersion,
} from '@/services/whats-new-store';
import { WHATS_NEW_RELEASE } from '@/services/whats-new-release';
import { AppThemeProvider, useAppTheme } from '@/theme/app-theme';
import { useSystemScreenStackPreset } from '@/theme/stack-preset';

// The session probe is a local SecureStore read (no network). It is kicked off
// at module scope so the route decision (app vs sign-in welcome) is typically
// ready before the first frame paints. The splash shows the logo normally and
// auto-hides; it is never used to cover up a routing transition.
const sessionProbe = Promise.all([
  hasStoredSession(),
  loadAppSettings(),
  loadWhatsNewState(),
]);

export default function RootLayout() {
  return (
    <AppLocalizationProvider>
      <AppThemeProvider>
        <PanelUIProvider>
          {/* Chat scrolling subscribes to the keyboard animation through this
              root-level react-native-keyboard-controller provider. */}
          <KeyboardProvider>
            <ToastProvider maxQueue={3}>
              <SkeletonPulseProvider>
                <RootLayoutContent />
              </SkeletonPulseProvider>
            </ToastProvider>
          </KeyboardProvider>
        </PanelUIProvider>
      </AppThemeProvider>
    </AppLocalizationProvider>
  );
}

function RootLayoutContent() {
  const authentication = useAuthentication();
  const { t } = useTranslation('navigation');
  const { t: tAuth } = useTranslation('auth');
  const { t: tSettings } = useTranslation('settings');
  const { colorScheme, colors } = useAppTheme();
  const systemScreenStackPreset = useSystemScreenStackPreset();
  // False until the local session probe resolves. The probe decides the very
  // first rendered screen, so a logged-in user never passes through the
  // welcome page and a first-install user goes straight to the welcome page.
  const [sessionDecided, setSessionDecided] = useState(false);
  const [hadAuthenticatedSession, setHadAuthenticatedSession] = useState(false);
  // The stored session at launch, before a fresh sign-in can flip
  // `hadAuthenticatedSession`. A launch without one is a first install or a
  // manual sign-out, so it has no update to announce.
  const [storedSessionAtLaunch, setStoredSessionAtLaunch] = useState<boolean | null>(null);
  const whatsNewPrompted = useRef(false);
  const whatsNewBaselineMarked = useRef(false);
  const whatsNewLastSeen = useWhatsNewLastSeenVersion();
  const [updateCheckAllowed, setUpdateCheckAllowed] = useState(false);

  // A transient refresh keeps an established app route mounted. Credential
  // acquisition stays in the auth stack until it publishes `authenticated`,
  // which prevents protected requests during sign-in. Manual sign-out keeps
  // the current route until it finishes or definitively publishes `signedOut`.
  const hasAuthenticatedSession = shouldShowAuthenticatedRoutes(
    authentication.status,
    hadAuthenticatedSession,
  );

  useEffect(() => {
    let mounted = true;
    void sessionProbe.then(([stored]) => {
      if (!mounted) return;
      setStoredSessionAtLaunch(stored);
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

  // Announce the release once per update. The launch probe's stored session
  // decides whether the app opens signed in, so an expired token still sees
  // the sheet after the protected stack mounts; a first install or a manual
  // sign-out does not. The push waits a beat so the launch frame settles
  // before the sheet presents.
  useEffect(() => {
    if (!sessionDecided || storedSessionAtLaunch !== true) return;
    if (!hasAuthenticatedSession) return;
    if (whatsNewPrompted.current) return;
    if (!hasPendingWhatsNew()) return;
    // Marked only when the push happens: a cancelled timer (a dependency
    // change, or a development double-run of effects) must not count as
    // shown, or this launch would never present the sheet.
    const timer = setTimeout(() => {
      whatsNewPrompted.current = true;
      router.push('/whats-new');
    }, 350);
    return () => clearTimeout(timer);
  }, [sessionDecided, storedSessionAtLaunch, hasAuthenticatedSession]);

  // A session that turns out to be invalid unmounts the protected stack and
  // the sheet without a confirmation. Announce again after the next sign-in
  // instead of treating that as a dismissal.
  useEffect(() => {
    if (hasAuthenticatedSession) return;
    if (!whatsNewPrompted.current) return;
    if (hasPendingWhatsNew()) whatsNewPrompted.current = false;
  }, [hasAuthenticatedSession, whatsNewLastSeen]);

  // The startup update check waits for the announcement: a native update
  // alert must not compete with the sheet or present underneath it. A build
  // with nothing to announce releases the check right away, and so does a
  // stored session that turned out invalid: the sheet cannot present from the
  // sign-in screen, so waiting would skip the check for the whole launch.
  useEffect(() => {
    if (!sessionDecided) return;
    if (
      storedSessionAtLaunch === true
      && hasAuthenticatedSession
      && hasPendingWhatsNew()
    ) return;
    setUpdateCheckAllowed(true);
  }, [sessionDecided, storedSessionAtLaunch, hasAuthenticatedSession, whatsNewLastSeen]);

  useEffect(() => {
    if (!updateCheckAllowed) return;
    // Let the sheet finish dismissing before a native alert can present.
    const timer = setTimeout(() => {
      void runAutomaticAppUpdateCheck((key) => tSettings(key));
    }, 600);
    return () => clearTimeout(timer);
  }, [updateCheckAllowed, tSettings]);

  useEffect(() => {
    if (authentication.status !== 'authenticated') return;
    setHadAuthenticatedSession(true);
    // A first install (or a session after a manual sign-out) signs in at the
    // current version: that is the baseline, not an update to announce on the
    // next launch.
    if (storedSessionAtLaunch !== false || whatsNewBaselineMarked.current) return;
    whatsNewBaselineMarked.current = true;
    void markWhatsNewSeen(
      currentAppVersion() ?? WHATS_NEW_RELEASE.version,
    ).catch(() => undefined);
  }, [authentication.status, storedSessionAtLaunch]);

  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  if (!sessionDecided) {
    // A plain themed frame for the sub-frame probe window (local read only,
    // no spinner, no wrong-screen flash); it visually continues the splash.
    return (
      <View style={[styles.blankRoot, { backgroundColor: colors.background }]} />
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <SettledLayoutProvider>
        <BookDetailThemeProvider>
          <Stack screenOptions={systemScreenStackPreset}>
            <Stack.Protected guard={hasAuthenticatedSession}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen name="book/[id]" options={{ title: '' }} />
              <Stack.Screen
                name="quick-search"
                options={{ headerShown: true, title: t('routes.search') }}
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
              {/* Direct messages are ordinary pushed pages, not sheets: the chat
                  pushes on top of the list with its own toolbar. */}
              <Stack.Screen
                name="messages/index"
                options={{ headerShown: true, title: t('routes.messages') }}
              />
              <Stack.Screen
                name="messages/[peerId]"
                options={{ headerShown: true, title: '' }}
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
              {/* The launch announcement only leaves through its button:
                  no grabber, and `gestureEnabled: false` sets
                  `isModalInPresentation` so the sheet cannot be swiped away. */}
              <Stack.Screen
                name="whats-new"
                options={{
                  // Plain full-height form sheet. UIKit owns the outline: on
                  // iOS 26 a full-height sheet attaches to the bottom edge,
                  // so only the top corners round. The book-info sheets get
                  // bottom corners because they open at a partial detent;
                  // this one stays full height. react-native-screens also
                  // gives formSheet content a 0x0 layout unless the content
                  // style has an explicit height (issue #2522), which is the
                  // blank sheet this fixes.
                  contentStyle: {
                    backgroundColor: colors.surface,
                    height: '100%',
                  },
                  gestureEnabled: false,
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: [1],
                  sheetExpandsWhenScrolledToEdge: false,
                  sheetGrabberVisible: false,
                  sheetInitialDetentIndex: 0,
                  title: '',
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
              <Stack.Screen
                name="human-verification"
                options={{
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: 'fitToContents',
                  sheetGrabberVisible: true,
                  title: '',
                }}
              />
            </Stack.Protected>
          </Stack>
          <ClientSessionFeedback sessionDecided={sessionDecided} />
          <ClientRealtimeEvents />
          <LayoutTransitionCover />
        </BookDetailThemeProvider>
      </SettledLayoutProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  blankRoot: { flex: 1 },
});

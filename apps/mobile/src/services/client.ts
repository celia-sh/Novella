import { ApiClient } from '@novella/api-client';
import {
  AUTH_CREDENTIAL_KEYS,
  createAnnouncementsUseCase,
  createAuthenticationUseCase,
  createBookDetailUseCase,
  createBookSearchUseCase,
  createClientSessionController,
  createCommentsUseCase,
  createComicDetailUseCase,
  createCommunitySpeechGuard,
  createCommunityUseCase,
  createDiscoveryUseCase,
  createHistoryUseCase,
  createNotificationsUseCase,
  createProfileUseCase,
  createReaderUseCase,
  createShelfUseCase,
  type AnnouncementsUseCase,
  type AuthenticationUseCase,
  type BookDetailUseCase,
  type BookSearchUseCase,
  type CommentsUseCase,
  type ComicDetailUseCase,
  type CommunitySpeechGuard,
  type CommunityUseCase,
  type DiscoveryUseCase,
  type HistoryUseCase,
  type NotificationsUseCase,
  type ProfileUseCase,
  type ReaderUseCase,
  type ShelfUseCase,
} from '@novella/client-core';

import {
  createExpoStorage,
  ExpoAppLifecycle,
  ExpoClock,
  ExpoCredentialStore,
  ExpoHttpTransport,
  ExpoLogger,
  ExpoPasswordHasher,
  ExpoRequestIdentity,
  ExpoSignalRTransport,
} from '@/adapters/expo-runtime';

const credentials = new ExpoCredentialStore();
const requestIdentity = new ExpoRequestIdentity(credentials);
const http = new ExpoHttpTransport(credentials, requestIdentity);
const signalR = new ExpoSignalRTransport(credentials, requestIdentity);
const lifecycle = new ExpoAppLifecycle();
const storage = createExpoStorage();
const passwordHasher = new ExpoPasswordHasher();
let authentication: AuthenticationUseCase;
const session = createClientSessionController({
  bootstrapAuthentication: () => authentication.bootstrap(),
  refreshAuthentication: () => authentication.refresh(),
  lifecycle,
  signalR,
});
const api = new ApiClient(http, session.transport, {
  refresh: () => authentication.refresh(),
});

export const announcements: AnnouncementsUseCase = createAnnouncementsUseCase(api);
export const discovery: DiscoveryUseCase = createDiscoveryUseCase(api);
export const bookDetails: BookDetailUseCase = createBookDetailUseCase(api);
export const comicDetails: ComicDetailUseCase = createComicDetailUseCase(api);
export const bookSearch: BookSearchUseCase = createBookSearchUseCase(api);
export const comments: CommentsUseCase = createCommentsUseCase(api);
export const communitySpeechGuard: CommunitySpeechGuard = createCommunitySpeechGuard({
  clock: new ExpoClock(),
  hasher: passwordHasher,
  http,
  logger: new ExpoLogger(),
  storage,
});
export const community: CommunityUseCase = createCommunityUseCase(
  api,
  communitySpeechGuard,
);
export const notifications: NotificationsUseCase = createNotificationsUseCase(api);
export const history: HistoryUseCase = createHistoryUseCase(api);
export const profile: ProfileUseCase = createProfileUseCase(api);
export const reader: ReaderUseCase = createReaderUseCase(api);
export const shelf: ShelfUseCase = createShelfUseCase(api);
authentication = createAuthenticationUseCase(
  api,
  passwordHasher,
  credentials,
  signalR,
);

export { authentication, storage };

/**
 * Local-only probe of whether a session was ever stored. Resolves fast (no
 * network): lets the root layout decide the initial screen immediately and
 * skip the startup spinner. The stored token is validated in the background
 * by `startClient()`; an invalid session flips the auth status to signedOut
 * and the root guard bounces the user back to the sign-in flow.
 */
export async function hasStoredSession(): Promise<boolean> {
  try {
    return (await credentials.get(AUTH_CREDENTIAL_KEYS.refreshToken)) !== null;
  } catch {
    return false;
  }
}

export function startClient() {
  return session.start();
}

export function registerClientBackgroundTask(task: () => void | Promise<void>) {
  return session.registerBeforeBackground(task);
}

export function subscribeClientLifecycle(
  listener: (state: 'background' | 'foreground') => void,
) {
  return lifecycle.subscribe(listener);
}

export async function closeClient(): Promise<void> {
  await session.close();
}

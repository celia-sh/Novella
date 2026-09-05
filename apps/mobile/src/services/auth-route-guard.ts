import type { AuthenticationStatus } from '@novella/client-core';

/**
 * Keep an established app route during transient startup/recovery states and
 * while a manual sign-out is finishing, but never leave it mounted while
 * credentials are being acquired.
 */
export function shouldShowAuthenticatedRoutes(
  status: AuthenticationStatus,
  hadAuthenticatedSession: boolean,
): boolean {
  switch (status) {
    case 'authenticated':
      return true;
    case 'unknown':
    case 'refreshing':
      return hadAuthenticatedSession;
    case 'signingOut':
      return hadAuthenticatedSession;
    case 'registering':
    case 'signedOut':
    case 'signingIn':
      return false;
  }
}

import { useSyncExternalStore } from 'react';

import type { TurnstileAction } from '@/services/turnstile';

/**
 * Bridges a form's pending token request to the human-verification sheet
 * route. The sheet settles exactly one of the callbacks.
 */
export interface TurnstileSession {
  action: TurnstileAction;
  onCancel: () => void;
  onToken: (token: string) => void;
}

let session: TurnstileSession | null = null;
let presented = false;
const listeners = new Set<() => void>();

/** Replaces any earlier session; an unsettled one is cancelled, never left hanging. */
export function openTurnstileSession(next: TurnstileSession) {
  const previous = session;
  session = next;
  presented = false;
  publish();
  previous?.onCancel();
}

/** Closes `target` if it is still current, or the current session when omitted. */
export function closeTurnstileSession(target?: TurnstileSession) {
  if (target && target !== session) return;
  session = null;
  presented = false;
  publish();
}

/** Called by the sheet once it is on screen. */
export function markTurnstileSessionPresented(target: TurnstileSession) {
  if (target === session) presented = true;
}

export function isTurnstileSessionPresented(target: TurnstileSession) {
  return target === session && presented;
}

export function useTurnstileSession() {
  return useSyncExternalStore(subscribe, () => session, () => session);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish() {
  for (const listener of listeners) listener();
}

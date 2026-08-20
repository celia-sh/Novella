import { useSyncExternalStore } from 'react';

import type { ShelfMoveDestination } from '@/services/shelf-editing';

export type ShelfActionSession =
  | {
      initialValue: string;
      kind: 'folderName';
      onSubmit: (title: string) => void;
      placeholder: string;
      submitLabel: string;
      title: string;
    }
  | {
      destinations: ShelfMoveDestination[];
      kind: 'move';
      onSelect: (destination: ShelfMoveDestination) => void;
      subtitle: string;
      title: string;
    };

let session: ShelfActionSession | null = null;
const listeners = new Set<() => void>();

export function openShelfActionSession(next: ShelfActionSession) {
  session = next;
  publish();
}

export function closeShelfActionSession() {
  session = null;
  publish();
}

export function useShelfActionSession() {
  return useSyncExternalStore(subscribe, () => session, () => session);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish() {
  for (const listener of listeners) listener();
}

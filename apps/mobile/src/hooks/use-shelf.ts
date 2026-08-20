import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { ApiError } from '@novella/api-client';
import {
  createShelfDraft,
  createShelfFolder,
  moveShelfBooks,
  removeShelfItems,
  renameShelfFolder,
  reorderShelfSiblings,
  type ShelfDraft,
  type ShelfItemKey,
  type ShelfSnapshot,
} from '@novella/client-core';

import type {
  LibraryMessage,
  LibraryMessageKey,
} from '@/localization/locales/library';
import { shelf } from '@/services/client';

export type ShelfMode = 'browse' | 'edit';

export type ShelfState =
  | { status: 'loading'; snapshot: null; error: null }
  | { status: 'refreshing'; snapshot: ShelfSnapshot; error: null }
  | { status: 'ready'; snapshot: ShelfSnapshot; error: null }
  | { status: 'error'; snapshot: ShelfSnapshot | null; error: LibraryMessage };

interface ShelfEditorState {
  error: LibraryMessage | null;
  mode: ShelfMode;
}

interface ShelfPersistenceState {
  canRetry: boolean;
  error: LibraryMessage | null;
  generation: number;
  isSaving: boolean;
}

const initialSnapshot = shelf.getSnapshot();
let persistenceState: ShelfPersistenceState = {
  canRetry: false,
  error: null,
  generation: 0,
  isSaving: false,
};
const persistenceListeners = new Set<() => void>();

export function useShelf() {
  const [state, setState] = useState<ShelfState>(() =>
    initialSnapshot
      ? { status: 'ready', snapshot: initialSnapshot, error: null }
      : { status: 'loading', snapshot: null, error: null },
  );
  const [editor, setEditor] = useState<ShelfEditorState>({
    error: null,
    mode: 'browse',
  });
  const persistence = useSyncExternalStore(
    subscribeToShelfPersistence,
    getShelfPersistenceState,
    getShelfPersistenceState,
  );
  const editorRef = useRef(editor);
  const loadGenerationRef = useRef(0);

  editorRef.current = editor;

  const updateEditor = useCallback((update: (current: ShelfEditorState) => ShelfEditorState) => {
    const next = update(editorRef.current);
    editorRef.current = next;
    setEditor(next);
  }, []);

  const load = useCallback(async (refresh: boolean, showRefreshIndicator: boolean) => {
    if (editorRef.current.mode !== 'browse') return;
    const generation = ++loadGenerationRef.current;
    setState((current) => {
      const snapshot = current.snapshot ?? shelf.getSnapshot();
      if (refresh && snapshot) {
        return showRefreshIndicator
          ? { status: 'refreshing', snapshot, error: null }
          : { status: 'ready', snapshot, error: null };
      }
      return { status: 'loading', snapshot: null, error: null };
    });

    try {
      const snapshot = await shelf.load();
      if (
        generation !== loadGenerationRef.current ||
        editorRef.current.mode !== 'browse'
      ) return;
      setState({ status: 'ready', snapshot, error: null });
    } catch (error) {
      if (generation !== loadGenerationRef.current) return;
      setState((current) => ({
        status: 'error',
        snapshot: current.snapshot ?? shelf.getSnapshot(),
        error: getShelfErrorMessage(error),
      }));
    }
  }, []);

  useEffect(() => shelf.subscribe((snapshot) => {
    setState({ status: 'ready', snapshot, error: null });
  }), []);

  useFocusEffect(useCallback(() => {
    if (editorRef.current.mode === 'browse') {
      const cached = shelf.getSnapshot();
      if (cached) {
        setState({ status: 'ready', snapshot: cached, error: null });
        void load(true, false);
      } else {
        void load(false, false);
      }
    }
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [load]));

  const applyMutation = useCallback((
    command: (draft: ShelfDraft, now: string) => ShelfDraft,
  ): boolean => {
    const snapshot = shelf.getSnapshot();
    if (!snapshot) return false;

    try {
      const next = command(createShelfDraft(snapshot), new Date().toISOString());
      updateEditor((current) => ({ ...current, error: null }));
      persistShelfDraft(next);
      return true;
    } catch (error) {
      updateEditor((current) => ({
        ...current,
        error: getShelfEditErrorMessage(error),
      }));
      return false;
    }
  }, [updateEditor]);

  const beginEdit = useCallback(() => {
    if (!shelf.getSnapshot()) return false;
    updateEditor((current) => ({ ...current, mode: 'edit' }));
    return true;
  }, [updateEditor]);

  const exitEdit = useCallback(() => {
    updateEditor((current) => ({ ...current, mode: 'browse' }));
  }, [updateEditor]);

  const createFolder = useCallback((title: string) => applyMutation(
    (draft, now) => createShelfFolder(draft, {
      id: Crypto.randomUUID(),
      now,
      title,
    }),
  ), [applyMutation]);

  const renameFolder = useCallback((id: string, title: string) => applyMutation(
    (draft, now) => renameShelfFolder(draft, { id, now, title }),
  ), [applyMutation]);

  const removeItems = useCallback((keys: ReadonlySet<ShelfItemKey>) => applyMutation(
    (draft, now) => removeShelfItems(draft, { keys, now }),
  ), [applyMutation]);

  const moveBooks = useCallback((
    bookIds: readonly number[],
    destination: readonly string[],
  ) => applyMutation(
    (draft, now) => moveShelfBooks(draft, { bookIds, destination, now }),
  ), [applyMutation]);

  const reorderSiblings = useCallback((
    parents: readonly string[],
    orderedKeys: readonly ShelfItemKey[],
  ) => applyMutation(
    (draft, now) => reorderShelfSiblings(draft, {
      now,
      orderedKeys,
      parents,
    }),
  ), [applyMutation]);

  const retrySave = useCallback(() => {
    const snapshot = shelf.getSnapshot();
    if (!snapshot) return false;
    updateEditor((current) => ({ ...current, error: null }));
    persistShelfDraft(createShelfDraft(snapshot));
    return true;
  }, [updateEditor]);

  const clearEditorError = useCallback(() => {
    updateEditor((current) => ({ ...current, error: null }));
  }, [updateEditor]);

  const snapshot = useMemo<ShelfSnapshot | null>(() => state.snapshot, [state.snapshot]);

  return {
    beginEdit,
    clearEditorError,
    createFolder,
    editorCanRetry: editor.error === null && persistence.canRetry,
    editorError: editor.error ?? persistence.error,
    error: state.status === 'error' ? state.error : null,
    exitEdit,
    isLoading: state.status === 'loading',
    isRefreshing: state.status === 'refreshing',
    isSaving: persistence.isSaving,
    mode: editor.mode,
    moveBooks,
    reload: () => load(Boolean(state.snapshot), true),
    removeItems,
    renameFolder,
    reorderSiblings,
    retrySave,
    snapshot,
  };
}

function getShelfPersistenceState(): ShelfPersistenceState {
  return persistenceState;
}

function subscribeToShelfPersistence(listener: () => void) {
  persistenceListeners.add(listener);
  return () => persistenceListeners.delete(listener);
}

function publishShelfPersistence(next: ShelfPersistenceState) {
  persistenceState = next;
  for (const listener of persistenceListeners) listener();
}

function persistShelfDraft(draft: ShelfDraft) {
  const generation = persistenceState.generation + 1;
  publishShelfPersistence({
    canRetry: false,
    error: null,
    generation,
    isSaving: true,
  });

  void shelf.save(draft).then(
    () => {
      if (generation !== persistenceState.generation) return;
      publishShelfPersistence({
        canRetry: false,
        error: null,
        generation,
        isSaving: false,
      });
    },
    (error: unknown) => {
      if (generation !== persistenceState.generation) return;
      publishShelfPersistence({
        canRetry: true,
        error: getShelfErrorMessage(error),
        generation,
        isSaving: false,
      });
    },
  );
}

function getShelfErrorMessage(error: unknown): LibraryMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.auth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.network' };
    return { kind: 'raw', text: error.message };
  }
  return error instanceof Error
    ? { kind: 'raw', text: error.message }
    : { kind: 'key', key: 'errors.shelfUpdate' };
}

const SHELF_EDIT_ERROR_KEYS: Readonly<Record<string, LibraryMessageKey>> = {
  'A valid folder name is required.': 'errors.folderNameRequired',
  'A folder with this id already exists.': 'errors.folderIdExists',
  'A folder with this name already exists.': 'errors.folderNameExists',
  'The folder no longer exists.': 'errors.folderMissing',
  'Select at least one book to move.': 'errors.selectBookToMove',
  'A selected book no longer exists.': 'errors.selectedBookMissing',
  'Reordering must contain every sibling exactly once.': 'errors.invalidReorder',
  'The destination folder no longer exists.': 'errors.destinationMissing',
};

function getShelfEditErrorMessage(error: unknown): LibraryMessage {
  if (!(error instanceof Error)) return { kind: 'key', key: 'errors.shelfEdit' };
  const key = SHELF_EDIT_ERROR_KEYS[error.message];
  return key ? { kind: 'key', key } : { kind: 'raw', text: error.message };
}

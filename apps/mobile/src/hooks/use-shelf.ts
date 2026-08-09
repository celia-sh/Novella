import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@novella/api-client';
import {
  createShelfDraft,
  createShelfFolder,
  deleteShelfFolder,
  moveShelfBooks,
  removeShelfItems,
  renameShelfFolder,
  reorderShelfSiblings,
  shelfDraftHasChanges,
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
  draft: ShelfDraft | null;
  error: LibraryMessage | null;
  isSaving: boolean;
  mode: ShelfMode;
}

const initialSnapshot = shelf.getSnapshot();

export function useShelf() {
  const [state, setState] = useState<ShelfState>(() =>
    initialSnapshot
      ? { status: 'ready', snapshot: initialSnapshot, error: null }
      : { status: 'loading', snapshot: null, error: null },
  );
  const [editor, setEditor] = useState<ShelfEditorState>({
    draft: null,
    error: null,
    isSaving: false,
    mode: 'browse',
  });
  const editorRef = useRef(editor);
  const requestGenerationRef = useRef(0);

  editorRef.current = editor;

  const load = useCallback(async (refresh: boolean, showRefreshIndicator: boolean) => {
    if (editorRef.current.mode !== 'browse') return;
    const generation = ++requestGenerationRef.current;
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
        generation !== requestGenerationRef.current ||
        editorRef.current.mode !== 'browse'
      ) return;
      setState({ status: 'ready', snapshot, error: null });
    } catch (error) {
      if (generation !== requestGenerationRef.current) return;
      setState((current) => ({
        status: 'error',
        snapshot: current.snapshot ?? shelf.getSnapshot(),
        error: getShelfErrorMessage(error),
      }));
    }
  }, []);

  useEffect(() => shelf.subscribe((snapshot) => {
    if (editorRef.current.mode !== 'browse') return;
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
      requestGenerationRef.current += 1;
    };
  }, [load]));

  const ensureDraft = useCallback(() => {
    if (editorRef.current.draft) return !editorRef.current.isSaving;
    const snapshot = shelf.getSnapshot();
    if (!snapshot || editorRef.current.isSaving) return false;
    requestGenerationRef.current += 1;
    setState({ status: 'ready', snapshot, error: null });
    const nextEditor: ShelfEditorState = {
      draft: createShelfDraft(snapshot),
      error: null,
      isSaving: false,
      mode: 'browse',
    };
    editorRef.current = nextEditor;
    setEditor(nextEditor);
    return true;
  }, []);

  const beginEdit = useCallback(() => ensureDraft(), [ensureDraft]);

  const cancelEdit = useCallback(() => {
    if (editorRef.current.isSaving) return false;
    setEditor({ draft: null, error: null, isSaving: false, mode: 'browse' });
    const snapshot = shelf.getSnapshot();
    if (snapshot) setState({ status: 'ready', snapshot, error: null });
    return true;
  }, []);

  const updateDraft = useCallback((command: (draft: ShelfDraft, now: string) => ShelfDraft) => {
    const current = editorRef.current;
    if (!current.draft || current.isSaving) return;
    let next: ShelfEditorState;
    try {
      next = {
        ...current,
        draft: command(current.draft, new Date().toISOString()),
        error: null,
      };
    } catch (error) {
      next = { ...current, error: getShelfEditErrorMessage(error) };
    }
    editorRef.current = next;
    setEditor(next);
  }, []);

  const createFolder = useCallback((title: string) => {
    updateDraft((draft, now) => createShelfFolder(draft, {
      id: Crypto.randomUUID(),
      now,
      title,
    }));
  }, [updateDraft]);

  const renameFolder = useCallback((id: string, title: string) => {
    updateDraft((draft, now) => renameShelfFolder(draft, { id, now, title }));
  }, [updateDraft]);

  const deleteFolder = useCallback((id: string) => {
    updateDraft((draft, now) => deleteShelfFolder(draft, { id, now }));
  }, [updateDraft]);

  const removeItems = useCallback((keys: ReadonlySet<ShelfItemKey>) => {
    updateDraft((draft, now) => removeShelfItems(draft, { keys, now }));
  }, [updateDraft]);

  const moveBooks = useCallback((bookIds: readonly number[], destination: readonly string[]) => {
    updateDraft((draft, now) => moveShelfBooks(draft, { bookIds, destination, now }));
  }, [updateDraft]);

  const reorderSiblings = useCallback((
    parents: readonly string[],
    orderedKeys: readonly ShelfItemKey[],
  ) => {
    updateDraft((draft, now) => reorderShelfSiblings(draft, {
      now,
      orderedKeys,
      parents,
    }));
  }, [updateDraft]);

  const clearEditorError = useCallback(() => {
    setEditor((current) => ({ ...current, error: null }));
  }, []);

  const saveEdit = useCallback(async () => {
    const current = editorRef.current;
    if (!current.draft || current.isSaving) return false;
    requestGenerationRef.current += 1;
    setEditor({ ...current, error: null, isSaving: true });
    try {
      const snapshot = await shelf.save(current.draft);
      setState({ status: 'ready', snapshot, error: null });
      setEditor({ draft: null, error: null, isSaving: false, mode: 'browse' });
      return true;
    } catch (error) {
      setEditor((next) => ({
        ...next,
        error: getShelfErrorMessage(error),
        isSaving: false,
      }));
      return false;
    }
  }, []);

  const snapshot = useMemo<ShelfSnapshot | null>(() => {
    if (!state.snapshot) return null;
    return editor.draft
      ? { ...state.snapshot, items: editor.draft.items, version: editor.draft.version }
      : state.snapshot;
  }, [editor.draft, state.snapshot]);
  const isDirty = Boolean(
    state.snapshot && editor.draft && shelfDraftHasChanges(state.snapshot, editor.draft),
  );

  return {
    beginEdit,
    cancelEdit,
    ensureDraft,
    clearEditorError,
    createFolder,
    deleteFolder,
    editorError: editor.error,
    error: state.status === 'error' ? state.error : null,
    isDirty,
    isLoading: state.status === 'loading',
    isRefreshing: state.status === 'refreshing',
    isSaving: editor.isSaving,
    mode: editor.mode,
    moveBooks,
    reload: () => load(Boolean(state.snapshot), true),
    removeItems,
    renameFolder,
    reorderSiblings,
    saveEdit,
    snapshot,
  };
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

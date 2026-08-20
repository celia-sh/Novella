import type { ShelfSnapshot } from '@novella/client-core';
import { getShelfFolderPaths } from '@novella/client-core';

export interface ShelfMoveDestination {
  id: string | null;
  label: string;
  path: string[];
}

export function getShelfMoveDestinations(
  snapshot: ShelfSnapshot,
  currentParents: readonly string[],
  shelfRootLabel: string,
): ShelfMoveDestination[] {
  const destinations: ShelfMoveDestination[] = currentParents.length > 0
    ? [{ id: null, label: shelfRootLabel, path: [] }]
    : [];
  const currentFolderId = currentParents.length === 1 ? currentParents[0] : null;

  for (const folder of getShelfFolderPaths({
    items: snapshot.items,
    version: snapshot.version,
  })) {
    if (folder.path.length !== 1 || folder.id === currentFolderId) continue;
    destinations.push({ id: folder.id, label: folder.label, path: folder.path });
  }

  return destinations;
}

export function resolveShelfSelectionActions(input: {
  destinationCount: number;
  selectedBookCount: number;
  selectedFolderCount: number;
}): { canDelete: boolean; canMove: boolean } {
  const selectionCount = input.selectedBookCount + input.selectedFolderCount;
  return {
    canDelete: selectionCount > 0,
    canMove:
      input.destinationCount > 0 &&
      input.selectedBookCount > 0 &&
      input.selectedFolderCount === 0,
  };
}

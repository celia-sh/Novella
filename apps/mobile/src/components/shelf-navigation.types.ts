import type { ShelfMode } from '@/hooks/use-shelf';

export type ShelfEditInteraction = 'reorder' | 'select';

export interface ShelfNavigationProps {
  canDelete: boolean;
  canMove: boolean;
  editInteraction: ShelfEditInteraction;
  isFolder: boolean;
  largeTitle: boolean;
  mode: ShelfMode;
  onCreateFolder: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onExitEdit: () => void;
  onMove: () => void;
  onRenameFolder: () => void;
  onToggleEditInteraction: () => void;
  title: string;
}

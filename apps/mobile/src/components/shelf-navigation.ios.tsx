import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { ShelfNavigationProps } from '@/components/shelf-navigation.types';

export function ShelfNavigation({
  canDelete,
  canMove,
  editInteraction,
  isFolder,
  largeTitle,
  mode,
  onCreateFolder,
  onDelete,
  onEdit,
  onExitEdit,
  onMove,
  onRenameFolder,
  onToggleEditInteraction,
  title,
}: ShelfNavigationProps) {
  const { t } = useTranslation('library');
  const isBrowsing = mode === 'browse';

  return (
    <>
      <Stack.Screen options={{ headerLargeTitle: largeTitle, title }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t('shelf.newFolder')}
          hidden={!isBrowsing || isFolder}
          icon="folder.badge.plus"
          onPress={onCreateFolder}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t('shelf.edit')}
          hidden={!isBrowsing}
          icon="square.and.pencil"
          onPress={onEdit}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t('shelf.renameFolder')}
          hidden={!isBrowsing || !isFolder}
          icon="pencil"
          onPress={onRenameFolder}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={editInteraction === 'select'
            ? t('shelf.switchToReorder')
            : t('shelf.switchToSelection')}
          hidden={isBrowsing}
          icon={editInteraction === 'select' ? 'arrow.up.arrow.down' : 'checkmark.circle'}
          onPress={onToggleEditInteraction}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t('shelf.moveSelectedItems')}
          disabled={!canMove}
          hidden={isBrowsing}
          icon="folder"
          onPress={onMove}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t('shelf.deleteSelectedItems')}
          disabled={!canDelete}
          hidden={isBrowsing}
          icon="trash"
          onPress={onDelete}
        />
        <Stack.Toolbar.Button
          accessibilityLabel={t('shelf.exitEdit')}
          hidden={isBrowsing}
          icon="xmark"
          onPress={onExitEdit}
        />
      </Stack.Toolbar>
    </>
  );
}

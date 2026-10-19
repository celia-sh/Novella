import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ShelfNavigationProps } from '@/components/shelf-navigation.types';
import { useRootPageTitle } from '@/hooks/use-wide-layout';

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
  const rootTitle = useRootPageTitle(title);
  const pushedTitle = useMemo(() => ({ headerLargeTitle: false, title }), [title]);

  return (
    <>
      {/* The shelf root follows the other root pages; folders and edit mode
          keep their small title, which names what is on screen. */}
      <Stack.Screen options={largeTitle ? rootTitle : pushedTitle} />
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

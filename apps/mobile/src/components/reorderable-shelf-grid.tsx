import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { ShelfItem } from '@novella/api-client';
import type { ShelfItemKey } from '@novella/client-core';

import { shelfItemKey } from '@novella/client-core';

export interface ReorderableShelfGridItemState {
  active: boolean;
}

interface ReorderableShelfGridProps {
  columns: number;
  contentWidth: number;
  items: ShelfItem[];
  dragEnabled: boolean;
  onBeginDrag?: () => boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  onReorder: (orderedKeys: ShelfItemKey[]) => void;
  renderItem: (item: ShelfItem, state: ReorderableShelfGridItemState) => React.ReactNode;
  tileWidth: number;
}

export function ReorderableShelfGrid({
  columns,
  contentWidth,
  dragEnabled,
  items,
  onBeginDrag,
  onLayout,
  onReorder,
  renderItem,
  tileWidth,
}: ReorderableShelfGridProps) {
  const renderSortableItem: SortableGridRenderItem<ShelfItem> = ({ item }) => (
    <View style={{ width: tileWidth }}>{renderItem(item, { active: false })}</View>
  );

  return (
    <View onLayout={onLayout} style={[styles.grid, { width: contentWidth }]}>
      <Sortable.Grid
        autoScrollActivationOffset={72}
        autoScrollEnabled
        autoScrollMaxVelocity={850}
        columnGap={10}
        columns={columns}
        data={items}
        dragActivationDelay={180}
        dragActivationFailOffset={10}
        keyExtractor={shelfItemKey}
        onDragEnd={({ data, fromIndex, toIndex }) => {
          if (fromIndex === toIndex) return;
          onReorder(data.map(shelfItemKey));
        }}
        onDragStart={() => {
          onBeginDrag?.();
        }}
        overDrag="vertical"
        renderItem={renderSortableItem}
        reorderTriggerOrigin="touch"
        rowGap={18}
        sortEnabled={dragEnabled}
        strategy="insert"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { alignSelf: 'center' },
});

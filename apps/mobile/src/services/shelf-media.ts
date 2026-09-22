import type {
  BookListItem,
  ShelfBookItem,
  ShelfBookType,
  ShelfItem,
} from '@novella/api-client';
import {
  getShelfItemsAtPath,
  shelfBookRefKey,
  shelfItemKey,
  type ShelfBookRecord,
  type ShelfBookRef,
  type ShelfItemKey,
  type ShelfSnapshot,
} from '@novella/client-core';

export type ShelfMediaType = 'All' | 'Novel' | 'Comic';
export type ShelfMediaRouteParam = 'all' | 'novel' | 'comic';
export type ShelfDetailType = 'Novel' | 'Comic';
type TypedShelfMediaType = Exclude<ShelfMediaType, 'All'>;

export interface ShelfFolderProjection {
  bookCount: number;
  childFolderCount: number;
  itemCount: number;
  previewBooks: BookListItem[];
}

export interface ShelfProjection {
  items: ShelfItem[];
  folderProjections: ReadonlyMap<ShelfItemKey, ShelfFolderProjection>;
}

export interface ShelfBookRouteParams {
  cover: string;
  id: string;
  placeholder: string;
  title: string;
  type: ShelfDetailType;
  seriesTitle?: string;
}

export function parseShelfMediaParam(value: unknown): ShelfMediaType {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'novel') return 'Novel';
  if (raw === 'comic') return 'Comic';
  return 'All';
}

export function serializeShelfMedia(media: ShelfMediaType): ShelfMediaRouteParam {
  if (media === 'Novel') return 'novel';
  if (media === 'Comic') return 'comic';
  return 'all';
}

export function shelfMediaToBookType(media: TypedShelfMediaType): ShelfBookType {
  return media === 'Comic' ? 'COMIC' : 'NOVEL';
}

export function shelfBookTypeToMedia(type: ShelfBookType): ShelfDetailType {
  return type === 'COMIC' ? 'Comic' : 'Novel';
}

export function shelfBookRefForMedia(id: number, media: TypedShelfMediaType): ShelfBookRef {
  return { id, type: shelfMediaToBookType(media) };
}

export function shelfBookRouteParams(
  item: ShelfBookItem,
  book: BookListItem,
): ShelfBookRouteParams {
  const type = item.type === 'COMIC' ? 'Comic' : 'Novel';
  const params: ShelfBookRouteParams = {
    cover: book.coverUrl,
    id: String(item.id),
    placeholder: book.coverPlaceholder ?? '',
    title: book.title,
    type,
  };
  return type === 'Comic'
    ? { ...params, seriesTitle: book.seriesTitle?.trim() || book.title }
    : params;
}

/**
 * Projects one complete shelf snapshot for browse or edit rendering.
 * `media` is null for edit mode, where every typed sibling remains visible.
 */
export function projectShelfItems(
  snapshot: ShelfSnapshot,
  parents: readonly string[],
  media: ShelfMediaType | null,
): ShelfProjection {
  const shelfType = media === null || media === 'All' ? null : shelfMediaToBookType(media);
  const booksByKey = createBooksByKey(snapshot.books);
  const folderProjections = buildFolderProjections(snapshot.items, shelfType, booksByKey);

  const directItems = getShelfItemsAtPath(
    { items: snapshot.items, version: snapshot.version },
    parents,
  );
  const items = directItems.filter((item) => {
    if (item.type !== 'FOLDER') return shelfType === null || item.type === shelfType;
    if (shelfType === null) return true;
    return (folderProjections.get(shelfItemKey(item))?.bookCount ?? 0) > 0;
  });

  return { folderProjections, items };
}

export function projectShelfBrowse(
  snapshot: ShelfSnapshot,
  parents: readonly string[],
  media: ShelfMediaType,
): ShelfProjection {
  return projectShelfItems(snapshot, parents, media);
}

interface InternalFolderProjection {
  matchingBooks: ShelfBookItem[];
  projection: ShelfFolderProjection;
}

function buildFolderProjections(
  items: readonly ShelfItem[],
  shelfType: ShelfBookType | null,
  booksByKey: ReadonlyMap<ShelfItemKey, BookListItem | null>,
): ReadonlyMap<ShelfItemKey, ShelfFolderProjection> {
  const results = new Map<ShelfItemKey, InternalFolderProjection>();
  const visiting = new Set<ShelfItemKey>();

  const visit = (
    folder: Extract<ShelfItem, { type: 'FOLDER' }>,
  ): InternalFolderProjection => {
    const key = shelfItemKey(folder);
    const cached = results.get(key);
    if (cached) return cached;
    if (visiting.has(key)) {
      return {
        matchingBooks: [],
        projection: { bookCount: 0, childFolderCount: 0, itemCount: 0, previewBooks: [] },
      };
    }

    visiting.add(key);
    const folderPath = [...folder.parents, folder.id];
    const directItems = orderShelfItems(items.filter((item) => sameParents(item.parents, folderPath)));
    const matchingBooks: ShelfBookItem[] = [];
    let childFolderCount = 0;

    for (const item of directItems) {
      if (item.type === 'FOLDER') {
        const child = visit(item);
        if (child.matchingBooks.length > 0) {
          childFolderCount += 1;
          matchingBooks.push(...child.matchingBooks);
        }
      } else if (shelfType === null || item.type === shelfType) {
        matchingBooks.push(item);
      }
    }

    const previewBooks = matchingBooks
      .flatMap((book) => {
        const card = booksByKey.get(shelfItemKey(book));
        return card ? [card] : [];
      })
      .slice(0, 4);
    const result: InternalFolderProjection = {
      matchingBooks,
      projection: {
        bookCount: matchingBooks.length,
        childFolderCount,
        itemCount: directItems.length,
        previewBooks,
      },
    };
    results.set(key, result);
    visiting.delete(key);
    return result;
  };

  for (const item of items) {
    if (item.type === 'FOLDER') visit(item);
  }

  return new Map([...results].map(([key, result]) => [key, result.projection]));
}

function createBooksByKey(
  records: readonly ShelfBookRecord[],
): ReadonlyMap<ShelfItemKey, BookListItem | null> {
  return new Map(records.map((record) => [shelfBookRefKey(record.ref), record.book]));
}

function orderShelfItems<T extends ShelfItem>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.index !== right.index) return left.index - right.index;
    return left.parents.length - right.parents.length;
  });
}

function sameParents(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

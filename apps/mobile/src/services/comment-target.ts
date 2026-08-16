import type { CommentTargetType } from '@novella/api-client';

export interface CommentTarget {
  id: number;
  seriesTitle?: string;
  type: CommentTargetType;
}

export interface BookCommentRouteParams {
  [key: string]: string;
  commentType: 'Book' | 'Series';
  id: string;
}

export function getCommentTargetKey(target: CommentTarget): string {
  return `${target.type}:${target.id}:${target.seriesTitle?.trim() ?? ''}`;
}

export function toBookCommentRouteParams({
  bookId,
  bookType,
  seriesTitle,
}: {
  bookId: number;
  bookType: 'Comic' | 'Novel' | null;
  seriesTitle?: string;
}): BookCommentRouteParams {
  const normalizedSeriesTitle = seriesTitle?.trim();
  if (bookType === 'Comic') {
    return {
      commentType: 'Series',
      id: String(bookId),
      ...(normalizedSeriesTitle ? { seriesTitle: normalizedSeriesTitle } : {}),
    };
  }
  return { commentType: 'Book', id: String(bookId) };
}

export function resolveBookCommentTarget({
  bookId,
  commentType,
  seriesTitle,
}: {
  bookId: number;
  commentType?: string;
  seriesTitle?: string;
}): CommentTarget {
  if (commentType !== undefined && commentType !== 'Book' && commentType !== 'Series') {
    throw new Error('An unknown comment target type was provided.');
  }
  const normalizedSeriesTitle = seriesTitle?.trim();
  if (commentType === 'Series') {
    return {
      type: 'Series',
      id: 0,
      ...(normalizedSeriesTitle ? { seriesTitle: normalizedSeriesTitle } : {}),
    };
  }
  return { type: 'Book', id: bookId };
}

export function toCommentTargetRouteParams(target: CommentTarget) {
  return {
    commentType: target.type,
    ...(target.seriesTitle === undefined ? {} : { seriesTitle: target.seriesTitle }),
  };
}

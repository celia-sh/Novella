import type { CommentTargetType } from '@novella/api-client';

export interface CommentTarget {
  id: number;
  type: CommentTargetType;
}

export interface BookCommentRouteParams {
  [key: string]: string;
  commentType: 'Book';
  id: string;
}

export function getCommentTargetKey(target: CommentTarget): string {
  return `${target.type}:${target.id}`;
}

export function toBookCommentRouteParams({
  bookId,
}: {
  bookId: number;
}): BookCommentRouteParams {
  return { commentType: 'Book', id: String(bookId) };
}

export function resolveBookCommentTarget({
  bookId,
  commentType,
}: {
  bookId: number;
  commentType?: string;
}): CommentTarget {
  if (commentType !== undefined && commentType !== 'Book') {
    throw new Error('An unknown comment target type was provided.');
  }
  return { type: 'Book', id: bookId };
}

export function toCommentTargetRouteParams(target: CommentTarget) {
  return {
    commentType: target.type,
  };
}

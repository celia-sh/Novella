import type { CommentTargetType } from '@novella/api-client';

export interface CommentTarget {
  id: number;
  seriesTitle?: string;
  type: CommentTargetType;
}

export function getCommentTargetKey(target: CommentTarget): string {
  return `${target.type}:${target.id}:${target.seriesTitle?.trim() ?? ''}`;
}

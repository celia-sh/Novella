import type { CommentTarget } from './comment-target.ts';
import { getCommentTargetKey } from './comment-target.ts';

/**
 * Cross-screen signals for comments changed in a compose sheet. Signals are
 * keyed by target so posting on one book or announcement cannot refresh an
 * unrelated comments surface.
 */

const pendingCommentsChanges = new Set<string>();

export function markCommentsChanged(target: CommentTarget): void {
  pendingCommentsChanges.add(getCommentTargetKey(target));
}

export function consumeCommentsChanged(target: CommentTarget): boolean {
  const key = getCommentTargetKey(target);
  const pending = pendingCommentsChanges.has(key);
  pendingCommentsChanges.delete(key);
  return pending;
}

/**
 * Cross-screen signal that a Community thread changed while its detail screen
 * was not focused (for example after posting a reply or saving an edit).
 *
 * The thread screen consumes this on focus: it only refreshes when a mutation
 * actually landed, so dismissing a composer without saving causes no refresh
 * and no re-render churn.
 */

let pendingThreadChange = false;

export function markCommunityThreadChanged(): void {
  pendingThreadChange = true;
}

export function consumeCommunityThreadChanged(): boolean {
  const pending = pendingThreadChange;
  pendingThreadChange = false;
  return pending;
}

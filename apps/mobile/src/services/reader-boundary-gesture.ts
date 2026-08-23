export type ReaderBoundaryAxis = 'horizontal' | 'vertical';
export type ReaderBoundaryChapterAction = 'next' | 'previous' | null;

export interface ReaderPagedBoundaryGestureOptions {
  deltaX: number;
  direction: 'ltr' | 'rtl';
  displayCount: number;
  displayIndex: number;
  threshold?: number;
}

export function resolveReaderPagedBoundaryChapterAction({
  deltaX,
  direction,
  displayCount,
  displayIndex,
  threshold = 24,
}: ReaderPagedBoundaryGestureOptions): ReaderBoundaryChapterAction {
  const count = Math.max(0, Math.trunc(displayCount));
  if (count === 0 || !Number.isFinite(deltaX)) return null;
  const index = Math.min(count - 1, Math.max(0, Math.trunc(displayIndex)));
  const distance = Math.max(0, threshold);
  if (Math.abs(deltaX) < distance) return null;

  // Aidoku keeps the physical gesture semantics stable: in RTL a
  // right-to-left swipe is the backward gesture, while left-to-right is
  // the forward gesture. deltaX is the finger's physical movement.
  const previousGesture = direction === 'rtl' ? deltaX < 0 : deltaX > 0;
  const nextGesture = direction === 'rtl' ? deltaX > 0 : deltaX < 0;
  if (previousGesture && index === 0) return 'previous';
  if (nextGesture && index === count - 1) return 'next';
  return null;
}

export interface ReaderBoundaryGestureOptions {
  axis: ReaderBoundaryAxis;
  contentExtent: number;
  offset: number;
  velocity: number;
  viewportExtent: number;
  threshold?: number;
  velocityThreshold?: number;
}

export function resolveReaderBoundaryChapterAction({
  axis,
  contentExtent,
  offset,
  velocity,
  viewportExtent,
  threshold = 24,
  velocityThreshold = 0.35,
}: ReaderBoundaryGestureOptions): ReaderBoundaryChapterAction {
  const safeContentExtent = positiveDimension(contentExtent, 1);
  const safeViewportExtent = positiveDimension(viewportExtent, 1);
  const maximumOffset = Math.max(0, safeContentExtent - safeViewportExtent);
  const safeOffset = Number.isFinite(offset) ? offset : 0;
  const safeVelocity = Number.isFinite(velocity) ? velocity : 0;
  const safeThreshold = Math.max(0, threshold);
  const safeVelocityThreshold = Math.max(0, velocityThreshold);

  if (maximumOffset <= safeThreshold) return null;
  if (safeOffset <= safeThreshold && safeVelocity < -safeVelocityThreshold) return 'previous';
  if (
    safeOffset >= maximumOffset - safeThreshold
    && safeVelocity > safeVelocityThreshold
  ) return 'next';
  return null;
}

export function resolveReaderBoundaryAxis(
  mode: 'paged' | 'scroll',
): ReaderBoundaryAxis {
  return mode === 'paged' ? 'horizontal' : 'vertical';
}

function positiveDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

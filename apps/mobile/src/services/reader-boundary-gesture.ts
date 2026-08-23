export type ReaderBoundaryAxis = 'horizontal' | 'vertical';
export type ReaderBoundaryChapterAction = 'next' | 'previous' | null;

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

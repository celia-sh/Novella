export interface DebouncedCommit<T> {
  dispose(): void;
  flush(): void;
  schedule(value: T): void;
}

export interface DebouncedCommitScheduler {
  clear(handle: ReturnType<typeof setTimeout>): void;
  set(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
}

const defaultScheduler: DebouncedCommitScheduler = {
  clear: (handle) => clearTimeout(handle),
  set: (callback, delayMs) => setTimeout(callback, delayMs),
};

/**
 * Keep high-frequency native input out of durable/stateful update paths.
 * `dispose` flushes the last value so closing a screen cannot lose input.
 */
export function createDebouncedCommit<T>(
  commit: (value: T) => void,
  delayMs: number,
  scheduler: DebouncedCommitScheduler = defaultScheduler,
): DebouncedCommit<T> {
  let disposed = false;
  let hasPendingValue = false;
  let pendingValue: T | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer === null) return;
    scheduler.clear(timer);
    timer = null;
  };

  const flush = () => {
    clearTimer();
    if (!hasPendingValue) return;

    const value = pendingValue as T;
    pendingValue = undefined;
    hasPendingValue = false;
    commit(value);
  };

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      flush();
    },
    flush,
    schedule(value) {
      if (disposed) return;
      pendingValue = value;
      hasPendingValue = true;
      clearTimer();
      timer = scheduler.set(flush, Math.max(0, delayMs));
    },
  };
}

export const CLIENT_STARTUP_TIMEOUT_MS = 12_000;

type TimerHandle = ReturnType<typeof setTimeout>;

type ClientStartupWatchdogOptions = {
  onTimeout: () => void;
  timeoutMs?: number;
  schedule?: (handler: () => void, timeoutMs: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
};

/**
 * Bounds the first application-module import. A resolved or rejected import
 * settles the watchdog; a stalled import reports a recoverable startup error.
 */
export function createClientStartupWatchdog({
  onTimeout,
  timeoutMs = CLIENT_STARTUP_TIMEOUT_MS,
  schedule = (handler, delay) => window.setTimeout(handler, delay),
  cancel = (handle) => window.clearTimeout(handle),
}: ClientStartupWatchdogOptions) {
  let settled = false;

  const handle = schedule(() => {
    if (settled) return;
    settled = true;
    onTimeout();
  }, timeoutMs);

  return {
    /** Returns true only for the first terminal startup outcome. */
    settle() {
      if (settled) return false;
      settled = true;
      cancel(handle);
      return true;
    },
  };
}

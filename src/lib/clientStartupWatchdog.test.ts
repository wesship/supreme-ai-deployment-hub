import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientStartupWatchdog } from './clientStartupWatchdog';

describe('createClientStartupWatchdog', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a stalled startup exactly once at the configured timeout', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const watchdog = createClientStartupWatchdog({ onTimeout, timeoutMs: 120 });

    vi.advanceTimersByTime(119);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(watchdog.settle()).toBe(false);
  });

  it('cancels the timeout when the application module resolves first', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const watchdog = createClientStartupWatchdog({ onTimeout, timeoutMs: 120 });

    expect(watchdog.settle()).toBe(true);
    vi.advanceTimersByTime(120);

    expect(onTimeout).not.toHaveBeenCalled();
    expect(watchdog.settle()).toBe(false);
  });
});

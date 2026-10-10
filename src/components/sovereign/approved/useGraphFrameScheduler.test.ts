import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useGraphFrameScheduler } from './useGraphFrameScheduler';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function clock() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  return {
    callbacks,
    advance(time: number) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach(callback => callback(time));
    },
  };
}

describe('Graph frame budget', () => {
  it('keeps animating while limiting draws to 30 per second', () => {
    const timer = clock();
    const invalidate = vi.fn();
    renderHook(() => useGraphFrameScheduler(invalidate, false));
    for (let time = 0; time <= 1000; time += 1000 / 60) timer.advance(time);
    expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(29);
    expect(invalidate.mock.calls.length).toBeLessThanOrEqual(30);
  });

  it('stops work in hidden tabs and resumes when visible', () => {
    const timer = clock();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const invalidate = vi.fn();
    renderHook(() => useGraphFrameScheduler(invalidate, false));
    timer.advance(34);
    expect(invalidate).toHaveBeenCalledTimes(1);
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(timer.callbacks.size).toBe(0);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    timer.advance(68);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('honors reduced motion and cancels scheduled work on unmount', () => {
    const timer = clock();
    const invalidate = vi.fn();
    const hook = renderHook(({ paused }) => useGraphFrameScheduler(invalidate, paused), { initialProps: { paused: true } });
    expect(timer.callbacks.size).toBe(0);
    hook.rerender({ paused: false });
    expect(timer.callbacks.size).toBe(1);
    hook.unmount();
    expect(timer.callbacks.size).toBe(0);
  });
});

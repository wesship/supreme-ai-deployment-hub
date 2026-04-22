/// <reference types="vitest/globals" />

// Provide a `jest` namespace alias for legacy tests using `jest.fn()` / `jest.Mock`.
// The runtime shim lives in src/test/setup.ts; this file only adds the types.
import type { Mock, MockInstance } from "vitest";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    type Mock<T = any, Y extends any[] = any[]> = import("vitest").Mock<Y, T>;
    type SpyInstance<T = any, Y extends any[] = any[]> = MockInstance<Y, T>;
  }

  // `jest` is also used as a value (jest.fn(), jest.mock()) — typed loosely.
  // eslint-disable-next-line no-var
  var jest: {
    fn: typeof import("vitest").vi.fn;
    mock: typeof import("vitest").vi.mock;
    spyOn: typeof import("vitest").vi.spyOn;
    clearAllMocks: typeof import("vitest").vi.clearAllMocks;
    resetAllMocks: typeof import("vitest").vi.resetAllMocks;
    restoreAllMocks: typeof import("vitest").vi.restoreAllMocks;
    useFakeTimers: typeof import("vitest").vi.useFakeTimers;
    useRealTimers: typeof import("vitest").vi.useRealTimers;
    advanceTimersByTime: typeof import("vitest").vi.advanceTimersByTime;
  };
}

export {};

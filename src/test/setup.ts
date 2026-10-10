import "@testing-library/jest-dom";
import { vi } from "vitest";

// Global mock for toast modules to prevent circular dependency issues
const mockToastFn = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  toast: mockToastFn,
  useToast: () => ({ toast: mockToastFn }),
}));

const sonnerToast = Object.assign(mockToastFn, {
  success: mockToastSuccess,
  error: mockToastError,
});

vi.mock('sonner', () => ({
  toast: sonnerToast,
}));

// Export for tests to access
(globalThis as any).__mockToast = mockToastFn;
(globalThis as any).__mockToastSuccess = mockToastSuccess;
(globalThis as any).__mockToastError = mockToastError;

// Jest compatibility globals
// Many existing tests use jest.fn() / jest.mock() — map them to vitest equivalents
(globalThis as any).jest = {
  fn: vi.fn,
  mock: vi.mock,
  spyOn: vi.spyOn,
  requireActual: vi.importActual,
  useFakeTimers: vi.useFakeTimers,
  useRealTimers: vi.useRealTimers,
  advanceTimersByTime: vi.advanceTimersByTime,
  runOnlyPendingTimers: vi.runOnlyPendingTimers,
  setSystemTime: vi.setSystemTime,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock chrome extension APIs
(globalThis as any).chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
  },
  storage: {
    local: {
      get: vi.fn((_keys: any, callback: any) => callback({})),
      set: vi.fn((_items: any, callback?: any) => callback?.()),
    },
    sync: {
      get: vi.fn((_keys: any, callback: any) => callback({})),
      set: vi.fn((_items: any, callback?: any) => callback?.()),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
};

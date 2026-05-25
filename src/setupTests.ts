
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock for window.matchMedia — only in jsdom/browser environments
// (node-environment tests such as staging-smoke.test.ts use @vitest-environment node
// and do not have a window object, so this guard prevents ReferenceError)
if (typeof window !== 'undefined') {
  // Mock ResizeObserver — not implemented in jsdom but used by ScrollArea and
  // other layout-aware components (e.g. radix-ui/react-scroll-area).
  // Must be a proper class constructor (not vi.fn()) because Radix UI calls
  // `new ResizeObserver(callback)` and checks instanceof.
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Silence console errors during tests
console.error = vi.fn();
console.warn = vi.fn();

// Global mock toast for tests that use globalThis.__mockToast
(globalThis as Record<string, unknown>).__mockToast = vi.fn();

// Global fetch mock — only in jsdom/browser environments.
// Node-environment tests (e.g. staging-smoke.test.ts) use the real Node.js
// fetch implementation to make HTTP requests to the mock server.
if (typeof window !== 'undefined') {
  global.fetch = vi.fn();
}

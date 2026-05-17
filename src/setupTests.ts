
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock for window.matchMedia
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

// Silence console errors during tests
console.error = vi.fn();
console.warn = vi.fn();

// Global mock toast for tests that use globalThis.__mockToast
(globalThis as Record<string, unknown>).__mockToast = vi.fn();

// Global fetch mock
global.fetch = vi.fn();

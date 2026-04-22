import "vitest";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  interface Assertion<T = any> extends TestingLibraryMatchers<typeof expect.stringContaining, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, any> {}
}

// Some legacy tests pull `expect` from the jest namespace.
declare global {
  namespace jest {
    interface Matchers<R> extends TestingLibraryMatchers<unknown, R> {}
  }
}

export {};

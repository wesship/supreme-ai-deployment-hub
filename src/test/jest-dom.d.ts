// Ambient extension of jest.Matchers with @testing-library/jest-dom matchers.
// jest-dom v5 does not ship a vitest/standalone matchers .d.ts, so declare the
// subset used in this project.

declare namespace jest {
  interface Matchers<R, T = any> {
    toBeInTheDocument(): R;
    toBeVisible(): R;
    toBeEmpty(): R;
    toBeEmptyDOMElement(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toBeInvalid(): R;
    toBeRequired(): R;
    toBeValid(): R;
    toBeChecked(): R;
    toBePartiallyChecked(): R;
    toContainElement(element: HTMLElement | SVGElement | null): R;
    toContainHTML(html: string): R;
    toHaveAccessibleDescription(text?: string | RegExp): R;
    toHaveAccessibleName(text?: string | RegExp): R;
    toHaveAttribute(attr: string, value?: unknown): R;
    toHaveClass(...classNames: string[]): R;
    toHaveFocus(): R;
    toHaveFormValues(values: Record<string, unknown>): R;
    toHaveStyle(css: string | Record<string, unknown>): R;
    toHaveTextContent(text?: string | RegExp, options?: { normalizeWhitespace: boolean }): R;
    toHaveValue(value?: string | string[] | number | null): R;
    toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
    toBeInTheDOM(): R;
  }
}

// Mirror onto vitest's expect for tests that resolve via vitest globals.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
declare module "vitest" {
  interface Assertion<T = any> extends jest.Matchers<void, T> {}
  interface AsymmetricMatchersContaining extends jest.Matchers<void, any> {}
}

export {};

// Ambient extension of jest.Matchers with @testing-library/jest-dom matchers.
// Must remain a script file (no top-level import/export) so the
// `declare namespace jest` augments the global namespace from @types/jest.

declare namespace jest {
  interface Matchers<R, T = {}> {
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

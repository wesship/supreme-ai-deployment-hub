
// This file extends the @testing-library/jest-dom types

import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveValue(value: string | number | RegExp): R;
      toBeDisabled(): R;
      toHaveClass(className: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toBeVisible(): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toBeInvalid(): R;
      toHaveStyle(css: string | Record<string, any>): R;
      toHaveFocus(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(htmlText: string): R;
      toHaveDescription(text: string): R;
      toHaveTextContent(text?: string | RegExp, options?: { normalizeWhitespace: boolean }): R;
      toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;
      toBeEnabled(): R;
      toBeEmpty(): R;
      toBeEmptyDOMElement(): R;
      toHaveFormValues(values: Record<string, any>): R;
      toHaveAccessibleName(text?: string | RegExp): R;
      toHaveAccessibleDescription(text?: string | RegExp): R;
    }
  }
}

// Empty export to make this file a module
export {};

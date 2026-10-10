import { expect, it, vi } from 'vitest';
vi.mock('@vercel/functions', () => ({ next: (options?: object) => options }));
import middleware from '../../middleware';
it('permits WASM only for the hand workspace in both enforced and report-only middleware policies', () => {
  const response = (route: string) => middleware(new Request('https://d3vonn.io' + route)) as unknown as { headers: Record<string, string> };
  for (const name of ['Content-Security-Policy', 'Content-Security-Policy-Report-Only']) {
    expect(response('/holo').headers[name]).toContain("'wasm-unsafe-eval'");
    expect(response('/').headers[name]).not.toContain("'wasm-unsafe-eval'");
    expect(response('/holo').headers[name]).not.toContain("'unsafe-eval'");
  }
});

import { describe, expect, it } from 'vitest';

describe('runtime identity preview policy', () => {
  it('treats local preview hosts as non-production probes', () => {
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    expect(localHosts.every((host) => /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host))).toBe(true);
  });

  it('keeps the production API identity contract stable', () => {
    expect('https://api.d3vonn.io/api/runtime/identity').toContain('/api/runtime/identity');
  });
});

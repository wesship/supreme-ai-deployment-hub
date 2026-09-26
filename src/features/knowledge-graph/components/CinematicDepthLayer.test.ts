import { describe, expect, it } from 'vitest';

describe('cinematic depth layer contract', () => {
  it('keeps WebGL presentation non-interactive and state-driven', async () => {
    const source = await import('./CinematicDepthLayer?raw');
    expect(source.default).toContain('pointer-events');
    expect(source.default).toContain('runtimeState');
    expect(source.default).toContain('prefers-reduced-motion');
    expect(source.default).toContain("getContext('webgl'");
  });
});

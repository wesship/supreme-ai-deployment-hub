import { describe, expect, it } from 'vitest';
import { depthVisualConfig } from './CinematicDepthLayer';

describe('cinematic depth layer state', () => {
  it('intensifies active graph regions without changing the interaction layer', () => {
    expect(depthVisualConfig('running', true, false)).toEqual({
      tint: [1.0, 0.9, 0.64],
      intensity: 1,
      corridor: 0,
    });
  });

  it('raises the corridor channel only for multi-cluster focus', () => {
    expect(depthVisualConfig('idle', false, true)).toMatchObject({
      intensity: 0.42,
      corridor: 1,
    });
  });

  it('uses distinct terminal-state tinting', () => {
    expect(depthVisualConfig('complete', true, false).tint).not.toEqual(
      depthVisualConfig('failed', true, false).tint,
    );
  });
});

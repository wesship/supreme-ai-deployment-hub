import { describe, expect, it } from 'vitest';
import { deriveNexusVisualCapability } from './visualCapability';

describe('deriveNexusVisualCapability', () => {
  it('uses a static visual path for reduced motion', () => {
    expect(deriveNexusVisualCapability({
      reducedMotion: true,
      viewportWidth: 1440,
      hardwareConcurrency: 12,
    })).toEqual({
      mode: 'static',
      maxFps: 0,
      dprCap: 1,
      parallax: false,
    });
  });

  it('caps mobile and low-power devices at the reduced profile', () => {
    expect(deriveNexusVisualCapability({
      reducedMotion: false,
      viewportWidth: 390,
      hardwareConcurrency: 8,
    }).mode).toBe('reduced');

    expect(deriveNexusVisualCapability({
      reducedMotion: false,
      viewportWidth: 1440,
      hardwareConcurrency: 4,
    }).maxFps).toBe(30);
  });

  it('honors data saver and preserves the full desktop profile otherwise', () => {
    expect(deriveNexusVisualCapability({
      reducedMotion: false,
      viewportWidth: 1280,
      hardwareConcurrency: 8,
      saveData: true,
    }).parallax).toBe(false);

    expect(deriveNexusVisualCapability({
      reducedMotion: false,
      viewportWidth: 1440,
      hardwareConcurrency: 12,
      saveData: false,
    })).toEqual({
      mode: 'full',
      maxFps: 60,
      dprCap: 1.5,
      parallax: true,
    });
  });
});

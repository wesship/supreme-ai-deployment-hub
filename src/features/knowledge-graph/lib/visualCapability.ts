export type NexusVisualMode = 'full' | 'reduced' | 'static';

export type NexusVisualCapabilityInput = {
  reducedMotion: boolean;
  viewportWidth: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
};

export type NexusVisualCapability = {
  mode: NexusVisualMode;
  maxFps: number;
  dprCap: number;
  parallax: boolean;
};

export function deriveNexusVisualCapability(
  input: NexusVisualCapabilityInput,
): NexusVisualCapability {
  if (input.reducedMotion) {
    return {
      mode: 'static',
      maxFps: 0,
      dprCap: 1,
      parallax: false,
    };
  }

  const mobile = input.viewportWidth < 768;
  const lowCore =
    typeof input.hardwareConcurrency === 'number' &&
    input.hardwareConcurrency > 0 &&
    input.hardwareConcurrency <= 4;
  const constrained = mobile || lowCore || Boolean(input.saveData);

  if (constrained) {
    return {
      mode: 'reduced',
      maxFps: 30,
      dprCap: 1,
      parallax: false,
    };
  }

  return {
    mode: 'full',
    maxFps: 60,
    dprCap: 1.5,
    parallax: true,
  };
}

import { describe, expect, it } from 'vitest';
import { deriveOverlayEmphasis } from './overlayEmphasis';

describe('deriveOverlayEmphasis', () => {
  it('lights execution and system panels during a live path', () => {
    const result = deriveOverlayEmphasis({
      selectedNodeId: 'hermes',
      executionPath: ['intent', 'hermes', 'workflow'],
      hasLiveEvents: true,
      hasCostTelemetry: false,
      hasAgentTelemetry: false,
      hasInfrastructureTelemetry: false,
      corridorNodeIds: [],
    });

    expect(result.has('system')).toBe(true);
    expect(result.has('execution')).toBe(true);
    expect(result.has('activity')).toBe(true);
  });

  it('lights domain-specific panels from selection and telemetry', () => {
    const agents = deriveOverlayEmphasis({
      selectedNodeId: 'agents',
      executionPath: [],
      hasLiveEvents: false,
      hasCostTelemetry: true,
      hasAgentTelemetry: false,
      hasInfrastructureTelemetry: false,
      corridorNodeIds: [],
    });
    expect(agents.has('agents')).toBe(true);
    expect(agents.has('cost')).toBe(true);

    const infra = deriveOverlayEmphasis({
      selectedNodeId: 'tools',
      executionPath: [],
      hasLiveEvents: false,
      hasCostTelemetry: false,
      hasAgentTelemetry: false,
      hasInfrastructureTelemetry: false,
      corridorNodeIds: [],
    });
    expect(infra.has('infrastructure')).toBe(true);
  });

  it('elevates panels touched by a multi-cluster corridor', () => {
    const result = deriveOverlayEmphasis({
      selectedNodeId: 'films',
      executionPath: [],
      hasLiveEvents: false,
      hasCostTelemetry: false,
      hasAgentTelemetry: false,
      hasInfrastructureTelemetry: false,
      corridorNodeIds: ['films', 'workflow', 'agents', 'tools'],
    });

    expect(result.has('system')).toBe(true);
    expect(result.has('execution')).toBe(true);
    expect(result.has('agents')).toBe(true);
    expect(result.has('infrastructure')).toBe(true);
  });
});

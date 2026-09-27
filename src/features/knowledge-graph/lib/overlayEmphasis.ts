export type OverlayPanelKey =
  | 'system'
  | 'activity'
  | 'execution'
  | 'agents'
  | 'infrastructure'
  | 'cost';

export type OverlayEmphasisInput = {
  selectedNodeId: string;
  executionPath: string[];
  hasLiveEvents: boolean;
  hasCostTelemetry: boolean;
  hasAgentTelemetry: boolean;
  hasInfrastructureTelemetry: boolean;
  corridorNodeIds: string[];
};

export function deriveOverlayEmphasis(input: OverlayEmphasisInput): Set<OverlayPanelKey> {
  const active = new Set<OverlayPanelKey>();

  if (input.executionPath.length) {
    active.add('system');
    active.add('execution');
  }

  if (input.hasLiveEvents) active.add('activity');
  if (input.hasCostTelemetry) active.add('cost');
  if (input.hasAgentTelemetry || input.selectedNodeId === 'agents') active.add('agents');

  if (
    input.hasInfrastructureTelemetry ||
    ['tools', 'security', 'analytics'].includes(input.selectedNodeId)
  ) {
    active.add('infrastructure');
  }

  if (input.corridorNodeIds.includes('agents')) active.add('agents');
  if (input.corridorNodeIds.some((id) => ['tools', 'security', 'analytics'].includes(id))) {
    active.add('infrastructure');
  }
  if (input.corridorNodeIds.length) {
    active.add('system');
    active.add('execution');
  }

  return active;
}

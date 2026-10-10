export type NexusTransitionPhase = 'idle' | 'ignite' | 'route' | 'focus';

export const NEXUS_TRANSITION_TIMING = {
  routeMs: 140,
  focusMs: 420,
} as const;

export function deriveNexusTransitionKey(
  focusNodeIds: string[],
  runtimeState: string,
  corridorActive: boolean,
): string {
  if (!focusNodeIds.length && runtimeState === 'idle' && !corridorActive) return 'idle';
  return [
    corridorActive ? 'corridor' : 'single',
    runtimeState,
    focusNodeIds.join('>') || 'hermes',
  ].join(':');
}

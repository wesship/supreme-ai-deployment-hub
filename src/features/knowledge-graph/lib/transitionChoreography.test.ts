import { describe, expect, it } from 'vitest';
import {
  deriveNexusTransitionKey,
  NEXUS_TRANSITION_TIMING,
} from './transitionChoreography';

describe('Nexus transition choreography', () => {
  it('returns a stable idle key without graph focus', () => {
    expect(deriveNexusTransitionKey([], 'idle', false)).toBe('idle');
  });

  it('changes keys when the operational focus changes', () => {
    const hermes = deriveNexusTransitionKey(['hermes'], 'running', false);
    const films = deriveNexusTransitionKey(['hermes', 'workflow', 'films'], 'running', false);
    const corridor = deriveNexusTransitionKey(['knowledge', 'workflow', 'films'], 'running', true);

    expect(hermes).not.toBe(films);
    expect(films).not.toBe(corridor);
  });

  it('keeps route before focus in the cinematic sequence', () => {
    expect(NEXUS_TRANSITION_TIMING.routeMs).toBeGreaterThan(0);
    expect(NEXUS_TRANSITION_TIMING.focusMs).toBeGreaterThan(
      NEXUS_TRANSITION_TIMING.routeMs,
    );
  });
});

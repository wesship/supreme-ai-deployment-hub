import { describe, expect, it } from 'vitest';
import { normalizeAgentsResponse } from '../normalizeAgents';

describe('normalizeAgentsResponse', () => {
  it('accepts the current agent-mesh array response', () => {
    const result = normalizeAgentsResponse([
      {
        name: 'Hermes',
        status: 'idle',
        capabilities: ['orchestration'],
      },
    ]);

    expect(result.agents).toEqual([
      expect.objectContaining({
        id: 'Hermes',
        name: 'Hermes',
        desc: 'Hermes is idle',
        type: 'custom',
        capabilities: ['orchestration'],
      }),
    ]);
  });

  it('accepts the legacy wrapped response', () => {
    const result = normalizeAgentsResponse({
      agents: [
        {
          id: 'atlas-1',
          name: 'Atlas',
          desc: 'Research agent',
          type: 'researcher',
        },
      ],
    });

    expect(result.agents[0]).toMatchObject({
      id: 'atlas-1',
      name: 'Atlas',
      desc: 'Research agent',
      type: 'researcher',
    });
  });

  it('rejects unsupported response shapes', () => {
    expect(() => normalizeAgentsResponse({ data: [] })).toThrow(
      'Agent API returned an unsupported response shape',
    );
  });
});

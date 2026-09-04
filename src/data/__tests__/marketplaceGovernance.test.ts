import { describe, expect, it } from 'vitest';
import { assessCompatibility, getAgentVerification } from '@/data/marketplaceGovernance';
import type { AgentTemplate } from '@/types/marketplace';

const baseAgent: AgentTemplate = {
  id: 'agent-1',
  name: 'Test Agent',
  slug: 'test-agent',
  description: 'test',
  category: 'automation',
  capabilities: ['monitoring'],
  pricing: { model: 'free' },
  author: { id: 'd3vonn', name: 'D3VONN.IO', verified: true, agentCount: 1 },
  status: 'published',
  version: '1.0.0',
  tags: [],
  stats: { downloads: 0, activeInstalls: 0, avgRating: 0, reviewCount: 0, lastUpdated: '2026-09-04' },
  createdAt: '2026-09-04',
  updatedAt: '2026-09-04',
};

describe('marketplace governance', () => {
  it('does not fabricate verification for agents without evidence', () => {
    const verification = getAgentVerification(baseAgent);
    expect(verification.level).toBe('unverified');
    expect(verification.score).toBe(0);
    expect(verification.permissionsReviewed).toBe(false);
    expect(verification.dataHandlingReviewed).toBe(false);
  });

  it('fails closed when a required dependency has not been proven healthy', () => {
    const agent: AgentTemplate = {
      ...baseAgent,
      manifest: {
        schemaVersion: '1.0',
        publisher: 'D3VONN.IO',
        capabilities: ['monitoring'],
        permissions: [],
        dependencies: [{ id: 'dep-1', name: 'Required API', required: true }],
        integrations: [],
        dataRequirements: [],
        updatePolicy: 'approval-required',
        rollbackSupported: false,
      },
    };
    expect(assessCompatibility(agent).compatible).toBe(false);
  });

  it('reports elevated permissions as warnings without granting authority', () => {
    const agent: AgentTemplate = {
      ...baseAgent,
      manifest: {
        schemaVersion: '1.0',
        publisher: 'D3VONN.IO',
        capabilities: ['remediation'],
        permissions: [{ key: 'system.write', label: 'Write system state', description: 'test', risk: 'critical', required: true }],
        dependencies: [],
        integrations: [],
        dataRequirements: [],
        updatePolicy: 'approval-required',
        rollbackSupported: false,
      },
    };
    expect(assessCompatibility(agent).warnings).toContain('Elevated permission: Write system state');
  });
});

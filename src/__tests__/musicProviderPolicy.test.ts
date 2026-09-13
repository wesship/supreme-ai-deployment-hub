import { describe, expect, it } from 'vitest';

import { createProviderPolicySnapshot, evaluateProviderPolicy } from '../music/providerPolicy';

const pendingProvider = {
  id: 'ace-step-1.5',
  source_revision: 'UNPINNED',
  model_revision: 'UNPINNED',
  weights_sha256: 'UNPINNED',
  hosted_allowed: false,
  commercial_generation_allowed: false,
  commercial_output_allowed: false,
  enabled: false,
  provenance_required: true,
  approval: { status: 'pending' as const, reviewer: null, reviewed_at: null },
};

describe('music provider policy', () => {
  it('blocks an unqualified provider', () => {
    const result = evaluateProviderPolicy(pendingProvider);
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain('source_revision_unpinned');
    expect(result.reasons).toContain('provider_disabled');
  });

  it('allows a fully qualified and explicitly enabled provider', () => {
    const result = evaluateProviderPolicy({
      ...pendingProvider,
      source_revision: '0123456789abcdef',
      model_revision: 'fedcba9876543210',
      weights_sha256: 'abc123',
      hosted_allowed: true,
      commercial_generation_allowed: true,
      commercial_output_allowed: true,
      enabled: true,
      approval: {
        status: 'approved',
        reviewer: 'music-provider-reviewer',
        reviewed_at: '2026-09-13T00:00:00Z',
      },
    });
    expect(result).toEqual({ allowed: true, reasons: [] });
  });

  it('captures an immutable per-job policy snapshot', () => {
    const snapshot = createProviderPolicySnapshot(pendingProvider);
    expect(snapshot.provider_id).toBe('ace-step-1.5');
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});

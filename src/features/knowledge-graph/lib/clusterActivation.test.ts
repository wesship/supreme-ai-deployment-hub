import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { deriveClusterActivation } from './clusterActivation';

const edges: Edge[] = [
  { id: 'hermes-knowledge', source: 'hermes', target: 'knowledge' },
  { id: 'knowledge-workflow', source: 'knowledge', target: 'workflow' },
  { id: 'workflow-films', source: 'workflow', target: 'films' },
];

const major = new Set(['knowledge', 'films']);

describe('deriveClusterActivation', () => {
  it('prefers the latest executing major node over selection', () => {
    const result = deriveClusterActivation(
      'films',
      ['intent', 'hermes', 'knowledge'],
      edges,
      major,
    );

    expect(result.primaryNodeId).toBe('knowledge');
    expect([...result.sympatheticNodeIds]).toEqual(
      expect.arrayContaining(['hermes', 'workflow']),
    );
    expect([...result.clusterEdgeIds]).toEqual(
      expect.arrayContaining(['hermes-knowledge', 'knowledge-workflow']),
    );
  });

  it('uses the selected major node when no major node is executing', () => {
    const result = deriveClusterActivation('films', ['intent', 'hermes'], edges, major);

    expect(result.primaryNodeId).toBe('films');
    expect([...result.sympatheticNodeIds]).toEqual(['workflow']);
    expect([...result.clusterEdgeIds]).toEqual(['workflow-films']);
  });

  it('returns no activation for a non-major selection without an executing cluster', () => {
    const result = deriveClusterActivation('hermes', ['intent', 'hermes'], edges, major);

    expect(result.primaryNodeId).toBeNull();
    expect(result.sympatheticNodeIds.size).toBe(0);
    expect(result.clusterEdgeIds.size).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { deriveMultiClusterCorridor } from './multiClusterCorridor';

const edges: Edge[] = [
  { id: 'hermes-knowledge', source: 'hermes', target: 'knowledge' },
  { id: 'knowledge-workflow', source: 'knowledge', target: 'workflow' },
  { id: 'workflow-films', source: 'workflow', target: 'films' },
  { id: 'hermes-tools', source: 'hermes', target: 'tools' },
  { id: 'tools-security', source: 'tools', target: 'security' },
];

describe('deriveMultiClusterCorridor', () => {
  it('finds the shortest corridor between two clusters', () => {
    const result = deriveMultiClusterCorridor('knowledge', 'films', edges);

    expect(result).toEqual({
      sourceNodeId: 'knowledge',
      targetNodeId: 'films',
      nodeIds: ['knowledge', 'workflow', 'films'],
      edgeIds: ['knowledge-workflow', 'workflow-films'],
    });
  });

  it('returns null for a missing or identical target', () => {
    expect(deriveMultiClusterCorridor('films', 'films', edges)).toBeNull();
    expect(deriveMultiClusterCorridor('films', null, edges)).toBeNull();
  });

  it('returns null when no corridor exists', () => {
    expect(
      deriveMultiClusterCorridor('knowledge', 'isolated', edges),
    ).toBeNull();
  });
});

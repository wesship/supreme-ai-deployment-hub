import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { deriveSelectiveFocus } from './selectiveFocus';

const nodes = ['intent', 'hermes', 'agents', 'workflow', 'films', 'tools'];
const edges: Edge[] = [
  { id: 'intent-hermes', source: 'intent', target: 'hermes' },
  { id: 'hermes-agents', source: 'hermes', target: 'agents' },
  { id: 'agents-workflow', source: 'agents', target: 'workflow' },
  { id: 'workflow-films', source: 'workflow', target: 'films' },
  { id: 'hermes-tools', source: 'hermes', target: 'tools' },
];

describe('deriveSelectiveFocus', () => {
  it('keeps the active execution path crisp and softens unrelated nodes', () => {
    const result = deriveSelectiveFocus(nodes, edges, {
      selectedId: 'films',
      executionNodeIds: ['intent', 'hermes', 'agents', 'workflow', 'films'],
      corridorNodeIds: [],
      clusterPrimaryId: 'films',
      sympatheticNodeIds: ['workflow'],
    });

    expect(result.active).toBe(true);
    expect(result.crispNodeIds.has('films')).toBe(true);
    expect(result.crispNodeIds.has('hermes')).toBe(true);
    expect(result.defocusedNodeIds.has('tools')).toBe(true);
    expect(result.defocusedEdgeIds.has('hermes-tools')).toBe(true);
  });

  it('keeps every corridor node crisp', () => {
    const result = deriveSelectiveFocus(nodes, edges, {
      selectedId: 'films',
      executionNodeIds: [],
      corridorNodeIds: ['films', 'workflow', 'agents'],
      clusterPrimaryId: null,
      sympatheticNodeIds: [],
    });

    expect(result.crispNodeIds.has('agents')).toBe(true);
    expect(result.crispNodeIds.has('workflow')).toBe(true);
    expect(result.crispNodeIds.has('hermes')).toBe(true);
  });

  it('does not defocus the graph without an active focus state', () => {
    const result = deriveSelectiveFocus(nodes, edges, {
      selectedId: 'hermes',
      executionNodeIds: [],
      corridorNodeIds: [],
      clusterPrimaryId: null,
      sympatheticNodeIds: [],
    });

    expect(result.active).toBe(false);
    expect(result.defocusedNodeIds.size).toBe(0);
    expect(result.defocusedEdgeIds.size).toBe(0);
  });
});

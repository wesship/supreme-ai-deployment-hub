import type { Edge } from '@xyflow/react';

export type ClusterActivation = {
  primaryNodeId: string | null;
  sympatheticNodeIds: Set<string>;
  clusterEdgeIds: Set<string>;
};

export function deriveClusterActivation(
  selectedId: string,
  executionPath: string[],
  edges: Edge[],
  majorNodeIds: ReadonlySet<string>,
): ClusterActivation {
  const executingNode = [...executionPath].reverse().find((id) => majorNodeIds.has(id));
  const primaryNodeId = executingNode ?? (majorNodeIds.has(selectedId) ? selectedId : null);

  const sympatheticNodeIds = new Set<string>();
  const clusterEdgeIds = new Set<string>();

  if (!primaryNodeId) {
    return { primaryNodeId: null, sympatheticNodeIds, clusterEdgeIds };
  }

  for (const edge of edges) {
    if (edge.source === primaryNodeId) {
      sympatheticNodeIds.add(edge.target);
      clusterEdgeIds.add(edge.id);
    } else if (edge.target === primaryNodeId) {
      sympatheticNodeIds.add(edge.source);
      clusterEdgeIds.add(edge.id);
    }
  }

  sympatheticNodeIds.delete(primaryNodeId);
  return { primaryNodeId, sympatheticNodeIds, clusterEdgeIds };
}

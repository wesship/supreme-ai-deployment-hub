import type { Edge } from '@xyflow/react';

export type MultiClusterCorridor = {
  sourceNodeId: string;
  targetNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
};

type Neighbor = { nodeId: string; edgeId: string };

function adjacency(edges: Edge[]): Map<string, Neighbor[]> {
  const graph = new Map<string, Neighbor[]>();
  const push = (from: string, to: string, edgeId: string) => {
    const list = graph.get(from) ?? [];
    list.push({ nodeId: to, edgeId });
    graph.set(from, list);
  };

  for (const edge of edges) {
    push(edge.source, edge.target, edge.id);
    push(edge.target, edge.source, edge.id);
  }
  return graph;
}

export function deriveMultiClusterCorridor(
  sourceNodeId: string | null,
  targetNodeId: string | null,
  edges: Edge[],
): MultiClusterCorridor | null {
  if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return null;

  const graph = adjacency(edges);
  const queue: Array<{ nodeId: string; nodeIds: string[]; edgeIds: string[] }> = [
    { nodeId: sourceNodeId, nodeIds: [sourceNodeId], edgeIds: [] },
  ];
  const visited = new Set([sourceNodeId]);

  while (queue.length) {
    const current = queue.shift()!;
    for (const neighbor of graph.get(current.nodeId) ?? []) {
      if (visited.has(neighbor.nodeId)) continue;
      const nodeIds = [...current.nodeIds, neighbor.nodeId];
      const edgeIds = [...current.edgeIds, neighbor.edgeId];
      if (neighbor.nodeId === targetNodeId) {
        return { sourceNodeId, targetNodeId, nodeIds, edgeIds };
      }
      visited.add(neighbor.nodeId);
      queue.push({ nodeId: neighbor.nodeId, nodeIds, edgeIds });
    }
  }

  return null;
}

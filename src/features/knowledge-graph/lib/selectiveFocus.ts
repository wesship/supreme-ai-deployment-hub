import type { Edge } from '@xyflow/react';

export type SelectiveFocusState = {
  active: boolean;
  crispNodeIds: Set<string>;
  defocusedNodeIds: Set<string>;
  defocusedEdgeIds: Set<string>;
};

export function deriveSelectiveFocus(
  allNodeIds: string[],
  edges: Edge[],
  options: {
    selectedId: string;
    executionNodeIds: Iterable<string>;
    corridorNodeIds: Iterable<string>;
    clusterPrimaryId: string | null;
    sympatheticNodeIds: Iterable<string>;
  },
): SelectiveFocusState {
  const execution = new Set(options.executionNodeIds);
  const corridor = new Set(options.corridorNodeIds);
  const sympathetic = new Set(options.sympatheticNodeIds);

  const active =
    execution.size > 0 ||
    corridor.size > 0 ||
    Boolean(options.clusterPrimaryId);

  const crispNodeIds = new Set<string>();
  crispNodeIds.add(options.selectedId);

  if (active) {
    crispNodeIds.add('hermes');
    execution.forEach((id) => crispNodeIds.add(id));
    corridor.forEach((id) => crispNodeIds.add(id));
    sympathetic.forEach((id) => crispNodeIds.add(id));
    if (options.clusterPrimaryId) crispNodeIds.add(options.clusterPrimaryId);
  }

  const defocusedNodeIds = new Set(
    active ? allNodeIds.filter((id) => !crispNodeIds.has(id)) : [],
  );

  const defocusedEdgeIds = new Set<string>();
  if (active) {
    for (const edge of edges) {
      if (
        defocusedNodeIds.has(edge.source) ||
        defocusedNodeIds.has(edge.target)
      ) {
        defocusedEdgeIds.add(edge.id);
      }
    }
  }

  return {
    active,
    crispNodeIds,
    defocusedNodeIds,
    defocusedEdgeIds,
  };
}

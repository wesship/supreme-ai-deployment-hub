/**
 * D3VONN Platform Knowledge Graph Engine
 * 
 * In-memory graph engine that loads the platform seed data and provides
 * query capabilities for Hermes reasoning. Supports traversal, filtering,
 * path-finding, and impact analysis.
 * 
 * @module knowledge/graph/engine
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type NodeType =
  | "Agent"
  | "Route"
  | "Workflow"
  | "Integration"
  | "SecurityPolicy"
  | "KnowledgeModule"
  | "Event"
  | "Pillar"
  | "RBACRole";

export type EdgeType =
  | "SERVES"
  | "BELONGS_TO"
  | "ORCHESTRATES"
  | "DELEGATES_TO"
  | "USES_INTEGRATION"
  | "ENFORCES"
  | "QUERIES"
  | "PUBLISHES"
  | "SUBSCRIBES_TO"
  | "HAS_TOOL"
  | "REQUIRES_ROLE"
  | "PART_OF";

export interface GraphNode {
  id: string;
  type: NodeType;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  properties: Record<string, unknown>;
}

export interface TraversalResult {
  path: string[];
  depth: number;
  edges: GraphEdge[];
}

export interface QueryFilter {
  nodeType?: NodeType;
  properties?: Record<string, unknown>;
  edgeType?: EdgeType;
  direction?: "outgoing" | "incoming" | "both";
}

export interface ImpactAnalysis {
  node: string;
  directDependents: string[];
  transitiveDependents: string[];
  affectedRoutes: string[];
  affectedWorkflows: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

// ─────────────────────────────────────────────────────────────────
// Knowledge Graph Engine
// ─────────────────────────────────────────────────────────────────

export class PlatformKnowledgeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacencyOut: Map<string, Set<string>> = new Map();
  private adjacencyIn: Map<string, Set<string>> = new Map();
  private edgeIndex: Map<string, string[]> = new Map();
  private edgeCounter = 0;

  // ── Node Operations ────────────────────────────────────────────

  addNode(id: string, type: NodeType, properties: Record<string, unknown> = {}): void {
    this.nodes.set(id, { id, type, properties });
    if (!this.adjacencyOut.has(id)) this.adjacencyOut.set(id, new Set());
    if (!this.adjacencyIn.has(id)) this.adjacencyIn.set(id, new Set());
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getNodesByType(type: NodeType): GraphNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.type === type);
  }

  // ── Edge Operations ────────────────────────────────────────────

  addEdge(type: EdgeType, from: string, to: string, properties: Record<string, unknown> = {}): string {
    const id = `e_${++this.edgeCounter}`;
    this.edges.set(id, { id, type, from, to, properties });

    if (!this.adjacencyOut.has(from)) this.adjacencyOut.set(from, new Set());
    if (!this.adjacencyIn.has(to)) this.adjacencyIn.set(to, new Set());
    this.adjacencyOut.get(from)!.add(id);
    this.adjacencyIn.get(to)!.add(id);

    const typeKey = `type:${type}`;
    if (!this.edgeIndex.has(typeKey)) this.edgeIndex.set(typeKey, []);
    this.edgeIndex.get(typeKey)!.push(id);

    return id;
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  getEdgesByType(type: EdgeType): GraphEdge[] {
    const ids = this.edgeIndex.get(`type:${type}`) || [];
    return ids.map((id) => this.edges.get(id)!).filter(Boolean);
  }

  // ── Query Operations ───────────────────────────────────────────

  /**
   * Find all neighbors of a node, optionally filtered by edge type and direction.
   */
  neighbors(nodeId: string, filter?: QueryFilter): GraphNode[] {
    const results: Set<string> = new Set();
    const direction = filter?.direction || "both";

    if (direction === "outgoing" || direction === "both") {
      const outEdges = this.adjacencyOut.get(nodeId) || new Set();
      for (const edgeId of outEdges) {
        const edge = this.edges.get(edgeId)!;
        if (!filter?.edgeType || edge.type === filter.edgeType) {
          results.add(edge.to);
        }
      }
    }

    if (direction === "incoming" || direction === "both") {
      const inEdges = this.adjacencyIn.get(nodeId) || new Set();
      for (const edgeId of inEdges) {
        const edge = this.edges.get(edgeId)!;
        if (!filter?.edgeType || edge.type === filter.edgeType) {
          results.add(edge.from);
        }
      }
    }

    let nodes = Array.from(results)
      .map((id) => this.nodes.get(id))
      .filter(Boolean) as GraphNode[];

    if (filter?.nodeType) {
      nodes = nodes.filter((n) => n.type === filter.nodeType);
    }

    return nodes;
  }

  /**
   * Breadth-first traversal from a starting node.
   */
  traverse(startId: string, maxDepth: number = 3, filter?: QueryFilter): TraversalResult[] {
    const results: TraversalResult[] = [];
    const visited: Set<string> = new Set([startId]);
    const queue: Array<{ nodeId: string; path: string[]; edges: GraphEdge[]; depth: number }> = [
      { nodeId: startId, path: [startId], edges: [], depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      const outEdges = this.adjacencyOut.get(current.nodeId) || new Set();
      for (const edgeId of outEdges) {
        const edge = this.edges.get(edgeId)!;
        if (filter?.edgeType && edge.type !== filter.edgeType) continue;
        if (visited.has(edge.to)) continue;

        visited.add(edge.to);
        const newPath = [...current.path, edge.to];
        const newEdges = [...current.edges, edge];
        results.push({ path: newPath, depth: current.depth + 1, edges: newEdges });
        queue.push({ nodeId: edge.to, path: newPath, edges: newEdges, depth: current.depth + 1 });
      }
    }

    return results;
  }

  /**
   * Find shortest path between two nodes using BFS.
   */
  shortestPath(fromId: string, toId: string): string[] | null {
    if (fromId === toId) return [fromId];

    const visited: Set<string> = new Set([fromId]);
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: fromId, path: [fromId] }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const outEdges = this.adjacencyOut.get(current.nodeId) || new Set();

      for (const edgeId of outEdges) {
        const edge = this.edges.get(edgeId)!;
        if (visited.has(edge.to)) continue;

        const newPath = [...current.path, edge.to];
        if (edge.to === toId) return newPath;

        visited.add(edge.to);
        queue.push({ nodeId: edge.to, path: newPath });
      }
    }

    return null;
  }

  /**
   * Analyze the impact of removing or modifying a node.
   */
  impactAnalysis(nodeId: string): ImpactAnalysis {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    const directDependents: string[] = [];
    const inEdges = this.adjacencyIn.get(nodeId) || new Set();
    for (const edgeId of inEdges) {
      const edge = this.edges.get(edgeId)!;
      directDependents.push(edge.from);
    }

    // Transitive dependents via BFS on incoming edges
    const transitiveDependents: Set<string> = new Set();
    const queue = [...directDependents];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (transitiveDependents.has(current)) continue;
      transitiveDependents.add(current);
      const currentInEdges = this.adjacencyIn.get(current) || new Set();
      for (const edgeId of currentInEdges) {
        const edge = this.edges.get(edgeId)!;
        if (!transitiveDependents.has(edge.from)) {
          queue.push(edge.from);
        }
      }
    }

    // Find affected routes
    const affectedRoutes: string[] = [];
    for (const depId of transitiveDependents) {
      const depNode = this.nodes.get(depId);
      if (depNode?.type === "Route") {
        affectedRoutes.push(depId);
      }
    }

    // Find affected workflows
    const affectedWorkflows: string[] = [];
    for (const depId of transitiveDependents) {
      const depNode = this.nodes.get(depId);
      if (depNode?.type === "Workflow") {
        affectedWorkflows.push(depId);
      }
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    if (node.type === "Agent" && node.properties.tier === "core") riskLevel = "critical";
    else if (transitiveDependents.size > 10) riskLevel = "high";
    else if (transitiveDependents.size > 5) riskLevel = "medium";

    return {
      node: nodeId,
      directDependents,
      transitiveDependents: Array.from(transitiveDependents),
      affectedRoutes,
      affectedWorkflows,
      riskLevel,
    };
  }

  // ── Hermes Reasoning Queries ───────────────────────────────────

  /**
   * Given a task description, find the best agent based on capability matching.
   */
  findAgentForCapability(capability: string): GraphNode[] {
    return this.getNodesByType("Agent").filter((agent) => {
      const caps = agent.properties.capabilities as string[];
      return caps?.some((c) => c.includes(capability) || capability.includes(c));
    });
  }

  /**
   * Get all routes served by a specific agent.
   */
  getRoutesForAgent(agentId: string): GraphNode[] {
    return this.neighbors(agentId, {
      edgeType: "SERVES",
      direction: "outgoing",
      nodeType: "Route",
    });
  }

  /**
   * Get all security policies enforced on a target.
   */
  getPoliciesForTarget(targetId: string): GraphNode[] {
    return this.neighbors(targetId, {
      edgeType: "ENFORCES",
      direction: "incoming",
      nodeType: "SecurityPolicy",
    });
  }

  /**
   * Get the full dependency chain for a route (agents, integrations, knowledge, policies).
   */
  getRouteDependencyChain(routePath: string): {
    agents: GraphNode[];
    integrations: GraphNode[];
    knowledge: GraphNode[];
    policies: GraphNode[];
    events: GraphNode[];
  } {
    const agents = this.neighbors(routePath, { edgeType: "SERVES", direction: "incoming", nodeType: "Agent" });
    const integrations: Set<string> = new Set();
    const knowledge: Set<string> = new Set();
    const policies: Set<string> = new Set();
    const events: Set<string> = new Set();

    for (const agent of agents) {
      for (const n of this.neighbors(agent.id, { edgeType: "USES_INTEGRATION", direction: "outgoing" })) {
        integrations.add(n.id);
      }
      for (const n of this.neighbors(agent.id, { edgeType: "QUERIES", direction: "outgoing" })) {
        knowledge.add(n.id);
      }
      for (const n of this.neighbors(agent.id, { edgeType: "ENFORCES", direction: "incoming" })) {
        policies.add(n.id);
      }
      for (const n of this.neighbors(agent.id, { edgeType: "PUBLISHES", direction: "outgoing" })) {
        events.add(n.id);
      }
    }

    return {
      agents,
      integrations: Array.from(integrations).map((id) => this.nodes.get(id)!).filter(Boolean),
      knowledge: Array.from(knowledge).map((id) => this.nodes.get(id)!).filter(Boolean),
      policies: Array.from(policies).map((id) => this.nodes.get(id)!).filter(Boolean),
      events: Array.from(events).map((id) => this.nodes.get(id)!).filter(Boolean),
    };
  }

  // ── Statistics ─────────────────────────────────────────────────

  stats(): { nodes: number; edges: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      byType[node.type] = (byType[node.type] || 0) + 1;
    }
    return { nodes: this.nodes.size, edges: this.edges.size, byType };
  }
}

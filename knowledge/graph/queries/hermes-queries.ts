/**
 * D3VONN Hermes Reasoning Queries
 * 
 * Pre-built query functions that Hermes uses to reason about the platform.
 * These provide high-level answers to common orchestration questions.
 * 
 * @module knowledge/graph/queries/hermes-queries
 * @version 1.0.0
 */

import { PlatformKnowledgeGraph, GraphNode } from "../engine";

// ─────────────────────────────────────────────────────────────────
// Task Routing Queries
// ─────────────────────────────────────────────────────────────────

/**
 * Q: "Which agent should handle this task?"
 * Matches task keywords against agent capabilities.
 */
export function queryBestAgentForTask(
  graph: PlatformKnowledgeGraph,
  taskKeywords: string[]
): { agent: GraphNode; matchedCapabilities: string[]; score: number }[] {
  const agents = graph.getNodesByType("Agent");
  const results: { agent: GraphNode; matchedCapabilities: string[]; score: number }[] = [];

  for (const agent of agents) {
    const capabilities = agent.properties.capabilities as string[];
    const matched = capabilities.filter((cap) =>
      taskKeywords.some((kw) => cap.includes(kw) || kw.includes(cap))
    );
    if (matched.length > 0) {
      results.push({
        agent,
        matchedCapabilities: matched,
        score: matched.length / taskKeywords.length,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Q: "What happens if this agent goes down?"
 * Returns impact analysis for an agent failure.
 */
export function queryAgentFailureImpact(
  graph: PlatformKnowledgeGraph,
  agentId: string
): {
  affectedRoutes: GraphNode[];
  affectedWorkflows: string[];
  canFallback: boolean;
  fallbackAgents: GraphNode[];
} {
  const impact = graph.impactAnalysis(agentId);
  const agent = graph.getNode(agentId);
  const capabilities = (agent?.properties.capabilities as string[]) || [];

  // Find agents with overlapping capabilities
  const fallbackAgents = graph
    .getNodesByType("Agent")
    .filter((a) => {
      if (a.id === agentId) return false;
      const aCaps = a.properties.capabilities as string[];
      return aCaps.some((c) => capabilities.includes(c));
    });

  const affectedRoutes = graph.neighbors(agentId, {
    edgeType: "SERVES",
    direction: "outgoing",
    nodeType: "Route",
  });

  return {
    affectedRoutes,
    affectedWorkflows: impact.affectedWorkflows,
    canFallback: fallbackAgents.length > 0,
    fallbackAgents,
  };
}

// ─────────────────────────────────────────────────────────────────
// Security Queries
// ─────────────────────────────────────────────────────────────────

/**
 * Q: "What security policies apply to this agent/workflow?"
 */
export function querySecurityPosture(
  graph: PlatformKnowledgeGraph,
  targetId: string
): { policies: GraphNode[]; gaps: string[] } {
  const policies = graph.getPoliciesForTarget(targetId);
  const target = graph.getNode(targetId);

  // Check for common policy gaps
  const gaps: string[] = [];
  const policyTypes = policies.map((p) => p.properties.type as string);

  if (!policyTypes.includes("agent-governance") && target?.type === "Agent") {
    gaps.push("No agent governance policy applied");
  }
  if (!policyTypes.includes("runtime-security")) {
    gaps.push("No runtime security monitoring");
  }
  if (!policyTypes.includes("admission-control") && target?.type === "Workflow") {
    gaps.push("No admission control for workflow");
  }

  return { policies, gaps };
}

/**
 * Q: "Which routes are accessible without authentication?"
 */
export function queryPublicRoutes(graph: PlatformKnowledgeGraph): GraphNode[] {
  return graph.getNodesByType("Route").filter((route) => {
    return route.properties.access === "public" && !route.properties.system;
  });
}

/**
 * Q: "Which routes require admin access?"
 */
export function queryAdminRoutes(graph: PlatformKnowledgeGraph): GraphNode[] {
  return graph.getNodesByType("Route").filter((route) => {
    return route.properties.access === "admin";
  });
}

// ─────────────────────────────────────────────────────────────────
// Knowledge & Integration Queries
// ─────────────────────────────────────────────────────────────────

/**
 * Q: "What knowledge modules does this agent use?"
 */
export function queryAgentKnowledgeDependencies(
  graph: PlatformKnowledgeGraph,
  agentId: string
): { module: GraphNode; operations: string[] }[] {
  const edges = Array.from(graph.getEdgesByType("QUERIES")).filter((e) => e.from === agentId);
  return edges.map((edge) => ({
    module: graph.getNode(edge.to)!,
    operations: edge.properties.operations as string[],
  })).filter((r) => r.module);
}

/**
 * Q: "What integrations are critical (used by 3+ agents)?"
 */
export function queryCriticalIntegrations(
  graph: PlatformKnowledgeGraph
): { integration: GraphNode; userCount: number; users: string[] }[] {
  const integrations = graph.getNodesByType("Integration");
  const results: { integration: GraphNode; userCount: number; users: string[] }[] = [];

  for (const integration of integrations) {
    const users = graph.neighbors(integration.id, {
      edgeType: "USES_INTEGRATION",
      direction: "incoming",
    });
    results.push({
      integration,
      userCount: users.length,
      users: users.map((u) => u.id),
    });
  }

  return results.filter((r) => r.userCount >= 3).sort((a, b) => b.userCount - a.userCount);
}

// ─────────────────────────────────────────────────────────────────
// Event Flow Queries
// ─────────────────────────────────────────────────────────────────

/**
 * Q: "What is the event flow for a given event?"
 * Returns publishers and subscribers.
 */
export function queryEventFlow(
  graph: PlatformKnowledgeGraph,
  eventName: string
): { publishers: GraphNode[]; subscribers: GraphNode[] } {
  const publishers = graph.neighbors(eventName, {
    edgeType: "PUBLISHES",
    direction: "incoming",
  });
  const subscribers = graph.neighbors(eventName, {
    edgeType: "SUBSCRIBES_TO",
    direction: "incoming",
  });

  return { publishers, subscribers };
}

/**
 * Q: "Trace the full event chain from a trigger to all downstream effects."
 */
export function queryEventCascade(
  graph: PlatformKnowledgeGraph,
  triggerEvent: string,
  maxDepth: number = 3
): { event: string; subscribers: string[]; producedEvents: string[] }[] {
  const cascade: { event: string; subscribers: string[]; producedEvents: string[] }[] = [];
  const visited: Set<string> = new Set();
  const queue: string[] = [triggerEvent];

  let depth = 0;
  while (queue.length > 0 && depth < maxDepth) {
    const currentBatch = [...queue];
    queue.length = 0;

    for (const eventName of currentBatch) {
      if (visited.has(eventName)) continue;
      visited.add(eventName);

      const subscribers = graph.neighbors(eventName, {
        edgeType: "SUBSCRIBES_TO",
        direction: "incoming",
      });

      // Find what events these subscribers produce
      const producedEvents: string[] = [];
      for (const subscriber of subscribers) {
        const published = graph.neighbors(subscriber.id, {
          edgeType: "PUBLISHES",
          direction: "outgoing",
          nodeType: "Event",
        });
        for (const evt of published) {
          if (!visited.has(evt.id)) {
            producedEvents.push(evt.id);
            queue.push(evt.id);
          }
        }
      }

      cascade.push({
        event: eventName,
        subscribers: subscribers.map((s) => s.id),
        producedEvents,
      });
    }
    depth++;
  }

  return cascade;
}

// ─────────────────────────────────────────────────────────────────
// Platform Health Queries
// ─────────────────────────────────────────────────────────────────

/**
 * Q: "Give me a platform health summary."
 */
export function queryPlatformHealth(graph: PlatformKnowledgeGraph): {
  totalNodes: number;
  totalEdges: number;
  activeAgents: number;
  activeWorkflows: number;
  activeIntegrations: number;
  securityCoverage: number;
  orphanedRoutes: GraphNode[];
} {
  const stats = graph.stats();
  const agents = graph.getNodesByType("Agent");
  const workflows = graph.getNodesByType("Workflow");
  const integrations = graph.getNodesByType("Integration");
  const routes = graph.getNodesByType("Route");

  // Find routes with no serving agent
  const orphanedRoutes = routes.filter((route) => {
    if (route.properties.system || route.properties.access === "public") return false;
    const servers = graph.neighbors(route.id, { edgeType: "SERVES", direction: "incoming" });
    return servers.length === 0;
  });

  // Security coverage: % of agents with at least one policy
  const agentsWithPolicy = agents.filter((agent) => {
    const policies = graph.getPoliciesForTarget(agent.id);
    return policies.length > 0;
  });

  return {
    totalNodes: stats.nodes,
    totalEdges: stats.edges,
    activeAgents: agents.filter((a) => a.properties.status === "active").length,
    activeWorkflows: workflows.filter((w) => w.properties.status === "active").length,
    activeIntegrations: integrations.filter((i) => i.properties.status === "active").length,
    securityCoverage: Math.round((agentsWithPolicy.length / agents.length) * 100),
    orphanedRoutes,
  };
}

/**
 * Q: "What is the full dependency graph for a specific route?"
 */
export function queryFullRouteDependencies(
  graph: PlatformKnowledgeGraph,
  routePath: string
): {
  route: GraphNode | undefined;
  pillar: GraphNode | undefined;
  agents: GraphNode[];
  integrations: GraphNode[];
  knowledge: GraphNode[];
  policies: GraphNode[];
  events: { published: GraphNode[]; subscribed: GraphNode[] };
  role: GraphNode | undefined;
} {
  const route = graph.getNode(routePath);
  const chain = graph.getRouteDependencyChain(routePath);

  const pillarNodes = graph.neighbors(routePath, { edgeType: "BELONGS_TO", direction: "outgoing", nodeType: "Pillar" });
  const roleNodes = graph.neighbors(routePath, { edgeType: "REQUIRES_ROLE", direction: "outgoing", nodeType: "RBACRole" });

  // Separate published vs subscribed events for the serving agents
  const published: Set<string> = new Set();
  const subscribed: Set<string> = new Set();
  for (const agent of chain.agents) {
    for (const evt of graph.neighbors(agent.id, { edgeType: "PUBLISHES", direction: "outgoing", nodeType: "Event" })) {
      published.add(evt.id);
    }
    for (const evt of graph.neighbors(agent.id, { edgeType: "SUBSCRIBES_TO", direction: "outgoing", nodeType: "Event" })) {
      subscribed.add(evt.id);
    }
  }

  return {
    route,
    pillar: pillarNodes[0],
    agents: chain.agents,
    integrations: chain.integrations,
    knowledge: chain.knowledge,
    policies: chain.policies,
    events: {
      published: Array.from(published).map((id) => graph.getNode(id)!).filter(Boolean),
      subscribed: Array.from(subscribed).map((id) => graph.getNode(id)!).filter(Boolean),
    },
    role: roleNodes[0],
  };
}

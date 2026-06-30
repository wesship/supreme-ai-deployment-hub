/**
 * D3VONN Platform Knowledge Graph Loader
 * 
 * Loads the platform seed data (platform-graph.json) and route taxonomy
 * into the PlatformKnowledgeGraph engine, creating all nodes and edges.
 * 
 * @module knowledge/graph/loader
 * @version 1.0.0
 */

import { PlatformKnowledgeGraph } from "./engine";
import type { NodeType, EdgeType } from "./engine";

// Seed data types
interface SeedData {
  nodes: {
    pillars: Array<{ id: string; name: string; description: string }>;
    agents: Array<{ id: string; name: string; tier: string; status: string; version: string; capabilities: string[] }>;
    workflows: Array<{ id: string; name: string; type: string; trigger: string; engine: string; status: string }>;
    integrations: Array<{ id: string; name: string; type: string; status: string }>;
    security_policies: Array<{ id: string; name: string; type: string; engine: string; status: string }>;
    knowledge_modules: Array<{ id: string; name: string; type: string; backend?: string; status: string }>;
    events: Array<{ name: string; description: string; category: string }>;
    rbac_roles: Array<{ id: string; description: string; permissions: string[] }>;
  };
  edges: {
    delegates_to: Array<{ from: string; to: string; conditions: string }>;
    part_of_pillar: Array<{ from: string; pillar: string }>;
    agent_uses_integration: Array<{ agent: string; integration: string }>;
    agent_queries_knowledge: Array<{ agent: string; module: string; operations: string[] }>;
    agent_publishes_event: Array<{ agent: string; event: string }>;
    agent_subscribes_to_event: Array<{ agent: string; event: string }>;
    policy_enforces: Array<{ policy: string; target: string; target_type: string }>;
    route_requires_role: Array<{ route: string; role: string }>;
  };
}

interface RouteTaxonomy {
  routes: Array<{
    path: string;
    page?: string;
    category: string;
    description?: string;
    agents?: string[];
    pillar?: string | null;
    access?: string;
    system?: boolean;
    redirect_to?: string;
    alias_of?: string;
  }>;
}

/**
 * Load the complete platform knowledge graph from seed data and route taxonomy.
 */
export function loadPlatformGraph(seedData: SeedData, routeTaxonomy: RouteTaxonomy): PlatformKnowledgeGraph {
  const graph = new PlatformKnowledgeGraph();

  // ── Load Nodes ───────────────────────────────────────────────

  // Pillars
  for (const pillar of seedData.nodes.pillars) {
    graph.addNode(pillar.id, "Pillar", { name: pillar.name, description: pillar.description });
  }

  // Agents
  for (const agent of seedData.nodes.agents) {
    graph.addNode(agent.id, "Agent", {
      name: agent.name,
      tier: agent.tier,
      status: agent.status,
      version: agent.version,
      capabilities: agent.capabilities,
    });
  }

  // Workflows
  for (const workflow of seedData.nodes.workflows) {
    graph.addNode(workflow.id, "Workflow", {
      name: workflow.name,
      type: workflow.type,
      trigger: workflow.trigger,
      engine: workflow.engine,
      status: workflow.status,
    });
  }

  // Integrations
  for (const integration of seedData.nodes.integrations) {
    graph.addNode(integration.id, "Integration", {
      name: integration.name,
      type: integration.type,
      status: integration.status,
    });
  }

  // Security Policies
  for (const policy of seedData.nodes.security_policies) {
    graph.addNode(policy.id, "SecurityPolicy", {
      name: policy.name,
      type: policy.type,
      engine: policy.engine,
      status: policy.status,
    });
  }

  // Knowledge Modules
  for (const module of seedData.nodes.knowledge_modules) {
    graph.addNode(module.id, "KnowledgeModule", {
      name: module.name,
      type: module.type,
      backend: module.backend,
      status: module.status,
    });
  }

  // Events
  for (const event of seedData.nodes.events) {
    graph.addNode(event.name, "Event", {
      description: event.description,
      category: event.category,
    });
  }

  // RBAC Roles
  for (const role of seedData.nodes.rbac_roles) {
    graph.addNode(role.id, "RBACRole", {
      description: role.description,
      permissions: role.permissions,
    });
  }

  // Routes (from taxonomy)
  for (const route of routeTaxonomy.routes) {
    if (route.redirect_to) continue; // Skip pure redirects
    graph.addNode(route.path, "Route", {
      page: route.page,
      category: route.category,
      description: route.description,
      access: route.access || (route.category === "company" ? "public" : "authenticated"),
      system: route.system || false,
      alias_of: route.alias_of,
    });
  }

  // ── Load Edges ───────────────────────────────────────────────

  // Agent delegates to agent
  for (const edge of seedData.edges.delegates_to) {
    graph.addEdge("DELEGATES_TO", edge.from, edge.to, { conditions: edge.conditions });
  }

  // Part of pillar
  for (const edge of seedData.edges.part_of_pillar) {
    graph.addEdge("PART_OF", edge.from, edge.pillar, {});
  }

  // Agent uses integration
  for (const edge of seedData.edges.agent_uses_integration) {
    graph.addEdge("USES_INTEGRATION", edge.agent, edge.integration, {});
  }

  // Agent queries knowledge
  for (const edge of seedData.edges.agent_queries_knowledge) {
    graph.addEdge("QUERIES", edge.agent, edge.module, { operations: edge.operations });
  }

  // Agent publishes event
  for (const edge of seedData.edges.agent_publishes_event) {
    graph.addEdge("PUBLISHES", edge.agent, edge.event, {});
  }

  // Agent subscribes to event
  for (const edge of seedData.edges.agent_subscribes_to_event) {
    graph.addEdge("SUBSCRIBES_TO", edge.agent, edge.event, {});
  }

  // Policy enforces on target
  for (const edge of seedData.edges.policy_enforces) {
    graph.addEdge("ENFORCES", edge.policy, edge.target, { target_type: edge.target_type });
  }

  // Route requires role
  for (const edge of seedData.edges.route_requires_role) {
    graph.addEdge("REQUIRES_ROLE", edge.route, edge.role, {});
  }

  // Route served by agents (from taxonomy)
  for (const route of routeTaxonomy.routes) {
    if (route.redirect_to || !route.agents) continue;
    for (const agentId of route.agents) {
      graph.addEdge("SERVES", agentId, route.path, {});
    }
    // Route belongs to pillar
    if (route.pillar) {
      graph.addEdge("BELONGS_TO", route.path, route.pillar, {});
    }
  }

  return graph;
}

/**
 * Create a singleton instance of the platform graph.
 * In production, this would load from files; here we accept pre-parsed data.
 */
let _instance: PlatformKnowledgeGraph | null = null;

export function getPlatformGraph(seedData: SeedData, routeTaxonomy: RouteTaxonomy): PlatformKnowledgeGraph {
  if (!_instance) {
    _instance = loadPlatformGraph(seedData, routeTaxonomy);
  }
  return _instance;
}

export function resetPlatformGraph(): void {
  _instance = null;
}

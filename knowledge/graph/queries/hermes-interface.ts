/**
 * D3VONN Hermes Reasoning Interface
 * 
 * High-level interface that Hermes uses to make decisions about task routing,
 * resource allocation, and platform operations. This wraps the raw graph
 * queries into decision-oriented functions.
 * 
 * @module knowledge/graph/queries/hermes-interface
 * @version 1.0.0
 */

import { PlatformKnowledgeGraph, GraphNode } from "../engine";
import * as queries from "./hermes-queries";

// ─────────────────────────────────────────────────────────────────
// Decision Types
// ─────────────────────────────────────────────────────────────────

export interface TaskRoutingDecision {
  taskId: string;
  selectedAgent: GraphNode;
  confidence: number;
  reasoning: string;
  alternativeAgents: GraphNode[];
  requiredIntegrations: GraphNode[];
  applicablePolicies: GraphNode[];
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "critical";
  activeAgents: number;
  totalAgents: number;
  securityCoverage: number;
  orphanedRoutes: string[];
  criticalIntegrations: { name: string; users: number }[];
  recommendations: string[];
}

export interface IncidentContext {
  affectedAgent: string;
  impact: {
    routes: string[];
    workflows: string[];
    riskLevel: string;
  };
  fallbackPlan: {
    available: boolean;
    agents: string[];
    capabilities: string[];
  };
  eventChain: { event: string; subscribers: string[] }[];
}

// ─────────────────────────────────────────────────────────────────
// Hermes Interface
// ─────────────────────────────────────────────────────────────────

export class HermesReasoningInterface {
  private graph: PlatformKnowledgeGraph;

  constructor(graph: PlatformKnowledgeGraph) {
    this.graph = graph;
  }

  /**
   * Make a task routing decision.
   * Hermes calls this to determine which agent should handle a task.
   */
  routeTask(taskId: string, taskKeywords: string[]): TaskRoutingDecision {
    const candidates = queries.queryBestAgentForTask(this.graph, taskKeywords);

    if (candidates.length === 0) {
      // Fallback to Hermes itself
      const hermes = this.graph.getNode("hermes")!;
      return {
        taskId,
        selectedAgent: hermes,
        confidence: 0.3,
        reasoning: "No specialist agent matched the task keywords. Hermes will handle directly.",
        alternativeAgents: [],
        requiredIntegrations: [],
        applicablePolicies: [],
      };
    }

    const selected = candidates[0];
    const alternatives = candidates.slice(1, 4).map((c) => c.agent);

    // Get required integrations for the selected agent
    const integrations = this.graph.neighbors(selected.agent.id, {
      edgeType: "USES_INTEGRATION",
      direction: "outgoing",
      nodeType: "Integration",
    });

    // Get applicable policies
    const policies = this.graph.getPoliciesForTarget(selected.agent.id);

    return {
      taskId,
      selectedAgent: selected.agent,
      confidence: selected.score,
      reasoning: `Agent "${selected.agent.properties.name}" matched ${selected.matchedCapabilities.length} capabilities: ${selected.matchedCapabilities.join(", ")}`,
      alternativeAgents: alternatives,
      requiredIntegrations: integrations,
      applicablePolicies: policies,
    };
  }

  /**
   * Perform a platform health check.
   * Hermes calls this periodically or before major operations.
   */
  healthCheck(): HealthCheckResult {
    const health = queries.queryPlatformHealth(this.graph);
    const critical = queries.queryCriticalIntegrations(this.graph);

    const recommendations: string[] = [];

    if (health.orphanedRoutes.length > 0) {
      recommendations.push(
        `${health.orphanedRoutes.length} routes have no serving agent — consider assigning agents or marking as static.`
      );
    }

    if (health.securityCoverage < 100) {
      recommendations.push(
        `Security coverage is ${health.securityCoverage}% — some agents lack policy enforcement.`
      );
    }

    for (const c of critical) {
      if (c.userCount >= 5) {
        recommendations.push(
          `Integration "${c.integration.properties.name}" is used by ${c.userCount} agents — consider redundancy planning.`
        );
      }
    }

    let status: "healthy" | "degraded" | "critical" = "healthy";
    if (health.securityCoverage < 50 || health.orphanedRoutes.length > 10) {
      status = "critical";
    } else if (health.securityCoverage < 80 || health.orphanedRoutes.length > 5) {
      status = "degraded";
    }

    return {
      status,
      activeAgents: health.activeAgents,
      totalAgents: this.graph.getNodesByType("Agent").length,
      securityCoverage: health.securityCoverage,
      orphanedRoutes: health.orphanedRoutes.map((r) => r.id),
      criticalIntegrations: critical.map((c) => ({
        name: c.integration.properties.name as string,
        users: c.userCount,
      })),
      recommendations,
    };
  }

  /**
   * Generate incident context for an agent failure.
   * Hermes calls this when an agent reports an error or becomes unresponsive.
   */
  generateIncidentContext(agentId: string): IncidentContext {
    const failureImpact = queries.queryAgentFailureImpact(this.graph, agentId);

    // Determine what events would be disrupted
    const publishedEvents = this.graph.neighbors(agentId, {
      edgeType: "PUBLISHES",
      direction: "outgoing",
      nodeType: "Event",
    });

    const eventChain: { event: string; subscribers: string[] }[] = [];
    for (const evt of publishedEvents) {
      const flow = queries.queryEventFlow(this.graph, evt.id);
      eventChain.push({
        event: evt.id,
        subscribers: flow.subscribers.map((s) => s.id),
      });
    }

    return {
      affectedAgent: agentId,
      impact: {
        routes: failureImpact.affectedRoutes.map((r) => r.id),
        workflows: failureImpact.affectedWorkflows,
        riskLevel: this.graph.impactAnalysis(agentId).riskLevel,
      },
      fallbackPlan: {
        available: failureImpact.canFallback,
        agents: failureImpact.fallbackAgents.map((a) => a.id),
        capabilities: failureImpact.fallbackAgents.flatMap(
          (a) => a.properties.capabilities as string[]
        ),
      },
      eventChain,
    };
  }

  /**
   * Get the full context for a route — everything Hermes needs to know
   * to serve a request on that route.
   */
  getRouteContext(routePath: string): {
    route: GraphNode | undefined;
    pillar: string | undefined;
    agents: string[];
    integrations: string[];
    knowledge: string[];
    policies: string[];
    requiredRole: string | undefined;
    events: { published: string[]; subscribed: string[] };
  } {
    const deps = queries.queryFullRouteDependencies(this.graph, routePath);
    return {
      route: deps.route,
      pillar: deps.pillar?.id,
      agents: deps.agents.map((a) => a.id),
      integrations: deps.integrations.map((i) => i.id),
      knowledge: deps.knowledge.map((k) => k.id),
      policies: deps.policies.map((p) => p.id),
      requiredRole: deps.role?.id,
      events: {
        published: deps.events.published.map((e) => e.id),
        subscribed: deps.events.subscribed.map((e) => e.id),
      },
    };
  }

  /**
   * Answer a natural language question about the platform graph.
   * Returns structured context that can be fed to an LLM for final answer generation.
   */
  queryContext(question: string): Record<string, unknown> {
    const lower = question.toLowerCase();

    if (lower.includes("health") || lower.includes("status")) {
      return { type: "health_check", data: this.healthCheck() };
    }

    if (lower.includes("route") && lower.includes("agent")) {
      // Extract route path if mentioned
      const routeMatch = question.match(/\/[\w\-\/]+/);
      if (routeMatch) {
        return { type: "route_context", data: this.getRouteContext(routeMatch[0]) };
      }
    }

    if (lower.includes("impact") || lower.includes("failure") || lower.includes("down")) {
      // Extract agent name
      const agents = this.graph.getNodesByType("Agent");
      for (const agent of agents) {
        if (lower.includes(agent.id) || lower.includes((agent.properties.name as string).toLowerCase())) {
          return { type: "incident_context", data: this.generateIncidentContext(agent.id) };
        }
      }
    }

    if (lower.includes("security") || lower.includes("policy")) {
      const agents = this.graph.getNodesByType("Agent");
      for (const agent of agents) {
        if (lower.includes(agent.id)) {
          return { type: "security_posture", data: queries.querySecurityPosture(this.graph, agent.id) };
        }
      }
      // General security overview
      return {
        type: "security_overview",
        data: {
          policies: this.graph.getNodesByType("SecurityPolicy").map((p) => ({
            id: p.id,
            name: p.properties.name,
            type: p.properties.type,
          })),
          adminRoutes: queries.queryAdminRoutes(this.graph).map((r) => r.id),
          publicRoutes: queries.queryPublicRoutes(this.graph).map((r) => r.id),
        },
      };
    }

    if (lower.includes("event") || lower.includes("cascade")) {
      const events = this.graph.getNodesByType("Event");
      for (const evt of events) {
        if (lower.includes(evt.id.toLowerCase())) {
          return { type: "event_cascade", data: this.graph.getNode(evt.id) };
        }
      }
    }

    // Default: return graph stats
    return { type: "graph_stats", data: this.graph.stats() };
  }
}

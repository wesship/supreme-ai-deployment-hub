/**
 * D3VONN CI Quality Gates — Hermes Dashboard Smoke Tests
 *
 * Validates the Hermes governance engine integration points:
 * - Agent registry availability
 * - Knowledge graph connectivity
 * - Event bus subscription health
 * - Security policy enforcement
 * - Workflow orchestration readiness
 *
 * @module tests/smoke/hermes-dashboard
 * @version 1.0.0
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "../../..");

function loadYaml(relativePath: string): any {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return yaml.load(fs.readFileSync(fullPath, "utf-8"));
}

function loadJson(relativePath: string): any {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

// ─────────────────────────────────────────────────────────────────
// Agent Registry Health
// ─────────────────────────────────────────────────────────────────

describe("Hermes Dashboard Smoke — Agent Registry", () => {
  const registry = loadYaml("agents/registry.yaml");

  it("should have a valid agent registry", () => {
    expect(registry).not.toBeNull();
    expect(registry.version).toBeDefined();
    expect(registry.agents).toBeDefined();
  });

  it("should have Hermes as the orchestrator agent", () => {
    const hermes = registry.agents.find((a: any) => a.id === "hermes");
    expect(hermes).toBeDefined();
    expect(hermes.type).toBe("orchestrator");
  });

  it("should have at least 5 registered agents", () => {
    expect(registry.agents.length).toBeGreaterThanOrEqual(5);
  });

  it("should have status field for all agents", () => {
    for (const agent of registry.agents) {
      expect(agent.status).toBeDefined();
      expect(["active", "beta", "planned", "deprecated"]).toContain(agent.status);
    }
  });

  it("should have manifest path for all agents", () => {
    for (const agent of registry.agents) {
      expect(agent.manifest).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Agent Manifests
// ─────────────────────────────────────────────────────────────────

describe("Hermes Dashboard Smoke — Agent Manifests", () => {
  const manifestDir = path.join(ROOT, "agents");

  it("should have a Hermes manifest", () => {
    const manifestPath = path.join(manifestDir, "hermes", "manifest.yaml");
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it("should have valid manifest schema version", () => {
    const manifest = loadYaml("agents/hermes/manifest.yaml");
    expect(manifest).not.toBeNull();
    expect(manifest.apiVersion).toBe("d3vonn.io/v1");
    expect(manifest.kind).toBe("AgentManifest");
  });

  it("should declare Hermes capabilities", () => {
    const manifest = loadYaml("agents/hermes/manifest.yaml");
    expect(manifest.capabilities).toBeDefined();
    expect(manifest.capabilities.length).toBeGreaterThan(0);
  });

  it("should declare Hermes event subscriptions", () => {
    const manifest = loadYaml("agents/hermes/manifest.yaml");
    expect(manifest.events).toBeDefined();
    expect(manifest.events.subscribes).toBeDefined();
    expect(manifest.events.subscribes.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Knowledge Graph Connectivity
// ─────────────────────────────────────────────────────────────────

describe("Hermes Dashboard Smoke — Knowledge Graph", () => {
  const graph = loadJson("knowledge/graph/seed/platform-graph.json");

  it("should have a valid knowledge graph seed", () => {
    expect(graph).not.toBeNull();
    expect(graph.nodes).toBeDefined();
    expect(graph.edges).toBeDefined();
  });

  it("should have Hermes as a node in the graph", () => {
    const agents = graph.nodes.agents;
    expect(agents).toBeDefined();
    const hermesNode = agents.find((a: any) => a.id === "hermes");
    expect(hermesNode).toBeDefined();
  });

  it("should have at least 5 agent nodes", () => {
    expect(graph.nodes.agents.length).toBeGreaterThanOrEqual(5);
  });

  it("should have multiple edge categories", () => {
    const edgeKeys = Object.keys(graph.edges);
    expect(edgeKeys.length).toBeGreaterThanOrEqual(4);
  });

  it("should have Hermes delegation edges", () => {
    const delegations = graph.edges.delegates_to;
    expect(delegations).toBeDefined();
    const hermesDelegations = delegations.filter((e: any) => e.from === "hermes");
    expect(hermesDelegations.length).toBeGreaterThanOrEqual(3);
  });

  it("should have integration edges for Hermes", () => {
    const integrations = graph.edges.agent_uses_integration;
    expect(integrations).toBeDefined();
    const hermesIntegrations = integrations.filter((e: any) => e.agent === "hermes");
    expect(hermesIntegrations.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// Security Policy Validation
// ─────────────────────────────────────────────────────────────────

describe("Hermes Dashboard Smoke — Security Policies", () => {
  const policiesFile = loadYaml("security/policies.yaml");

  it("should have a valid security policies registry", () => {
    expect(policiesFile).not.toBeNull();
    expect(policiesFile.version).toBeDefined();
  });

  it("should have at least 5 policy entries defined", () => {
    expect(policiesFile.policies.length).toBeGreaterThanOrEqual(5);
  });

  it("should have RBAC roles defined", () => {
    expect(policiesFile.rbac).toBeDefined();
    expect(policiesFile.rbac.roles).toBeDefined();
    expect(policiesFile.rbac.roles.length).toBeGreaterThanOrEqual(4);
  });

  it("should have all policies with status", () => {
    for (const policy of policiesFile.policies) {
      expect(policy.status).toBeDefined();
      expect(["active", "planned", "in-progress", "deprecated"]).toContain(policy.status);
    }
  });

  it("should have agent governance policy", () => {
    const agentPolicy = policiesFile.policies.find(
      (p: any) => p.type?.includes("agent") || p.name?.toLowerCase().includes("agent")
    );
    expect(agentPolicy).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
// Automation Workflows
// ─────────────────────────────────────────────────────────────────

describe("Hermes Dashboard Smoke — Workflow Registry", () => {
  const workflows = loadYaml("automation/workflows.yaml");

  it("should have a valid workflows registry", () => {
    expect(workflows).not.toBeNull();
    expect(workflows.version).toBeDefined();
  });

  it("should have at least 5 workflows defined", () => {
    expect(workflows.workflows.length).toBeGreaterThanOrEqual(5);
  });

  it("should have standardized events defined", () => {
    expect(workflows.events).toBeDefined();
    expect(workflows.events.length).toBeGreaterThanOrEqual(10);
  });

  it("should have all workflows with trigger", () => {
    for (const workflow of workflows.workflows) {
      expect(workflow.trigger).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Integration Catalog
// ─────────────────────────────────────────────────────────────────

describe("Hermes Dashboard Smoke — Integration Catalog", () => {
  const catalog = loadYaml("integrations/catalog.yaml");

  it("should have a valid integrations catalog", () => {
    expect(catalog).not.toBeNull();
    expect(catalog.version).toBeDefined();
  });

  it("should have at least 5 integrations", () => {
    expect(catalog.integrations.length).toBeGreaterThanOrEqual(5);
  });

  it("should have all integrations with status", () => {
    for (const integration of catalog.integrations) {
      expect(integration.status).toBeDefined();
      expect(["active", "beta", "planned", "deprecated"]).toContain(integration.status);
    }
  });
});

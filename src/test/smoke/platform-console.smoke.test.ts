/**
 * D3VONN Platform Console v1 — Smoke Tests
 *
 * Validates that all platform console routes, components, and integrations
 * are properly wired and functional.
 *
 * @module test/smoke/platform-console.smoke.test
 * @version 1.0.0
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────
// Route Registration Tests
// ─────────────────────────────────────────────────────────────────

describe("Platform Console — Route Registration", () => {
  const appTsxPath = path.resolve(__dirname, "../../App.tsx");
  const appContent = fs.readFileSync(appTsxPath, "utf-8");

  const PLATFORM_ROUTES = [
    "/platform",
    "hermes",
    "agents",
    "events",
    "knowledge",
    "security",
    "tenants",
  ];

  it("registers all platform routes in App.tsx", () => {
    for (const route of PLATFORM_ROUTES) {
      expect(appContent).toContain(route);
    }
  });

  it("uses nested route structure with PlatformConsole as parent", () => {
    expect(appContent).toContain('<Route path="/platform" element={<PlatformConsole />}>');
    expect(appContent).toContain("<Route index element={<PlatformOverview />} />");
  });

  it("lazy-loads all platform components", () => {
    const lazyImports = [
      "PlatformConsole",
      "PlatformOverview",
      "HermesDashboard",
      "AgentFleetView",
      "EventStreamPanel",
      "KnowledgeGraphViewer",
      "SecurityPolicyViewer",
      "TenantManagement",
    ];
    for (const name of lazyImports) {
      expect(appContent).toContain(`const ${name} = lazy(`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Component File Existence Tests
// ─────────────────────────────────────────────────────────────────

describe("Platform Console — Component Files", () => {
  const basePath = path.resolve(__dirname, "../..");

  const REQUIRED_FILES = [
    "pages/platform/PlatformConsole.tsx",
    "pages/platform/PlatformOverview.tsx",
    "components/platform/HermesDashboard.tsx",
    "components/platform/AgentFleetView.tsx",
    "components/platform/EventStreamPanel.tsx",
    "components/platform/KnowledgeGraphViewer.tsx",
    "components/platform/SecurityPolicyViewer.tsx",
    "components/platform/TenantWorkspaceSwitcher.tsx",
  ];

  for (const file of REQUIRED_FILES) {
    it(`exists: ${file}`, () => {
      const fullPath = path.join(basePath, file);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// Component Content Validation
// ─────────────────────────────────────────────────────────────────

describe("Platform Console — HermesDashboard", () => {
  const filePath = path.resolve(__dirname, "../../components/platform/HermesDashboard.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("includes task delegation view", () => {
    expect(content).toContain("Delegation");
  });

  it("includes dead letter queue monitoring", () => {
    expect(content).toContain("Dead Letter Queue");
  });

  it("includes confidence scoring", () => {
    expect(content).toContain("confidence");
  });

  it("includes governance blocks metric", () => {
    expect(content).toContain("Governance Blocks");
  });

  it("shows routing latency", () => {
    expect(content).toContain("avgRoutingMs");
  });
});

describe("Platform Console — AgentFleetView", () => {
  const filePath = path.resolve(__dirname, "../../components/platform/AgentFleetView.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("displays all 8 agents", () => {
    expect(content).toContain("hermes");
    expect(content).toContain("research-analyst");
    expect(content).toContain("code-engineer");
    expect(content).toContain("security-sentinel");
    expect(content).toContain("data-analyst");
    expect(content).toContain("ux-designer");
    expect(content).toContain("devops-engineer");
    expect(content).toContain("content-writer");
  });

  it("shows agent health status", () => {
    expect(content).toContain("healthy");
    expect(content).toContain("health");
  });

  it("shows agent capabilities", () => {
    expect(content).toContain("capabilities");
  });

  it("includes search and filter", () => {
    expect(content).toContain("Search agents");
    expect(content).toContain("filter");
  });

  it("shows event pub/sub information", () => {
    expect(content).toContain("publishes");
    expect(content).toContain("subscribes");
  });
});

describe("Platform Console — EventStreamPanel", () => {
  const filePath = path.resolve(__dirname, "../../components/platform/EventStreamPanel.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("shows live/paused toggle", () => {
    expect(content).toContain("isLive");
    expect(content).toContain("Paused");
  });

  it("includes replay controls", () => {
    expect(content).toContain("Replay");
  });

  it("shows DLQ count", () => {
    expect(content).toContain("DLQ");
    expect(content).toContain("dead-lettered");
  });

  it("includes event type filtering", () => {
    expect(content).toContain("Filter Types");
    expect(content).toContain("selectedTypes");
  });

  it("shows event payload inspection", () => {
    expect(content).toContain("Payload");
    expect(content).toContain("correlationId");
  });

  it("displays all 14 event types", () => {
    const eventTypes = [
      "TaskCreated",
      "TaskDelegated",
      "TaskCompleted",
      "AgentStarted",
      "AgentCompleted",
      "AgentFailed",
      "ToolInvoked",
      "MemoryUpdated",
      "KnowledgeIndexed",
      "SecurityAlertRaised",
      "GovernanceViolation",
      "DeploymentStarted",
      "DeploymentFinished",
      "WorkflowCompleted",
    ];
    for (const type of eventTypes) {
      expect(content).toContain(type);
    }
  });
});

describe("Platform Console — KnowledgeGraphViewer", () => {
  const filePath = path.resolve(__dirname, "../../components/platform/KnowledgeGraphViewer.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("shows graph statistics (112 nodes, 193 edges)", () => {
    expect(content).toContain("112 nodes");
    expect(content).toContain("193 edges");
  });

  it("includes all node type categories", () => {
    expect(content).toContain("agent");
    expect(content).toContain("route");
    expect(content).toContain("workflow");
    expect(content).toContain("integration");
    expect(content).toContain("security_policy");
    expect(content).toContain("knowledge_module");
    expect(content).toContain("event");
    expect(content).toContain("tool");
  });

  it("shows node detail panel with properties", () => {
    expect(content).toContain("Node Details");
    expect(content).toContain("Properties");
  });

  it("shows edge connections", () => {
    expect(content).toContain("Connections");
    expect(content).toContain("relationship");
  });

  it("includes search functionality", () => {
    expect(content).toContain("Search nodes");
  });
});

describe("Platform Console — SecurityPolicyViewer", () => {
  const filePath = path.resolve(__dirname, "../../components/platform/SecurityPolicyViewer.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("shows all 6 active policies", () => {
    expect(content).toContain("RBAC Deny-First Enforcer");
    expect(content).toContain("Row-Level Security");
    expect(content).toContain("Agent Governance Framework");
    expect(content).toContain("Data Sovereignty Compliance");
    expect(content).toContain("API Rate Limiting");
    expect(content).toContain("Sensitive Data Masking");
  });

  it("shows RBAC role hierarchy", () => {
    expect(content).toContain("platform_admin");
    expect(content).toContain("tenant_admin");
    expect(content).toContain("workspace_admin");
    expect(content).toContain("developer");
    expect(content).toContain("viewer");
  });

  it("includes governance decisions audit trail", () => {
    expect(content).toContain("Recent Decisions");
    expect(content).toContain("allow");
    expect(content).toContain("deny");
    expect(content).toContain("escalate");
  });

  it("shows enforcement modes", () => {
    expect(content).toContain("strict");
    expect(content).toContain("permissive");
    expect(content).toContain("audit-only");
  });

  it("displays violation counts", () => {
    expect(content).toContain("violations");
  });
});

describe("Platform Console — TenantWorkspaceSwitcher", () => {
  const filePath = path.resolve(__dirname, "../../components/platform/TenantWorkspaceSwitcher.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("includes tenant selection", () => {
    expect(content).toContain("D3VONN Labs");
    expect(content).toContain("Acme Corp");
    expect(content).toContain("Startup Inc");
  });

  it("shows workspace environments", () => {
    expect(content).toContain("production");
    expect(content).toContain("staging");
    expect(content).toContain("development");
  });

  it("shows tenant plans", () => {
    expect(content).toContain("enterprise");
    expect(content).toContain("pro");
    expect(content).toContain("free");
  });

  it("supports compact mode for sidebar", () => {
    expect(content).toContain("compact");
  });
});

// ─────────────────────────────────────────────────────────────────
// Integration Validation
// ─────────────────────────────────────────────────────────────────

describe("Platform Console — Integration", () => {
  const consolePath = path.resolve(__dirname, "../../pages/platform/PlatformConsole.tsx");
  const consoleContent = fs.readFileSync(consolePath, "utf-8");

  it("PlatformConsole imports TenantWorkspaceSwitcher", () => {
    expect(consoleContent).toContain("TenantWorkspaceSwitcher");
  });

  it("PlatformConsole uses Outlet for nested routes", () => {
    expect(consoleContent).toContain("Outlet");
  });

  it("PlatformConsole has navigation items for all sub-routes", () => {
    expect(consoleContent).toContain("/platform/hermes");
    expect(consoleContent).toContain("/platform/agents");
    expect(consoleContent).toContain("/platform/events");
    expect(consoleContent).toContain("/platform/knowledge");
    expect(consoleContent).toContain("/platform/security");
    expect(consoleContent).toContain("/platform/tenants");
  });

  it("PlatformConsole includes sidebar with collapsible state", () => {
    expect(consoleContent).toContain("sidebarOpen");
  });

  it("PlatformConsole shows version info", () => {
    expect(consoleContent).toContain("v2.0.0-alpha.1");
  });
});

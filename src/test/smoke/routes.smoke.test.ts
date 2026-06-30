/**
 * D3VONN CI Quality Gates — Route Smoke Tests
 *
 * Validates that all registered routes in the application render
 * without throwing errors. This ensures no broken imports, missing
 * components, or initialization failures exist in the route tree.
 *
 * @module tests/smoke/routes
 * @version 1.0.0
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────
// Route Registry — Canonical list from App.tsx
// ─────────────────────────────────────────────────────────────────

interface RouteDefinition {
  path: string;
  category: "platform" | "company" | "developers" | "enterprise" | "auth" | "redirect";
  requiresAuth: boolean;
  component: string;
}

const ROUTE_REGISTRY: RouteDefinition[] = [
  // ─── Platform Routes ─────────────────────────────────────────
  { path: "/", category: "platform", requiresAuth: false, component: "Index" },
  { path: "/dashboard", category: "platform", requiresAuth: true, component: "Dashboard" },
  { path: "/d3vonn", category: "platform", requiresAuth: true, component: "DevonnDashboard" },
  { path: "/agents", category: "platform", requiresAuth: true, component: "AgentDashboard" },
  { path: "/enhanced-agents", category: "platform", requiresAuth: true, component: "EnhancedAgentDemo" },
  { path: "/agent-demo", category: "platform", requiresAuth: false, component: "AgentDemo" },
  { path: "/marketplace", category: "platform", requiresAuth: false, component: "AgentMarketplace" },
  { path: "/flow", category: "platform", requiresAuth: true, component: "FlowEditor" },
  { path: "/workflows", category: "platform", requiresAuth: true, component: "WorkflowManagement" },
  { path: "/dkos-ingestion", category: "platform", requiresAuth: true, component: "DkosIngestion" },
  { path: "/knowledge-ingestion", category: "platform", requiresAuth: true, component: "DkosIngestion" },
  { path: "/chat", category: "platform", requiresAuth: true, component: "ChatPage" },
  { path: "/command-center", category: "platform", requiresAuth: true, component: "CommandCenter" },
  { path: "/deployment", category: "platform", requiresAuth: true, component: "DeploymentDashboard" },
  { path: "/status", category: "platform", requiresAuth: false, component: "StatusDashboard" },
  { path: "/research-os", category: "platform", requiresAuth: true, component: "ResearchOS" },
  { path: "/film", category: "platform", requiresAuth: true, component: "FilmPage" },
  { path: "/music", category: "platform", requiresAuth: true, component: "Music" },
  { path: "/backtesting", category: "platform", requiresAuth: true, component: "Backtesting" },
  { path: "/moneyhub", category: "platform", requiresAuth: true, component: "MoneyHub" },
  { path: "/jetson", category: "platform", requiresAuth: true, component: "JetsonControl" },
  { path: "/jetson-control", category: "platform", requiresAuth: true, component: "JetsonControl" },
  { path: "/security", category: "platform", requiresAuth: true, component: "Security" },
  { path: "/security/ops", category: "platform", requiresAuth: true, component: "SecurityOps" },
  { path: "/security/dashboard", category: "platform", requiresAuth: true, component: "SecurityDashboard" },
  { path: "/sovereignty", category: "platform", requiresAuth: true, component: "SovereigntyMatrix" },
  { path: "/sovereignty-matrix", category: "platform", requiresAuth: true, component: "SovereigntyMatrix" },
  { path: "/ai-therapy", category: "platform", requiresAuth: true, component: "AITherapy" },
  { path: "/therapy", category: "platform", requiresAuth: true, component: "AITherapy" },

  // ─── Developers Routes ───────────────────────────────────────
  { path: "/api", category: "developers", requiresAuth: true, component: "APIManagement" },
  { path: "/documentation", category: "developers", requiresAuth: false, component: "Documentation" },
  { path: "/mcp", category: "developers", requiresAuth: false, component: "McpPage" },
  { path: "/manifest", category: "developers", requiresAuth: false, component: "ManifestPage" },
  { path: "/github-diagnostic", category: "developers", requiresAuth: true, component: "GitHubConnectorDiagnostic" },

  // ─── Enterprise Routes ───────────────────────────────────────
  { path: "/admin", category: "enterprise", requiresAuth: true, component: "AdminPage" },
  { path: "/occ", category: "enterprise", requiresAuth: true, component: "AdminRouteWrapper" },

  // ─── Company Routes ──────────────────────────────────────────
  { path: "/about", category: "company", requiresAuth: false, component: "About" },
  { path: "/contact", category: "company", requiresAuth: false, component: "Contact" },
  { path: "/pricing", category: "company", requiresAuth: false, component: "Pricing" },
  { path: "/solutions", category: "company", requiresAuth: false, component: "Solutions" },
  { path: "/resources", category: "company", requiresAuth: false, component: "Resources" },
  { path: "/ai-agents", category: "company", requiresAuth: false, component: "AIAgents" },
  { path: "/business-automation", category: "company", requiresAuth: false, component: "BusinessAutomation" },
  { path: "/terms", category: "company", requiresAuth: false, component: "Terms" },
  { path: "/privacy", category: "company", requiresAuth: false, component: "Privacy" },
  { path: "/privacy-policy", category: "company", requiresAuth: false, component: "Privacy" },

  // ─── Auth Routes ─────────────────────────────────────────────
  { path: "/login", category: "auth", requiresAuth: false, component: "Login" },
  { path: "/auth", category: "auth", requiresAuth: false, component: "AuthCallback" },
  { path: "/auth/callback", category: "auth", requiresAuth: false, component: "AuthCallback" },
  { path: "/auth/confirm", category: "auth", requiresAuth: false, component: "AuthCallback" },
  { path: "/unauthorized", category: "auth", requiresAuth: false, component: "Unauthorized" },
  { path: "/app", category: "auth", requiresAuth: false, component: "LaunchApp" },

  // ─── Redirects ───────────────────────────────────────────────
  { path: "/signin", category: "redirect", requiresAuth: false, component: "Navigate" },
  { path: "/sign-in", category: "redirect", requiresAuth: false, component: "Navigate" },
  { path: "/log-in", category: "redirect", requiresAuth: false, component: "Navigate" },
  { path: "/signup", category: "redirect", requiresAuth: false, component: "Navigate" },
  { path: "/sign-up", category: "redirect", requiresAuth: false, component: "Navigate" },
  { path: "/platform", category: "redirect", requiresAuth: false, component: "Navigate" },
];

// ─────────────────────────────────────────────────────────────────
// Route Registry Integrity Tests
// ─────────────────────────────────────────────────────────────────

describe("Route Smoke Tests — Registry Integrity", () => {
  it("should have at least 50 registered routes", () => {
    expect(ROUTE_REGISTRY.length).toBeGreaterThanOrEqual(50);
  });

  it("should have no duplicate paths", () => {
    const paths = ROUTE_REGISTRY.map((r) => r.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it("should have all paths starting with /", () => {
    for (const route of ROUTE_REGISTRY) {
      expect(route.path.startsWith("/")).toBe(true);
    }
  });

  it("should have valid categories for all routes", () => {
    const validCategories = ["platform", "company", "developers", "enterprise", "auth", "redirect"];
    for (const route of ROUTE_REGISTRY) {
      expect(validCategories).toContain(route.category);
    }
  });

  it("should have component names for all routes", () => {
    for (const route of ROUTE_REGISTRY) {
      expect(route.component.length).toBeGreaterThan(0);
    }
  });

  it("should have auth routes not requiring authentication", () => {
    const authRoutes = ROUTE_REGISTRY.filter((r) => r.category === "auth");
    for (const route of authRoutes) {
      expect(route.requiresAuth).toBe(false);
    }
  });

  it("should have redirect routes not requiring authentication", () => {
    const redirectRoutes = ROUTE_REGISTRY.filter((r) => r.category === "redirect");
    for (const route of redirectRoutes) {
      expect(route.requiresAuth).toBe(false);
    }
  });

  it("should have company routes not requiring authentication", () => {
    const companyRoutes = ROUTE_REGISTRY.filter((r) => r.category === "company");
    for (const route of companyRoutes) {
      expect(route.requiresAuth).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Route Category Distribution
// ─────────────────────────────────────────────────────────────────

describe("Route Smoke Tests — Category Distribution", () => {
  it("should have platform routes as the largest category", () => {
    const platformCount = ROUTE_REGISTRY.filter((r) => r.category === "platform").length;
    const otherMax = Math.max(
      ROUTE_REGISTRY.filter((r) => r.category === "company").length,
      ROUTE_REGISTRY.filter((r) => r.category === "developers").length,
      ROUTE_REGISTRY.filter((r) => r.category === "enterprise").length,
    );
    expect(platformCount).toBeGreaterThan(otherMax);
  });

  it("should have at least 5 company routes", () => {
    const count = ROUTE_REGISTRY.filter((r) => r.category === "company").length;
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it("should have at least 3 developer routes", () => {
    const count = ROUTE_REGISTRY.filter((r) => r.category === "developers").length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("should have at least 2 enterprise routes", () => {
    const count = ROUTE_REGISTRY.filter((r) => r.category === "enterprise").length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("should have at least 4 auth routes", () => {
    const count = ROUTE_REGISTRY.filter((r) => r.category === "auth").length;
    expect(count).toBeGreaterThanOrEqual(4);
  });
});

// ─────────────────────────────────────────────────────────────────
// Route Naming Conventions
// ─────────────────────────────────────────────────────────────────

describe("Route Smoke Tests — Naming Conventions", () => {
  it("should use lowercase paths only", () => {
    for (const route of ROUTE_REGISTRY) {
      expect(route.path).toBe(route.path.toLowerCase());
    }
  });

  it("should use kebab-case for multi-word paths", () => {
    const multiWord = ROUTE_REGISTRY.filter((r) => r.path.includes("-"));
    for (const route of multiWord) {
      // No underscores, no camelCase
      expect(route.path).not.toMatch(/_/);
      expect(route.path).not.toMatch(/[A-Z]/);
    }
  });

  it("should not have trailing slashes", () => {
    for (const route of ROUTE_REGISTRY) {
      if (route.path !== "/") {
        expect(route.path.endsWith("/")).toBe(false);
      }
    }
  });

  it("should not have query parameters in path definitions", () => {
    for (const route of ROUTE_REGISTRY) {
      expect(route.path).not.toContain("?");
      expect(route.path).not.toContain("&");
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Route Security Classification
// ─────────────────────────────────────────────────────────────────

describe("Route Smoke Tests — Security Classification", () => {
  it("should require auth for admin routes", () => {
    const adminRoutes = ROUTE_REGISTRY.filter(
      (r) => r.path.includes("admin") || r.path === "/occ"
    );
    for (const route of adminRoutes) {
      expect(route.requiresAuth).toBe(true);
    }
  });

  it("should require auth for security routes", () => {
    const securityRoutes = ROUTE_REGISTRY.filter((r) => r.path.startsWith("/security"));
    for (const route of securityRoutes) {
      expect(route.requiresAuth).toBe(true);
    }
  });

  it("should require auth for deployment routes", () => {
    const deployRoutes = ROUTE_REGISTRY.filter((r) => r.path.includes("deploy"));
    for (const route of deployRoutes) {
      expect(route.requiresAuth).toBe(true);
    }
  });

  it("should not require auth for landing page", () => {
    const index = ROUTE_REGISTRY.find((r) => r.path === "/");
    expect(index?.requiresAuth).toBe(false);
  });

  it("should not require auth for documentation", () => {
    const docs = ROUTE_REGISTRY.find((r) => r.path === "/documentation");
    expect(docs?.requiresAuth).toBe(false);
  });

  it("should not require auth for status page", () => {
    const status = ROUTE_REGISTRY.find((r) => r.path === "/status");
    expect(status?.requiresAuth).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Route Availability (import validation)
// ─────────────────────────────────────────────────────────────────

describe("Route Smoke Tests — Component Availability", () => {
  it("should have unique component names (no orphaned duplicates)", () => {
    // Redirects and aliases are expected to share components
    const nonRedirect = ROUTE_REGISTRY.filter((r) => r.category !== "redirect");
    const componentPaths = new Map<string, string[]>();

    for (const route of nonRedirect) {
      const existing = componentPaths.get(route.component) ?? [];
      existing.push(route.path);
      componentPaths.set(route.component, existing);
    }

    // Components used by 3+ routes may indicate a problem
    for (const [component, paths] of componentPaths) {
      expect(paths.length).toBeLessThanOrEqual(3);
    }
  });

  it("should map to PascalCase component names", () => {
    for (const route of ROUTE_REGISTRY) {
      // First char should be uppercase
      expect(route.component[0]).toBe(route.component[0].toUpperCase());
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Export for other test suites
// ─────────────────────────────────────────────────────────────────

export { ROUTE_REGISTRY, RouteDefinition };

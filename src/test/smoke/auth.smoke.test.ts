/**
 * D3VONN CI Quality Gates — Auth Smoke Tests
 *
 * Validates authentication and authorization flow integrity:
 * - Auth route accessibility
 * - Protected route enforcement
 * - Session context propagation
 * - RBAC deny-first behavior
 *
 * @module tests/smoke/auth
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTenantContext,
  createSystemContext,
  TenantContext,
} from "../../../shared/tenancy/types";
import {
  RBACEnforcer,
  createRBACEnforcer,
  createDefaultEnforcer,
  AccessDeniedError,
} from "../../../shared/rbac/rbac-enforcer";

// ─────────────────────────────────────────────────────────────────
// Auth Flow Smoke Tests
// ─────────────────────────────────────────────────────────────────

describe("Auth Smoke Tests — Session Context", () => {
  it("should create a valid tenant context with all required fields", () => {
    const ctx = createTenantContext({
      tenantId: "tenant_test",
      workspaceId: "ws_default",
      userId: "user_001",
      roles: ["agent_operator"],
      permissions: ["agent:execute"],
      plan: "professional",
    });

    expect(ctx.tenantId).toBe("tenant_test");
    expect(ctx.workspaceId).toBe("ws_default");
    expect(ctx.userId).toBe("user_001");
    expect(ctx.roles).toContain("agent_operator");
    expect(ctx.permissions).toContain("agent:execute");
    expect(ctx.plan).toBe("professional");
    expect(ctx.dataRegion).toBe("us-east-1"); // default
  });

  it("should create a system context with wildcard permissions", () => {
    const ctx = createSystemContext("tenant_sys", "ws_sys");

    expect(ctx.userId).toBe("system");
    expect(ctx.roles).toContain("system");
    expect(ctx.permissions).toContain("*");
    expect(ctx.plan).toBe("enterprise");
  });

  it("should default to free plan when not specified", () => {
    const ctx = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: [],
      permissions: [],
    });

    expect(ctx.plan).toBe("free");
  });

  it("should support all plan tiers", () => {
    const plans = ["free", "starter", "professional", "enterprise"] as const;
    for (const plan of plans) {
      const ctx = createTenantContext({
        tenantId: "t1",
        workspaceId: "w1",
        userId: "u1",
        roles: [],
        permissions: [],
        plan,
      });
      expect(ctx.plan).toBe(plan);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// RBAC Deny-First Behavior
// ─────────────────────────────────────────────────────────────────

describe("Auth Smoke Tests — RBAC Deny-First", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createDefaultEnforcer();
  });

  it("should deny before checking role permissions when policy matches", () => {
    // tenant_admin has agent:deploy, but free-tier policy denies it
    const ctx = createTenantContext({
      tenantId: "tenant_free",
      workspaceId: "ws_default",
      userId: "user_admin",
      roles: ["tenant_admin"],
      permissions: [],
      plan: "free",
    });

    const decision = enforcer.check(ctx, "agent:deploy");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("free-tier-deploy-restriction");
  });

  it("should allow when no deny policy matches", () => {
    const ctx = createTenantContext({
      tenantId: "tenant_pro",
      workspaceId: "ws_default",
      userId: "user_admin",
      roles: ["tenant_admin"],
      permissions: [],
      plan: "professional",
    });

    const decision = enforcer.check(ctx, "agent:deploy");
    expect(decision.allowed).toBe(true);
  });

  it("should deny suspended tenants from write operations", () => {
    const ctx = {
      ...createTenantContext({
        tenantId: "tenant_suspended",
        workspaceId: "ws_default",
        userId: "user_admin",
        roles: ["tenant_admin"],
        permissions: [],
        plan: "enterprise",
      }),
      status: "suspended",
    } as any;

    const decision = enforcer.check(ctx, "agent:create");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("suspended-tenant-write-restriction");
  });

  it("should allow suspended tenants to read", () => {
    const ctx = {
      ...createTenantContext({
        tenantId: "tenant_suspended",
        workspaceId: "ws_default",
        userId: "user_admin",
        roles: ["tenant_admin"],
        permissions: [],
        plan: "enterprise",
      }),
      status: "suspended",
    } as any;

    // Read operations are not in the deny policy actions list
    const decision = enforcer.check(ctx, "tenant:read");
    expect(decision.allowed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// Role Hierarchy Enforcement
// ─────────────────────────────────────────────────────────────────

describe("Auth Smoke Tests — Role Hierarchy", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createRBACEnforcer();
  });

  it("should enforce role hierarchy: super_admin > tenant_admin", () => {
    const superAdmin = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["super_admin"],
      permissions: [],
      plan: "enterprise",
    });

    // super_admin should have all tenant_admin permissions
    expect(enforcer.check(superAdmin, "workspace:create").allowed).toBe(true);
    expect(enforcer.check(superAdmin, "user:invite").allowed).toBe(true);
    expect(enforcer.check(superAdmin, "agent:deploy").allowed).toBe(true);
  });

  it("should enforce role hierarchy: tenant_admin > workspace_admin", () => {
    const tenantAdmin = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["tenant_admin"],
      permissions: [],
      plan: "enterprise",
    });

    // tenant_admin inherits workspace_admin permissions
    expect(enforcer.check(tenantAdmin, "agent:execute").allowed).toBe(true);
    expect(enforcer.check(tenantAdmin, "task:create").allowed).toBe(true);
  });

  it("should enforce role hierarchy: workspace_admin > agent_operator", () => {
    const wsAdmin = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["workspace_admin"],
      permissions: [],
      plan: "enterprise",
    });

    // workspace_admin inherits agent_operator permissions
    expect(enforcer.check(wsAdmin, "agent:execute").allowed).toBe(true);
  });

  it("should restrict data_analyst to read-only operations", () => {
    const analyst = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["data_analyst"],
      permissions: [],
      plan: "enterprise",
    });

    expect(enforcer.check(analyst, "data:read").allowed).toBe(true);
    expect(enforcer.check(analyst, "report:create").allowed).toBe(true);
    expect(enforcer.check(analyst, "agent:deploy").allowed).toBe(false);
    expect(enforcer.check(analyst, "workspace:create").allowed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Permission Boundaries
// ─────────────────────────────────────────────────────────────────

describe("Auth Smoke Tests — Permission Boundaries", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createRBACEnforcer();
  });

  it("should not grant cross-domain permissions", () => {
    const operator = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["agent_operator"],
      permissions: [],
      plan: "enterprise",
    });

    // agent_operator should NOT have tenant management
    expect(enforcer.check(operator, "tenant:delete").allowed).toBe(false);
    expect(enforcer.check(operator, "user:invite").allowed).toBe(false);
    expect(enforcer.check(operator, "billing:read").allowed).toBe(false);
  });

  it("should respect explicit permission grants", () => {
    const custom = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["data_analyst"],
      permissions: ["custom:special_action"],
      plan: "enterprise",
    });

    expect(enforcer.check(custom, "custom:special_action").allowed).toBe(true);
  });

  it("should throw AccessDeniedError in enforce mode", () => {
    const enforceMode = createRBACEnforcer({ enforceMode: true });
    const analyst = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["data_analyst"],
      permissions: [],
      plan: "enterprise",
    });

    expect(() => enforceMode.enforce(analyst, "agent:deploy")).toThrow(AccessDeniedError);
  });
});

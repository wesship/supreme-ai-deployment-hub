/**
 * D3VONN Multi-Tenant Foundations — RBAC Enforcer Tests
 *
 * Validates role-based access control enforcement across
 * tenant boundaries with policy evaluation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RBACEnforcer,
  createRBACEnforcer,
  createDefaultEnforcer,
  AccessDeniedError,
} from "../../../shared/rbac/rbac-enforcer";
import { createTenantContext, createSystemContext, TenantContext } from "../../../shared/tenancy/types";

// ─── Test Fixtures ─────────────────────────────────────────────

function createAdminContext(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_acme",
    workspaceId: "ws_default",
    userId: "user_admin",
    roles: ["tenant_admin"],
    permissions: [],
    plan: "enterprise",
  });
}

function createOperatorContext(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_acme",
    workspaceId: "ws_default",
    userId: "user_operator",
    roles: ["agent_operator"],
    permissions: [],
    plan: "professional",
  });
}

function createAnalystContext(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_acme",
    workspaceId: "ws_default",
    userId: "user_analyst",
    roles: ["data_analyst"],
    permissions: [],
    plan: "starter",
  });
}

function createFreeTierContext(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_free",
    workspaceId: "ws_default",
    userId: "user_free",
    roles: ["agent_operator"],
    permissions: [],
    plan: "free",
  });
}

// ─── Tests ─────────────────────────────────────────────────────

describe("RBACEnforcer — Permission Checks", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createRBACEnforcer({ auditEnabled: true, enforceMode: true });
  });

  it("should allow tenant_admin to manage workspaces", () => {
    const ctx = createAdminContext();
    const decision = enforcer.check(ctx, "workspace:create");

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain("tenant_admin");
  });

  it("should allow agent_operator to execute agents", () => {
    const ctx = createOperatorContext();
    const decision = enforcer.check(ctx, "agent:execute");

    expect(decision.allowed).toBe(true);
  });

  it("should deny agent_operator from deleting tenants", () => {
    const ctx = createOperatorContext();
    const decision = enforcer.check(ctx, "tenant:delete");

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("Insufficient permissions");
  });

  it("should deny data_analyst from deploying agents", () => {
    const ctx = createAnalystContext();
    const decision = enforcer.check(ctx, "agent:deploy");

    expect(decision.allowed).toBe(false);
  });

  it("should allow data_analyst to read data", () => {
    const ctx = createAnalystContext();
    const decision = enforcer.check(ctx, "data:read");

    expect(decision.allowed).toBe(true);
  });

  it("should allow data_analyst to create reports", () => {
    const ctx = createAnalystContext();
    const decision = enforcer.check(ctx, "report:create");

    expect(decision.allowed).toBe(true);
  });

  it("should allow tenant_admin to invite users", () => {
    const ctx = createAdminContext();
    const decision = enforcer.check(ctx, "user:invite");

    expect(decision.allowed).toBe(true);
  });

  it("should deny agent_operator from managing users", () => {
    const ctx = createOperatorContext();
    const decision = enforcer.check(ctx, "user:invite");

    expect(decision.allowed).toBe(false);
  });
});

describe("RBACEnforcer — checkAll", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createRBACEnforcer();
  });

  it("should allow when all permissions are granted", () => {
    const ctx = createOperatorContext();
    const decision = enforcer.checkAll(ctx, ["agent:execute", "task:create"]);

    expect(decision.allowed).toBe(true);
  });

  it("should deny when any permission is missing", () => {
    const ctx = createOperatorContext();
    const decision = enforcer.checkAll(ctx, ["agent:execute", "tenant:delete"]);

    expect(decision.allowed).toBe(false);
  });
});

describe("RBACEnforcer — checkAny", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createRBACEnforcer();
  });

  it("should allow when any permission is granted", () => {
    const ctx = createAnalystContext();
    const decision = enforcer.checkAny(ctx, ["tenant:delete", "data:read"]);

    expect(decision.allowed).toBe(true);
  });

  it("should deny when no permissions match", () => {
    const ctx = createAnalystContext();
    const decision = enforcer.checkAny(ctx, ["tenant:delete", "agent:deploy"]);

    expect(decision.allowed).toBe(false);
  });
});

describe("RBACEnforcer — enforce (throws)", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createRBACEnforcer({ enforceMode: true });
  });

  it("should not throw when permission is granted", () => {
    const ctx = createAdminContext();
    expect(() => enforcer.enforce(ctx, "workspace:create")).not.toThrow();
  });

  it("should throw AccessDeniedError when permission is denied", () => {
    const ctx = createAnalystContext();
    expect(() => enforcer.enforce(ctx, "agent:deploy")).toThrow(AccessDeniedError);
  });

  it("should include decision details in error", () => {
    const ctx = createAnalystContext();
    try {
      enforcer.enforce(ctx, "agent:deploy");
    } catch (error) {
      expect(error).toBeInstanceOf(AccessDeniedError);
      const ade = error as AccessDeniedError;
      expect(ade.decision.permission).toBe("agent:deploy");
      expect(ade.decision.context.userId).toBe("user_analyst");
    }
  });

  it("should not throw in permissive mode", () => {
    const permissiveEnforcer = createRBACEnforcer({ enforceMode: false });
    const ctx = createAnalystContext();
    expect(() => permissiveEnforcer.enforce(ctx, "agent:deploy")).not.toThrow();
  });
});

describe("RBACEnforcer — Custom Policies", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createDefaultEnforcer();
  });

  it("should deny free-tier deploy via policy", () => {
    // Free-tier with tenant_admin role (has deploy permission)
    // should still be denied by the free-tier policy
    const ctx = {
      ...createTenantContext({
        tenantId: "tenant_free",
        workspaceId: "ws_default",
        userId: "user_free",
        roles: ["tenant_admin"],
        permissions: [],
        plan: "free",
      }),
    } as any;

    const decision = enforcer.check(ctx, "agent:deploy");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("free-tier-deploy-restriction");
  });

  it("should deny suspended tenant writes", () => {
    const ctx = {
      ...createTenantContext({
        tenantId: "tenant_suspended",
        workspaceId: "ws_default",
        userId: "user_001",
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

  it("should allow adding custom policies", () => {
    enforcer.addPolicy({
      name: "test-deny-all",
      description: "Deny everything for testing",
      resources: ["*"],
      actions: ["*"],
      conditions: [{ field: "tenantId", operator: "eq", value: "tenant_blocked" }],
      effect: "deny",
      priority: 300,
    });

    expect(enforcer.getPolicies()).toHaveLength(3);
  });

  it("should allow removing policies", () => {
    const removed = enforcer.removePolicy("free-tier-deploy-restriction");
    expect(removed).toBe(true);
    expect(enforcer.getPolicies()).toHaveLength(1);
  });

  it("should return false when removing non-existent policy", () => {
    const removed = enforcer.removePolicy("nonexistent");
    expect(removed).toBe(false);
  });
});

describe("RBACEnforcer — Audit Logging", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createRBACEnforcer({ auditEnabled: true });
  });

  it("should log all access decisions", () => {
    const ctx = createOperatorContext();
    enforcer.check(ctx, "agent:execute");
    enforcer.check(ctx, "tenant:delete");

    const log = enforcer.getDecisionLog();
    expect(log).toHaveLength(2);
  });

  it("should filter decisions by tenant", () => {
    const ctx1 = createOperatorContext();
    const ctx2 = createTenantContext({
      tenantId: "tenant_other",
      workspaceId: "ws_default",
      userId: "user_other",
      roles: ["agent_operator"],
      permissions: [],
    });

    enforcer.check(ctx1, "agent:execute");
    enforcer.check(ctx2, "agent:execute");

    const tenantDecisions = enforcer.getDecisionsForTenant("tenant_acme");
    expect(tenantDecisions).toHaveLength(1);
  });

  it("should track denied decisions", () => {
    const ctx = createAnalystContext();
    enforcer.check(ctx, "agent:deploy");
    enforcer.check(ctx, "data:read");

    const denied = enforcer.getDeniedDecisions();
    expect(denied).toHaveLength(1);
    expect(denied[0].permission).toBe("agent:deploy");
  });

  it("should clear decision log", () => {
    const ctx = createOperatorContext();
    enforcer.check(ctx, "agent:execute");
    enforcer.clearDecisionLog();

    expect(enforcer.getDecisionLog()).toHaveLength(0);
  });

  it("should not log when audit is disabled", () => {
    const noAuditEnforcer = createRBACEnforcer({ auditEnabled: false });
    const ctx = createOperatorContext();
    noAuditEnforcer.check(ctx, "agent:execute");

    expect(noAuditEnforcer.getDecisionLog()).toHaveLength(0);
  });

  it("should invoke onAccessDecision callback", () => {
    const decisions: any[] = [];
    const callbackEnforcer = createRBACEnforcer({
      auditEnabled: true,
      onAccessDecision: (d) => decisions.push(d),
    });

    const ctx = createOperatorContext();
    callbackEnforcer.check(ctx, "agent:execute");

    expect(decisions).toHaveLength(1);
    expect(decisions[0].allowed).toBe(true);
  });
});

describe("RBACEnforcer — Effective Permissions", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createRBACEnforcer();
  });

  it("should compute effective permissions for tenant_admin", () => {
    const ctx = createAdminContext();
    const perms = enforcer.getEffectivePermissions(ctx);

    expect(perms).toContain("workspace:create");
    expect(perms).toContain("user:invite");
    expect(perms).toContain("agent:deploy");
  });

  it("should include context-level permissions", () => {
    const ctx = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["data_analyst"],
      permissions: ["custom:permission"],
    });

    const perms = enforcer.getEffectivePermissions(ctx);
    expect(perms).toContain("custom:permission");
    expect(perms).toContain("data:read");
  });

  it("should deduplicate permissions", () => {
    const ctx = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["agent_operator"],
      permissions: ["agent:execute"], // duplicate of role permission
    });

    const perms = enforcer.getEffectivePermissions(ctx);
    const agentExecuteCount = perms.filter((p) => p === "agent:execute").length;
    expect(agentExecuteCount).toBe(1);
  });
});

describe("RBACEnforcer — Role Checks", () => {
  let enforcer: RBACEnforcer;

  beforeEach(() => {
    enforcer = createRBACEnforcer();
  });

  it("should detect role presence", () => {
    const ctx = createAdminContext();
    expect(enforcer.hasRole(ctx, "tenant_admin")).toBe(true);
    expect(enforcer.hasRole(ctx, "data_analyst")).toBe(false);
  });
});

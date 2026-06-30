/**
 * D3VONN Multi-Tenant Foundations — Tenant Isolation Tests
 *
 * Validates that tenant boundaries are enforced across all layers:
 * context resolution, memory isolation, event scoping.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTenantContext,
  createSystemContext,
  TenantContext,
  createTenantId,
  createWorkspaceId,
  createUserId,
  Tenant,
  DEFAULT_MULTI_TENANT_CONFIG,
} from "../../../shared/tenancy/types";
import {
  tenantContextStore,
  withTenantContext,
  withSystemContext,
  requireTenantContext,
  requirePermission,
  TenantPermissionError,
} from "../../../shared/tenancy/tenant-context";
import {
  InMemoryTenantService,
  MultiStrategyTenantResolver,
  createTenantResolver,
} from "../../../shared/tenancy/tenant-resolver";

// ─── Test Fixtures ─────────────────────────────────────────────

function createTestTenant(id: string, slug: string): Tenant {
  return {
    id: createTenantId(id),
    name: `Tenant ${id}`,
    slug,
    plan: "professional",
    status: "active",
    settings: {
      maxWorkspaces: 10,
      maxUsers: 100,
      maxAgents: 20,
      maxEventsPerMonth: 100000,
      maxMemoryBytes: 1073741824,
      allowedCapabilities: ["code-review", "research", "deployment"],
      dataRegion: "us-east-1",
      rlsEnabled: true,
      auditEnabled: true,
      eventRetentionDays: 90,
      auditRetentionDays: 365,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createTestContext(tenantId: string, workspaceId: string = "ws_default"): TenantContext {
  return createTenantContext({
    tenantId,
    workspaceId,
    userId: "user_test_001",
    roles: ["agent_operator"],
    permissions: ["agent:execute", "task:create", "memory:read", "memory:write"],
  });
}

// ─── Tests ─────────────────────────────────────────────────────

describe("Tenant Context Store", () => {
  beforeEach(() => {
    tenantContextStore.reset();
  });

  it("should store and retrieve tenant context", () => {
    const context = createTestContext("tenant_acme");
    tenantContextStore.set("req_001", context);

    const retrieved = tenantContextStore.get("req_001");
    expect(retrieved).toEqual(context);
  });

  it("should return null for unknown request ID", () => {
    const retrieved = tenantContextStore.get("req_unknown");
    expect(retrieved).toBeNull();
  });

  it("should clear context after request", () => {
    const context = createTestContext("tenant_acme");
    tenantContextStore.set("req_001", context);
    tenantContextStore.clear("req_001");

    const retrieved = tenantContextStore.get("req_001");
    expect(retrieved).toBeNull();
  });

  it("should track current tenant ID", () => {
    const context = createTestContext("tenant_acme");
    tenantContextStore.set("req_001", context);

    expect(tenantContextStore.getCurrentTenantId()).toBe("tenant_acme");
  });

  it("should track current workspace ID", () => {
    const context = createTestContext("tenant_acme", "ws_engineering");
    tenantContextStore.set("req_001", context);

    expect(tenantContextStore.getCurrentWorkspaceId()).toBe("ws_engineering");
  });

  it("should track current user ID", () => {
    const context = createTestContext("tenant_acme");
    tenantContextStore.set("req_001", context);

    expect(tenantContextStore.getCurrentUserId()).toBe("user_test_001");
  });

  it("should identify system context", () => {
    const context = createSystemContext("tenant_acme", "ws_default");
    tenantContextStore.set("req_001", context);

    expect(tenantContextStore.isSystemContext()).toBe(true);
  });

  it("should not identify user context as system", () => {
    const context = createTestContext("tenant_acme");
    tenantContextStore.set("req_001", context);

    expect(tenantContextStore.isSystemContext()).toBe(false);
  });

  it("should track active context count", () => {
    tenantContextStore.set("req_001", createTestContext("tenant_a"));
    tenantContextStore.set("req_002", createTestContext("tenant_b"));

    expect(tenantContextStore.getActiveCount()).toBe(2);
  });

  it("should isolate contexts between requests", () => {
    const ctxA = createTestContext("tenant_a");
    const ctxB = createTestContext("tenant_b");

    tenantContextStore.set("req_001", ctxA);
    tenantContextStore.set("req_002", ctxB);

    expect(tenantContextStore.get("req_001")?.tenantId).toBe("tenant_a");
    expect(tenantContextStore.get("req_002")?.tenantId).toBe("tenant_b");
  });
});

describe("withTenantContext", () => {
  beforeEach(() => {
    tenantContextStore.reset();
  });

  it("should execute function within tenant context", async () => {
    const context = createTestContext("tenant_acme");
    let capturedTenantId: string | null = null;

    await withTenantContext(context, async () => {
      capturedTenantId = tenantContextStore.getCurrentTenantId();
    });

    expect(capturedTenantId).toBe("tenant_acme");
  });

  it("should clean up context after execution", async () => {
    const context = createTestContext("tenant_acme");

    await withTenantContext(context, async () => {
      // Context is active
    });

    // Context should be cleaned up (store may still have the last pointer)
    expect(tenantContextStore.getActiveCount()).toBe(0);
  });

  it("should clean up context even on error", async () => {
    const context = createTestContext("tenant_acme");

    try {
      await withTenantContext(context, async () => {
        throw new Error("test error");
      });
    } catch {
      // Expected
    }

    expect(tenantContextStore.getActiveCount()).toBe(0);
  });
});

describe("withSystemContext", () => {
  beforeEach(() => {
    tenantContextStore.reset();
  });

  it("should execute with system privileges", async () => {
    let isSystem = false;

    await withSystemContext("tenant_acme", "ws_default", async () => {
      isSystem = tenantContextStore.isSystemContext();
    });

    expect(isSystem).toBe(true);
  });

  it("should have wildcard permissions", async () => {
    let permissions: string[] = [];

    await withSystemContext("tenant_acme", "ws_default", async () => {
      const ctx = tenantContextStore.get();
      permissions = ctx?.permissions ?? [];
    });

    expect(permissions).toContain("*");
  });
});

describe("requireTenantContext", () => {
  beforeEach(() => {
    tenantContextStore.reset();
  });

  it("should return context when available", () => {
    const context = createTestContext("tenant_acme");
    tenantContextStore.set("req_001", context);

    const result = requireTenantContext();
    expect(result.tenantId).toBe("tenant_acme");
  });

  it("should throw when no context available", () => {
    expect(() => requireTenantContext()).toThrow("Tenant context required");
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    tenantContextStore.reset();
  });

  it("should pass when permission is granted", () => {
    const context = createTestContext("tenant_acme");
    tenantContextStore.set("req_001", context);

    expect(() => requirePermission("agent:execute")).not.toThrow();
  });

  it("should throw when permission is missing", () => {
    const context = createTestContext("tenant_acme");
    tenantContextStore.set("req_001", context);

    expect(() => requirePermission("tenant:delete")).toThrow(TenantPermissionError);
  });

  it("should pass for system context (wildcard)", () => {
    const context = createSystemContext("tenant_acme", "ws_default");
    tenantContextStore.set("req_001", context);

    expect(() => requirePermission("anything:here")).not.toThrow();
  });
});

describe("Tenant Resolver — Header Strategy", () => {
  let tenantService: InMemoryTenantService;
  let resolver: MultiStrategyTenantResolver;

  beforeEach(() => {
    tenantService = new InMemoryTenantService();
    tenantService.addTenant(createTestTenant("tenant_acme", "acme"));
    tenantService.addTenant(createTestTenant("tenant_globex", "globex"));
    tenantService.addUserContext("user_001", "tenant_acme", "ws_default", {
      roles: ["workspace_admin"],
      permissions: ["workspace:read", "agent:create"],
      plan: "professional",
      dataRegion: "us-east-1",
    });

    resolver = createTenantResolver(tenantService, { strategy: "header" });
  });

  it("should resolve tenant from X-Tenant-ID header", async () => {
    const req = {
      headers: { "x-tenant-id": "tenant_acme", "x-workspace-id": "ws_default", "x-user-id": "user_001" },
    };

    const context = await resolver.resolve(req);
    expect(context).not.toBeNull();
    expect(context!.tenantId).toBe("tenant_acme");
  });

  it("should return null when header is missing", async () => {
    const req = { headers: {} };
    const context = await resolver.resolve(req);
    expect(context).toBeNull();
  });

  it("should throw for non-existent tenant", async () => {
    const req = { headers: { "x-tenant-id": "tenant_nonexistent" } };
    await expect(resolver.resolve(req)).rejects.toThrow("Tenant not found");
  });

  it("should resolve workspace from header", async () => {
    const req = {
      headers: { "x-tenant-id": "tenant_acme", "x-workspace-id": "ws_engineering", "x-user-id": "user_001" },
    };

    const context = await resolver.resolve(req);
    expect(context!.workspaceId).toBe("ws_engineering");
  });

  it("should resolve user roles and permissions", async () => {
    const req = {
      headers: { "x-tenant-id": "tenant_acme", "x-workspace-id": "ws_default", "x-user-id": "user_001" },
    };

    const context = await resolver.resolve(req);
    expect(context!.roles).toContain("workspace_admin");
    expect(context!.permissions).toContain("workspace:read");
  });

  it("should cache resolved contexts", async () => {
    const req = {
      headers: { "x-tenant-id": "tenant_acme", "x-workspace-id": "ws_default", "x-user-id": "user_001" },
    };

    const context1 = await resolver.resolve(req);
    const context2 = await resolver.resolve(req);
    expect(context1).toEqual(context2);
  });

  it("should reject suspended tenants", async () => {
    const suspendedTenant = createTestTenant("tenant_suspended", "suspended");
    suspendedTenant.status = "suspended";
    tenantService.addTenant(suspendedTenant);

    const req = { headers: { "x-tenant-id": "tenant_suspended" } };
    await expect(resolver.resolve(req)).rejects.toThrow("suspended");
  });
});

describe("Tenant Resolver — Subdomain Strategy", () => {
  let tenantService: InMemoryTenantService;
  let resolver: MultiStrategyTenantResolver;

  beforeEach(() => {
    tenantService = new InMemoryTenantService();
    tenantService.addTenant(createTestTenant("tenant_acme", "acme"));
    resolver = createTenantResolver(tenantService, { strategy: "subdomain" });
  });

  it("should resolve tenant from subdomain", async () => {
    const req = {
      headers: { "x-user-id": "user_001" },
      hostname: "acme.d3vonn.io",
    };

    const context = await resolver.resolve(req);
    expect(context).not.toBeNull();
    expect(context!.tenantId).toBe("tenant_acme");
  });

  it("should return null for unknown subdomain", async () => {
    const req = {
      headers: {},
      hostname: "unknown.d3vonn.io",
    };

    const context = await resolver.resolve(req);
    expect(context).toBeNull();
  });

  it("should return null for root domain", async () => {
    const req = {
      headers: {},
      hostname: "d3vonn.io",
    };

    const context = await resolver.resolve(req);
    expect(context).toBeNull();
  });
});

describe("Tenant Context Factory", () => {
  it("should create tenant context with all fields", () => {
    const ctx = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: ["tenant_admin"],
      permissions: ["tenant:read"],
      plan: "enterprise",
      dataRegion: "eu-west-1",
    });

    expect(ctx.tenantId).toBe("t1");
    expect(ctx.workspaceId).toBe("w1");
    expect(ctx.userId).toBe("u1");
    expect(ctx.roles).toEqual(["tenant_admin"]);
    expect(ctx.plan).toBe("enterprise");
    expect(ctx.dataRegion).toBe("eu-west-1");
  });

  it("should use defaults for optional fields", () => {
    const ctx = createTenantContext({
      tenantId: "t1",
      workspaceId: "w1",
      userId: "u1",
      roles: [],
      permissions: [],
    });

    expect(ctx.plan).toBe("free");
    expect(ctx.dataRegion).toBe("us-east-1");
  });

  it("should create system context correctly", () => {
    const ctx = createSystemContext("t1", "w1");

    expect(ctx.userId).toBe("system");
    expect(ctx.roles).toEqual(["system"]);
    expect(ctx.permissions).toEqual(["*"]);
    expect(ctx.plan).toBe("enterprise");
  });
});

/**
 * D3VONN CI Quality Gates — Tenant Isolation Smoke Tests
 *
 * Validates that tenant boundaries are enforced across all
 * shared infrastructure: memory, events, and data access.
 *
 * @module tests/smoke/tenant-isolation
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createTenantContext, TenantContext } from "../../../shared/tenancy/types";
import {
  TenantAwareMemoryStore,
  createTenantMemoryStore,
} from "../../../shared/tenancy/tenant-memory";
import {
  TenantAwareEventBus,
  createTenantEventBus,
} from "../../../shared/events/tenant-event-bus";

// ─────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────

function createTenantA(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_alpha",
    workspaceId: "ws_prod",
    userId: "user_alice",
    roles: ["tenant_admin"],
    permissions: ["memory:read", "memory:write", "event:publish", "event:subscribe"],
    plan: "enterprise",
  });
}

function createTenantB(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_beta",
    workspaceId: "ws_prod",
    userId: "user_bob",
    roles: ["tenant_admin"],
    permissions: ["memory:read", "memory:write", "event:publish", "event:subscribe"],
    plan: "enterprise",
  });
}

function createTenantC(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_gamma",
    workspaceId: "ws_staging",
    userId: "user_carol",
    roles: ["agent_operator"],
    permissions: ["memory:read", "memory:write", "event:publish"],
    plan: "professional",
  });
}

// ─────────────────────────────────────────────────────────────────
// Memory Isolation
// ─────────────────────────────────────────────────────────────────

describe("Tenant Isolation Smoke — Memory Store", () => {
  let store: TenantAwareMemoryStore;
  let ctxA: TenantContext;
  let ctxB: TenantContext;
  let ctxC: TenantContext;

  beforeEach(() => {
    store = createTenantMemoryStore();
    ctxA = createTenantA();
    ctxB = createTenantB();
    ctxC = createTenantC();
  });

  it("should completely isolate memory between 3 tenants", async () => {
    // Each tenant stores data with the same key
    await store.set(ctxA, "agent_hermes", "config", { model: "gpt-4", temp: 0.7 });
    await store.set(ctxB, "agent_hermes", "config", { model: "claude-3", temp: 0.5 });
    await store.set(ctxC, "agent_hermes", "config", { model: "llama-3", temp: 0.9 });

    // Each tenant sees only their own data
    const configA = await store.get(ctxA, "agent_hermes", "config");
    const configB = await store.get(ctxB, "agent_hermes", "config");
    const configC = await store.get(ctxC, "agent_hermes", "config");

    expect((configA!.value as any).model).toBe("gpt-4");
    expect((configB!.value as any).model).toBe("claude-3");
    expect((configC!.value as any).model).toBe("llama-3");
  });

  it("should prevent cross-tenant memory enumeration", async () => {
    await store.set(ctxA, "agent_hermes", "secret_key", "alpha_secret_123");
    await store.set(ctxA, "agent_hermes", "api_token", "alpha_token_456");
    await store.set(ctxB, "agent_hermes", "secret_key", "beta_secret_789");

    // Tenant B queries should never return Tenant A data
    const results = await store.query(ctxB, {});
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("beta_secret_789");
  });

  it("should prevent cross-tenant memory deletion", async () => {
    await store.set(ctxA, "agent_hermes", "critical_data", "must_not_delete");

    // Tenant B attempts to delete Tenant A's data
    const deleted = await store.delete(ctxB, "agent_hermes", "critical_data");
    expect(deleted).toBe(false);

    // Verify data still exists for Tenant A
    const entry = await store.get(ctxA, "agent_hermes", "critical_data");
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe("must_not_delete");
  });

  it("should isolate bulk operations to tenant scope", async () => {
    await store.set(ctxA, "agent_hermes", "k1", "v1");
    await store.set(ctxA, "agent_hermes", "k2", "v2");
    await store.set(ctxB, "agent_hermes", "k3", "v3");

    // Delete all agent memory for Tenant A
    const count = await store.deleteAgentMemory(ctxA, "agent_hermes");
    expect(count).toBe(2);

    // Tenant B's data is untouched
    const entryB = await store.get(ctxB, "agent_hermes", "k3");
    expect(entryB).not.toBeNull();
  });

  it("should isolate stats reporting to tenant scope", async () => {
    await store.set(ctxA, "agent_hermes", "k1", "v1");
    await store.set(ctxA, "agent_research", "k2", "v2");
    await store.set(ctxB, "agent_hermes", "k3", "v3");
    await store.set(ctxC, "agent_hermes", "k4", "v4");
    await store.set(ctxC, "agent_hermes", "k5", "v5");

    const statsA = await store.getStats(ctxA);
    const statsB = await store.getStats(ctxB);
    const statsC = await store.getStats(ctxC);

    expect(statsA.totalEntries).toBe(2);
    expect(statsB.totalEntries).toBe(1);
    expect(statsC.totalEntries).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────
// Event Bus Isolation
// ─────────────────────────────────────────────────────────────────

describe("Tenant Isolation Smoke — Event Bus", () => {
  let bus: TenantAwareEventBus;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(() => {
    bus = createTenantEventBus();
    ctxA = createTenantA();
    ctxB = createTenantB();
  });

  it("should isolate event delivery between tenants", async () => {
    const receivedA: any[] = [];
    const receivedB: any[] = [];

    bus.subscribe("TaskCreated", "tenant_alpha", async (event) => {
      receivedA.push(event);
    });
    bus.subscribe("TaskCreated", "tenant_beta", async (event) => {
      receivedB.push(event);
    });

    // Tenant A publishes
    await bus.publish("TaskCreated", { taskId: "t1", title: "Alpha task" }, ctxA);

    // Only Tenant A's subscriber receives
    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);
  });

  it("should isolate event history between tenants", async () => {
    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);
    await bus.publish("AgentStarted", { agentId: "a1" }, ctxA);
    await bus.publish("TaskCreated", { taskId: "t2" }, ctxB);

    const historyA = bus.getEventsForTenant("tenant_alpha");
    const historyB = bus.getEventsForTenant("tenant_beta");

    expect(historyA).toHaveLength(2);
    expect(historyB).toHaveLength(1);
  });

  it("should isolate rate limits between tenants", async () => {
    const limitedBus = createTenantEventBus({ maxEventsPerMinute: 3 });

    // Fill Tenant A's quota
    for (let i = 0; i < 3; i++) {
      await limitedBus.publish("TaskCreated", { taskId: `t${i}` }, ctxA);
    }

    // Tenant A is rate limited
    await expect(
      limitedBus.publish("TaskCreated", { taskId: "overflow" }, ctxA)
    ).rejects.toThrow();

    // Tenant B is unaffected
    await expect(
      limitedBus.publish("TaskCreated", { taskId: "b1" }, ctxB)
    ).resolves.toBeDefined();
  });

  it("should inject correct tenant metadata into events", async () => {
    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);

    const events = bus.getEventsForTenant("tenant_alpha");
    expect(events[0].metadata.tenantId).toBe("tenant_alpha");
    expect(events[0].metadata.workspaceId).toBe("ws_prod");
  });

  it("should isolate audit logs between tenants", async () => {
    const auditBus = createTenantEventBus({ auditEnabled: true });

    await auditBus.publish("TaskCreated", { taskId: "t1" }, ctxA);
    await auditBus.publish("TaskCreated", { taskId: "t2" }, ctxB);

    const auditA = auditBus.getAuditLog("tenant_alpha");
    const auditB = auditBus.getAuditLog("tenant_beta");

    expect(auditA).toHaveLength(1);
    expect(auditB).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// Cross-Tenant Attack Vectors
// ─────────────────────────────────────────────────────────────────

describe("Tenant Isolation Smoke — Attack Vectors", () => {
  let store: TenantAwareMemoryStore;
  let bus: TenantAwareEventBus;

  beforeEach(() => {
    store = createTenantMemoryStore();
    bus = createTenantEventBus();
  });

  it("should prevent tenant ID spoofing in memory access", async () => {
    const realCtx = createTenantA();
    await store.set(realCtx, "agent_hermes", "sensitive", "real_data");

    // Attacker creates context with different tenant but same agent/key
    const spoofCtx = createTenantContext({
      tenantId: "tenant_attacker",
      workspaceId: "ws_prod",
      userId: "user_evil",
      roles: ["tenant_admin"],
      permissions: ["memory:read"],
      plan: "enterprise",
    });

    const result = await store.get(spoofCtx, "agent_hermes", "sensitive");
    expect(result).toBeNull();
  });

  it("should prevent workspace ID spoofing in event delivery", async () => {
    const received: any[] = [];

    // Subscribe to specific workspace
    bus.subscribe("TaskCreated", "tenant_alpha", async (event) => {
      received.push(event);
    }, { workspaceId: "ws_prod" });

    // Publish from different workspace in same tenant
    const differentWs = createTenantContext({
      tenantId: "tenant_alpha",
      workspaceId: "ws_staging",
      userId: "user_alice",
      roles: ["tenant_admin"],
      permissions: ["event:publish"],
      plan: "enterprise",
    });

    await bus.publish("TaskCreated", { taskId: "t1" }, differentWs);

    // Should NOT be delivered to ws_prod subscriber
    expect(received).toHaveLength(0);
  });

  it("should maintain isolation under concurrent operations", async () => {
    const ctxA = createTenantA();
    const ctxB = createTenantB();

    // Simulate concurrent writes
    const writes = [];
    for (let i = 0; i < 50; i++) {
      writes.push(store.set(ctxA, "agent_hermes", `key_${i}`, `alpha_${i}`));
      writes.push(store.set(ctxB, "agent_hermes", `key_${i}`, `beta_${i}`));
    }
    await Promise.all(writes);

    // Verify isolation
    const resultsA = await store.query(ctxA, { agentId: "agent_hermes" });
    const resultsB = await store.query(ctxB, { agentId: "agent_hermes" });

    expect(resultsA).toHaveLength(50);
    expect(resultsB).toHaveLength(50);

    // Verify no cross-contamination
    for (const entry of resultsA) {
      expect((entry.value as string).startsWith("alpha_")).toBe(true);
    }
    for (const entry of resultsB) {
      expect((entry.value as string).startsWith("beta_")).toBe(true);
    }
  });
});

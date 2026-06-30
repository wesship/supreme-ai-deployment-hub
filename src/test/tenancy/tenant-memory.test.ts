/**
 * D3VONN Multi-Tenant Foundations — Tenant Memory Isolation Tests
 *
 * Validates that agent memory is properly isolated between tenants
 * and that all CRUD operations respect tenant boundaries.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TenantAwareMemoryStore,
  createTenantMemoryStore,
  MemoryIsolationError,
} from "../../../shared/tenancy/tenant-memory";
import { createTenantContext, TenantContext } from "../../../shared/tenancy/types";

// ─── Test Fixtures ─────────────────────────────────────────────

function createCtxA(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_a",
    workspaceId: "ws_a",
    userId: "user_a",
    roles: ["agent_operator"],
    permissions: ["memory:read", "memory:write"],
  });
}

function createCtxB(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_b",
    workspaceId: "ws_b",
    userId: "user_b",
    roles: ["agent_operator"],
    permissions: ["memory:read", "memory:write"],
  });
}

// ─── Tests ─────────────────────────────────────────────────────

describe("TenantAwareMemoryStore — Basic Operations", () => {
  let store: TenantAwareMemoryStore;
  let ctxA: TenantContext;

  beforeEach(() => {
    store = createTenantMemoryStore();
    ctxA = createCtxA();
  });

  it("should store and retrieve a memory entry", async () => {
    await store.set(ctxA, "agent_hermes", "last_task", { taskId: "t1", result: "success" });
    const entry = await store.get(ctxA, "agent_hermes", "last_task");

    expect(entry).not.toBeNull();
    expect(entry!.value).toEqual({ taskId: "t1", result: "success" });
    expect(entry!.tenantId).toBe("tenant_a");
    expect(entry!.agentId).toBe("agent_hermes");
  });

  it("should return null for non-existent key", async () => {
    const entry = await store.get(ctxA, "agent_hermes", "nonexistent");
    expect(entry).toBeNull();
  });

  it("should update existing entry", async () => {
    await store.set(ctxA, "agent_hermes", "counter", { count: 1 });
    await store.set(ctxA, "agent_hermes", "counter", { count: 2 });

    const entry = await store.get(ctxA, "agent_hermes", "counter");
    expect(entry!.value).toEqual({ count: 2 });
  });

  it("should preserve createdAt on update", async () => {
    const entry1 = await store.set(ctxA, "agent_hermes", "key1", "value1");
    // Small delay to ensure different timestamp
    await new Promise((r) => setTimeout(r, 5));
    const entry2 = await store.set(ctxA, "agent_hermes", "key1", "value2");

    expect(entry2.createdAt).toBe(entry1.createdAt);
    expect(entry2.updatedAt).not.toBe(entry1.updatedAt);
  });

  it("should delete a memory entry", async () => {
    await store.set(ctxA, "agent_hermes", "to_delete", "temp");
    const deleted = await store.delete(ctxA, "agent_hermes", "to_delete");

    expect(deleted).toBe(true);
    const entry = await store.get(ctxA, "agent_hermes", "to_delete");
    expect(entry).toBeNull();
  });

  it("should return false when deleting non-existent entry", async () => {
    const deleted = await store.delete(ctxA, "agent_hermes", "nonexistent");
    expect(deleted).toBe(false);
  });

  it("should delete all memory for an agent", async () => {
    await store.set(ctxA, "agent_hermes", "key1", "v1");
    await store.set(ctxA, "agent_hermes", "key2", "v2");
    await store.set(ctxA, "agent_hermes", "key3", "v3");

    const count = await store.deleteAgentMemory(ctxA, "agent_hermes");
    expect(count).toBe(3);
    expect(store.getTotalEntries()).toBe(0);
  });

  it("should track access count", async () => {
    await store.set(ctxA, "agent_hermes", "tracked", "data");
    await store.get(ctxA, "agent_hermes", "tracked");
    await store.get(ctxA, "agent_hermes", "tracked");
    const entry = await store.get(ctxA, "agent_hermes", "tracked");

    expect(entry!.metadata.accessCount).toBe(3);
  });

  it("should estimate size correctly", async () => {
    const entry = await store.set(ctxA, "agent_hermes", "sized", { hello: "world" });
    expect(entry.metadata.sizeBytes).toBeGreaterThan(0);
  });
});

describe("TenantAwareMemoryStore — Memory Types", () => {
  let store: TenantAwareMemoryStore;
  let ctxA: TenantContext;

  beforeEach(() => {
    store = createTenantMemoryStore();
    ctxA = createCtxA();
  });

  it("should default to episodic type", async () => {
    const entry = await store.set(ctxA, "agent_hermes", "key", "value");
    expect(entry.type).toBe("episodic");
  });

  it("should store semantic memory", async () => {
    const entry = await store.set(ctxA, "agent_hermes", "fact", "TypeScript is typed", {
      type: "semantic",
      confidence: 0.95,
    });
    expect(entry.type).toBe("semantic");
    expect(entry.metadata.confidence).toBe(0.95);
  });

  it("should store procedural memory", async () => {
    const entry = await store.set(ctxA, "agent_hermes", "how_to_deploy", { steps: ["build", "test", "push"] }, {
      type: "procedural",
    });
    expect(entry.type).toBe("procedural");
  });

  it("should store working memory with TTL", async () => {
    const entry = await store.set(ctxA, "agent_hermes", "temp_context", { taskId: "t1" }, {
      type: "working",
      ttlMs: 60000,
    });
    expect(entry.type).toBe("working");
    expect(entry.expiresAt).toBeDefined();
  });

  it("should expire working memory after TTL", async () => {
    await store.set(ctxA, "agent_hermes", "expired", "old_data", {
      type: "working",
      ttlMs: -1, // Already expired
    });

    const entry = await store.get(ctxA, "agent_hermes", "expired");
    expect(entry).toBeNull();
  });
});

describe("TenantAwareMemoryStore — Tenant Isolation", () => {
  let store: TenantAwareMemoryStore;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(() => {
    store = createTenantMemoryStore();
    ctxA = createCtxA();
    ctxB = createCtxB();
  });

  it("should isolate memory between tenants", async () => {
    await store.set(ctxA, "agent_hermes", "secret", "tenant_a_data");
    await store.set(ctxB, "agent_hermes", "secret", "tenant_b_data");

    const entryA = await store.get(ctxA, "agent_hermes", "secret");
    const entryB = await store.get(ctxB, "agent_hermes", "secret");

    expect(entryA!.value).toBe("tenant_a_data");
    expect(entryB!.value).toBe("tenant_b_data");
  });

  it("should not allow cross-tenant reads", async () => {
    await store.set(ctxA, "agent_hermes", "private", "sensitive");

    // Tenant B tries to read Tenant A's memory
    const entry = await store.get(ctxB, "agent_hermes", "private");
    expect(entry).toBeNull();
  });

  it("should not allow cross-tenant deletes", async () => {
    await store.set(ctxA, "agent_hermes", "protected", "data");

    // Tenant B tries to delete Tenant A's memory
    const deleted = await store.delete(ctxB, "agent_hermes", "protected");
    expect(deleted).toBe(false);

    // Verify it still exists for Tenant A
    const entry = await store.get(ctxA, "agent_hermes", "protected");
    expect(entry).not.toBeNull();
  });

  it("should isolate agent memory deletion to tenant", async () => {
    await store.set(ctxA, "agent_hermes", "key1", "v1");
    await store.set(ctxB, "agent_hermes", "key1", "v2");

    await store.deleteAgentMemory(ctxA, "agent_hermes");

    // Tenant A's memory is gone
    const entryA = await store.get(ctxA, "agent_hermes", "key1");
    expect(entryA).toBeNull();

    // Tenant B's memory is untouched
    const entryB = await store.get(ctxB, "agent_hermes", "key1");
    expect(entryB).not.toBeNull();
  });

  it("should isolate queries to tenant", async () => {
    await store.set(ctxA, "agent_hermes", "key1", "v1");
    await store.set(ctxA, "agent_hermes", "key2", "v2");
    await store.set(ctxB, "agent_hermes", "key3", "v3");

    const resultsA = await store.query(ctxA, {});
    const resultsB = await store.query(ctxB, {});

    expect(resultsA).toHaveLength(2);
    expect(resultsB).toHaveLength(1);
  });

  it("should isolate stats to tenant", async () => {
    await store.set(ctxA, "agent_hermes", "k1", "v1", { type: "episodic" });
    await store.set(ctxA, "agent_hermes", "k2", "v2", { type: "semantic" });
    await store.set(ctxB, "agent_hermes", "k3", "v3", { type: "procedural" });

    const statsA = await store.getStats(ctxA);
    const statsB = await store.getStats(ctxB);

    expect(statsA.totalEntries).toBe(2);
    expect(statsA.byType.episodic).toBe(1);
    expect(statsA.byType.semantic).toBe(1);
    expect(statsB.totalEntries).toBe(1);
    expect(statsB.byType.procedural).toBe(1);
  });
});

describe("TenantAwareMemoryStore — Queries", () => {
  let store: TenantAwareMemoryStore;
  let ctxA: TenantContext;

  beforeEach(async () => {
    store = createTenantMemoryStore();
    ctxA = createCtxA();

    // Seed data
    await store.set(ctxA, "agent_hermes", "task:001", { result: "ok" }, { type: "episodic", tags: ["task"] });
    await store.set(ctxA, "agent_hermes", "task:002", { result: "fail" }, { type: "episodic", tags: ["task", "error"] });
    await store.set(ctxA, "agent_hermes", "fact:ts", "TypeScript", { type: "semantic", confidence: 0.9, tags: ["lang"] });
    await store.set(ctxA, "agent_research", "paper:001", { title: "AI" }, { type: "semantic", tags: ["research"] });
  });

  it("should filter by agent", async () => {
    const results = await store.query(ctxA, { agentId: "agent_hermes" });
    expect(results).toHaveLength(3);
  });

  it("should filter by type", async () => {
    const results = await store.query(ctxA, { type: "semantic" });
    expect(results).toHaveLength(2);
  });

  it("should filter by key prefix", async () => {
    const results = await store.query(ctxA, { keyPrefix: "task:" });
    expect(results).toHaveLength(2);
  });

  it("should filter by tags", async () => {
    const results = await store.query(ctxA, { tags: ["error"] });
    expect(results).toHaveLength(1);
    expect((results[0].value as any).result).toBe("fail");
  });

  it("should filter by minimum confidence", async () => {
    const results = await store.query(ctxA, { minConfidence: 0.85 });
    // All entries default to confidence 1.0 except the one set to 0.9
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("should apply limit", async () => {
    const results = await store.query(ctxA, { limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("should apply offset", async () => {
    const all = await store.query(ctxA, {});
    const offset = await store.query(ctxA, { offset: 2 });
    expect(offset).toHaveLength(all.length - 2);
  });
});

describe("TenantAwareMemoryStore — Bulk Operations", () => {
  let store: TenantAwareMemoryStore;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(async () => {
    store = createTenantMemoryStore();
    ctxA = createCtxA();
    ctxB = createCtxB();

    await store.set(ctxA, "agent_hermes", "k1", "v1");
    await store.set(ctxA, "agent_hermes", "k2", "v2");
  });

  it("should export all tenant memory", async () => {
    const exported = await store.exportTenantMemory(ctxA);
    expect(exported).toHaveLength(2);
  });

  it("should import memory into a different tenant", async () => {
    const exported = await store.exportTenantMemory(ctxA);
    const imported = await store.importTenantMemory(ctxB, exported);

    expect(imported).toBe(2);

    // Verify imported into tenant B
    const entry = await store.get(ctxB, "agent_hermes", "k1");
    expect(entry).not.toBeNull();
    expect(entry!.tenantId).toBe("tenant_b");
  });

  it("should cleanup expired entries", async () => {
    await store.set(ctxA, "agent_hermes", "expired1", "old", { type: "working", ttlMs: -1 });
    await store.set(ctxA, "agent_hermes", "expired2", "old", { type: "working", ttlMs: -1 });

    const cleaned = await store.cleanupExpired();
    expect(cleaned).toBe(2);
  });
});

describe("TenantAwareMemoryStore — Reset", () => {
  it("should clear all state on reset", async () => {
    const store = createTenantMemoryStore();
    const ctx = createCtxA();

    await store.set(ctx, "agent_hermes", "k1", "v1");
    store.reset();

    expect(store.getTotalEntries()).toBe(0);
    const entry = await store.get(ctx, "agent_hermes", "k1");
    expect(entry).toBeNull();
  });
});

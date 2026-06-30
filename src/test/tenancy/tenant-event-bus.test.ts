/**
 * D3VONN Multi-Tenant Foundations — Tenant Event Bus Tests
 *
 * Validates tenant-scoped event publishing, subscription isolation,
 * rate limiting, and audit logging.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TenantAwareEventBus,
  createTenantEventBus,
  TenantRateLimitError,
} from "../../../shared/events/tenant-event-bus";
import { createTenantContext, TenantContext } from "../../../shared/tenancy/types";

// ─── Test Fixtures ─────────────────────────────────────────────

function createCtxA(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_a",
    workspaceId: "ws_a",
    userId: "user_a",
    roles: ["agent_operator"],
    permissions: ["event:publish", "event:subscribe"],
  });
}

function createCtxB(): TenantContext {
  return createTenantContext({
    tenantId: "tenant_b",
    workspaceId: "ws_b",
    userId: "user_b",
    roles: ["agent_operator"],
    permissions: ["event:publish", "event:subscribe"],
  });
}

// ─── Tests ─────────────────────────────────────────────────────

describe("TenantAwareEventBus — Publishing", () => {
  let bus: TenantAwareEventBus;

  beforeEach(() => {
    bus = createTenantEventBus();
  });

  it("should publish an event and return an event ID", async () => {
    const ctx = createCtxA();
    const eventId = await bus.publish("TaskCreated", { taskId: "t1", title: "Test" }, ctx);

    expect(eventId).toBeDefined();
    expect(eventId).toMatch(/^evt_/);
  });

  it("should store published events", async () => {
    const ctx = createCtxA();
    await bus.publish("TaskCreated", { taskId: "t1" }, ctx);
    await bus.publish("AgentStarted", { agentId: "a1" }, ctx);

    const events = bus.getEventsForTenant("tenant_a");
    expect(events).toHaveLength(2);
  });

  it("should inject tenant context into event metadata", async () => {
    const ctx = createCtxA();
    await bus.publish("TaskCreated", { taskId: "t1" }, ctx);

    const events = bus.getEventsForTenant("tenant_a");
    expect(events[0].metadata.tenantId).toBe("tenant_a");
    expect(events[0].metadata.workspaceId).toBe("ws_a");
    expect(events[0].metadata.tenant.userId).toBe("user_a");
  });

  it("should set correlation ID", async () => {
    const ctx = createCtxA();
    await bus.publish("TaskCreated", { taskId: "t1" }, ctx, {
      correlationId: "cor_custom_123",
    });

    const events = bus.getEventsForTenant("tenant_a");
    expect(events[0].metadata.correlationId).toBe("cor_custom_123");
  });

  it("should set causation ID", async () => {
    const ctx = createCtxA();
    await bus.publish("AgentStarted", { agentId: "a1" }, ctx, {
      causationId: "evt_previous_001",
    });

    const events = bus.getEventsForTenant("tenant_a");
    expect(events[0].metadata.causationId).toBe("evt_previous_001");
  });
});

describe("TenantAwareEventBus — Subscription Isolation", () => {
  let bus: TenantAwareEventBus;

  beforeEach(() => {
    bus = createTenantEventBus();
  });

  it("should deliver events only to the publishing tenant's subscribers", async () => {
    const ctxA = createCtxA();
    const ctxB = createCtxB();
    const receivedA: any[] = [];
    const receivedB: any[] = [];

    bus.subscribe("TaskCreated", "tenant_a", async (event) => {
      receivedA.push(event);
    });
    bus.subscribe("TaskCreated", "tenant_b", async (event) => {
      receivedB.push(event);
    });

    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);
  });

  it("should deliver to correct tenant when both publish", async () => {
    const ctxA = createCtxA();
    const ctxB = createCtxB();
    const receivedA: any[] = [];
    const receivedB: any[] = [];

    bus.subscribe("TaskCreated", "tenant_a", async (event) => {
      receivedA.push(event);
    });
    bus.subscribe("TaskCreated", "tenant_b", async (event) => {
      receivedB.push(event);
    });

    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);
    await bus.publish("TaskCreated", { taskId: "t2" }, ctxB);

    expect(receivedA).toHaveLength(1);
    expect(receivedA[0].payload.taskId).toBe("t1");
    expect(receivedB).toHaveLength(1);
    expect(receivedB[0].payload.taskId).toBe("t2");
  });

  it("should support workspace-scoped subscriptions", async () => {
    const ctxA = createCtxA(); // ws_a
    const received: any[] = [];

    bus.subscribe("TaskCreated", "tenant_a", async (event) => {
      received.push(event);
    }, { workspaceId: "ws_a" });

    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);

    // Publish from different workspace
    const ctxA2 = createTenantContext({
      tenantId: "tenant_a",
      workspaceId: "ws_other",
      userId: "user_a",
      roles: ["agent_operator"],
      permissions: [],
    });
    await bus.publish("TaskCreated", { taskId: "t2" }, ctxA2);

    expect(received).toHaveLength(1);
    expect(received[0].payload.taskId).toBe("t1");
  });

  it("should support wildcard subscriptions (subscribeAll)", async () => {
    const ctxA = createCtxA();
    const received: any[] = [];

    bus.subscribeAll("tenant_a", async (event) => {
      received.push(event);
    });

    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);
    await bus.publish("AgentStarted", { agentId: "a1" }, ctxA);
    await bus.publish("MemoryUpdated", { agentId: "a1" }, ctxA);

    expect(received).toHaveLength(3);
  });

  it("should not deliver wildcard events cross-tenant", async () => {
    const ctxB = createCtxB();
    const received: any[] = [];

    bus.subscribeAll("tenant_a", async (event) => {
      received.push(event);
    });

    await bus.publish("TaskCreated", { taskId: "t1" }, ctxB);

    expect(received).toHaveLength(0);
  });

  it("should support unsubscribe", async () => {
    const ctxA = createCtxA();
    const received: any[] = [];

    const sub = bus.subscribe("TaskCreated", "tenant_a", async (event) => {
      received.push(event);
    });

    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);
    sub.unsubscribe();
    await bus.publish("TaskCreated", { taskId: "t2" }, ctxA);

    expect(received).toHaveLength(1);
  });

  it("should deliver in priority order", async () => {
    const ctxA = createCtxA();
    const order: number[] = [];

    bus.subscribe("TaskCreated", "tenant_a", async () => {
      order.push(1);
    }, { priority: 1 });

    bus.subscribe("TaskCreated", "tenant_a", async () => {
      order.push(10);
    }, { priority: 10 });

    bus.subscribe("TaskCreated", "tenant_a", async () => {
      order.push(5);
    }, { priority: 5 });

    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);

    expect(order).toEqual([10, 5, 1]);
  });
});

describe("TenantAwareEventBus — Rate Limiting", () => {
  it("should enforce rate limits per tenant", async () => {
    const bus = createTenantEventBus({ maxEventsPerMinute: 5 });
    const ctx = createCtxA();

    // Publish up to the limit
    for (let i = 0; i < 5; i++) {
      await bus.publish("TaskCreated", { taskId: `t${i}` }, ctx);
    }

    // Next one should throw
    await expect(
      bus.publish("TaskCreated", { taskId: "t_over" }, ctx)
    ).rejects.toThrow(TenantRateLimitError);
  });

  it("should rate limit tenants independently", async () => {
    const bus = createTenantEventBus({ maxEventsPerMinute: 3 });
    const ctxA = createCtxA();
    const ctxB = createCtxB();

    // Fill tenant A's quota
    for (let i = 0; i < 3; i++) {
      await bus.publish("TaskCreated", { taskId: `t${i}` }, ctxA);
    }

    // Tenant B should still be able to publish
    await expect(
      bus.publish("TaskCreated", { taskId: "t_b" }, ctxB)
    ).resolves.toBeDefined();
  });
});

describe("TenantAwareEventBus — Event Queries", () => {
  let bus: TenantAwareEventBus;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(async () => {
    bus = createTenantEventBus();
    ctxA = createCtxA();
    ctxB = createCtxB();

    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);
    await bus.publish("AgentStarted", { agentId: "a1" }, ctxA);
    await bus.publish("TaskCreated", { taskId: "t2" }, ctxB);
  });

  it("should filter events by tenant", () => {
    const eventsA = bus.getEventsForTenant("tenant_a");
    const eventsB = bus.getEventsForTenant("tenant_b");

    expect(eventsA).toHaveLength(2);
    expect(eventsB).toHaveLength(1);
  });

  it("should filter events by type", () => {
    const events = bus.getEventsForTenant("tenant_a", { type: "TaskCreated" });
    expect(events).toHaveLength(1);
  });

  it("should filter events by workspace", () => {
    const events = bus.getEventsForTenant("tenant_a", { workspaceId: "ws_a" });
    expect(events).toHaveLength(2);
  });

  it("should apply limit", () => {
    const events = bus.getEventsForTenant("tenant_a", { limit: 1 });
    expect(events).toHaveLength(1);
  });

  it("should count events by tenant", () => {
    const counts = bus.getEventCountByTenant();
    expect(counts.get("tenant_a")).toBe(2);
    expect(counts.get("tenant_b")).toBe(1);
  });
});

describe("TenantAwareEventBus — Audit", () => {
  let bus: TenantAwareEventBus;

  beforeEach(() => {
    bus = createTenantEventBus({ auditEnabled: true });
  });

  it("should log publish events in audit", async () => {
    const ctx = createCtxA();
    await bus.publish("TaskCreated", { taskId: "t1" }, ctx);

    const audit = bus.getAuditLog("tenant_a");
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("event.published");
    expect(audit[0].eventType).toBe("TaskCreated");
  });

  it("should log handler failures in audit", async () => {
    const ctx = createCtxA();
    bus.subscribe("TaskCreated", "tenant_a", async () => {
      throw new Error("handler error");
    });

    await bus.publish("TaskCreated", { taskId: "t1" }, ctx);

    const audit = bus.getAuditLog("tenant_a");
    const failures = audit.filter((a) => a.action === "event.handler_failed");
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBe("handler error");
  });

  it("should not log when audit is disabled", async () => {
    const noAuditBus = createTenantEventBus({ auditEnabled: false });
    const ctx = createCtxA();
    await noAuditBus.publish("TaskCreated", { taskId: "t1" }, ctx);

    const audit = noAuditBus.getAuditLog("tenant_a");
    expect(audit).toHaveLength(0);
  });
});

describe("TenantAwareEventBus — Stats", () => {
  it("should report accurate stats", async () => {
    const bus = createTenantEventBus();
    const ctxA = createCtxA();
    const ctxB = createCtxB();

    bus.subscribe("TaskCreated", "tenant_a", async () => {});
    bus.subscribe("AgentStarted", "tenant_b", async () => {});

    await bus.publish("TaskCreated", { taskId: "t1" }, ctxA);
    await bus.publish("TaskCreated", { taskId: "t2" }, ctxB);

    const stats = bus.getStats();
    expect(stats.totalEvents).toBe(2);
    expect(stats.totalSubscriptions).toBe(2);
    expect(stats.tenantCount).toBe(2);
    expect(stats.eventsByType["TaskCreated"]).toBe(2);
  });
});

describe("TenantAwareEventBus — Error Handling", () => {
  it("should not fail other subscribers when one throws", async () => {
    const bus = createTenantEventBus();
    const ctx = createCtxA();
    const received: string[] = [];

    bus.subscribe("TaskCreated", "tenant_a", async () => {
      throw new Error("I fail");
    }, { priority: 10 });

    bus.subscribe("TaskCreated", "tenant_a", async () => {
      received.push("success");
    }, { priority: 5 });

    await bus.publish("TaskCreated", { taskId: "t1" }, ctx);
    expect(received).toEqual(["success"]);
  });
});

describe("TenantAwareEventBus — Reset", () => {
  it("should clear all state on reset", async () => {
    const bus = createTenantEventBus();
    const ctx = createCtxA();

    bus.subscribe("TaskCreated", "tenant_a", async () => {});
    await bus.publish("TaskCreated", { taskId: "t1" }, ctx);

    bus.reset();

    const stats = bus.getStats();
    expect(stats.totalEvents).toBe(0);
    expect(stats.totalSubscriptions).toBe(0);
  });
});

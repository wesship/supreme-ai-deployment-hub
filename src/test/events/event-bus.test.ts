/**
 * D3VONN Event Bus — Test Suite
 *
 * Tests for publish/subscribe, dead-letter queue, replay,
 * middleware, idempotency, and event flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  D3VONNEventBus,
  createEventBus,
  createMetadata,
  createInMemoryStore,
  InMemoryEventStore,
  TypedEvent,
  EventName,
  AnyEvent,
  auditMiddleware,
  rateLimitMiddleware,
  tenantIsolationMiddleware,
} from "../../../shared/events";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function createTaskCreatedEvent(overrides: Partial<any> = {}): TypedEvent<"TaskCreated"> {
  return {
    type: "TaskCreated",
    payload: {
      taskId: "task-001",
      title: "Review code",
      description: "Review the PR for security issues",
      priority: "high",
      keywords: ["code-review", "security"],
      requestedBy: "user-1",
      ...overrides,
    },
    metadata: createMetadata("test", "tenant-1", "ws-1"),
  };
}

function createAgentStartedEvent(overrides: Partial<any> = {}): TypedEvent<"AgentStarted"> {
  return {
    type: "AgentStarted",
    payload: {
      agentId: "code-engineer",
      taskId: "task-001",
      capabilities: ["code-review"],
      model: "gpt-4o",
      ...overrides,
    },
    metadata: createMetadata("code-engineer", "tenant-1", "ws-1"),
  };
}

function createAgentFailedEvent(overrides: Partial<any> = {}): TypedEvent<"AgentFailed"> {
  return {
    type: "AgentFailed",
    payload: {
      agentId: "code-engineer",
      taskId: "task-001",
      error: "Model timeout",
      errorCode: "TIMEOUT",
      retryable: true,
      failedAt: new Date().toISOString(),
      ...overrides,
    },
    metadata: createMetadata("code-engineer", "tenant-1", "ws-1"),
  };
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("D3VONNEventBus", () => {
  let bus: D3VONNEventBus;

  beforeEach(() => {
    bus = createEventBus({ enableIdempotency: false }); // Disable for simpler testing
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  // ─── Publish / Subscribe ─────────────────────────────────────

  describe("publish/subscribe", () => {
    it("should deliver events to subscribers", async () => {
      const received: AnyEvent[] = [];
      bus.subscribe("TaskCreated", (event) => {
        received.push(event as AnyEvent);
      });

      const event = createTaskCreatedEvent();
      const result = await bus.publish(event);

      expect(result.success).toBe(true);
      expect(result.deliveredTo).toBe(1);
      expect(received).toHaveLength(1);
      expect(received[0].payload).toEqual(event.payload);
    });

    it("should deliver to multiple subscribers", async () => {
      let count = 0;
      bus.subscribe("TaskCreated", () => { count++; });
      bus.subscribe("TaskCreated", () => { count++; });
      bus.subscribe("TaskCreated", () => { count++; });

      await bus.publish(createTaskCreatedEvent());
      expect(count).toBe(3);
    });

    it("should not deliver to unrelated subscribers", async () => {
      let called = false;
      bus.subscribe("AgentStarted", () => { called = true; });

      await bus.publish(createTaskCreatedEvent());
      expect(called).toBe(false);
    });

    it("should respect priority ordering", async () => {
      const order: number[] = [];
      bus.subscribe("TaskCreated", () => { order.push(1); }, { priority: 1 });
      bus.subscribe("TaskCreated", () => { order.push(3); }, { priority: 3 });
      bus.subscribe("TaskCreated", () => { order.push(2); }, { priority: 2 });

      await bus.publish(createTaskCreatedEvent());
      expect(order).toEqual([3, 2, 1]);
    });

    it("should support unsubscribe", async () => {
      let count = 0;
      const subId = bus.subscribe("TaskCreated", () => { count++; });

      await bus.publish(createTaskCreatedEvent());
      expect(count).toBe(1);

      bus.unsubscribe(subId);
      await bus.publish(createTaskCreatedEvent());
      expect(count).toBe(1); // Not incremented
    });

    it("should support subscribeMany", async () => {
      let count = 0;
      bus.subscribeMany(["TaskCreated", "AgentStarted"], () => { count++; });

      await bus.publish(createTaskCreatedEvent());
      await bus.publish(createAgentStartedEvent());
      expect(count).toBe(2);
    });
  });

  // ─── Filters ─────────────────────────────────────────────────

  describe("event filters", () => {
    it("should filter by tenantId", async () => {
      let received = false;
      bus.subscribe("TaskCreated", () => { received = true; }, {
        filter: { tenantId: "tenant-2" },
      });

      await bus.publish(createTaskCreatedEvent()); // tenant-1
      expect(received).toBe(false);
    });

    it("should pass matching tenant filter", async () => {
      let received = false;
      bus.subscribe("TaskCreated", () => { received = true; }, {
        filter: { tenantId: "tenant-1" },
      });

      await bus.publish(createTaskCreatedEvent());
      expect(received).toBe(true);
    });

    it("should filter by source", async () => {
      let received = false;
      bus.subscribe("TaskCreated", () => { received = true; }, {
        filter: { source: "hermes" },
      });

      await bus.publish(createTaskCreatedEvent()); // source: "test"
      expect(received).toBe(false);
    });

    it("should filter by payload match", async () => {
      let received = false;
      bus.subscribe("TaskCreated", () => { received = true; }, {
        filter: { payloadMatch: { priority: "critical" } },
      });

      await bus.publish(createTaskCreatedEvent()); // priority: "high"
      expect(received).toBe(false);

      await bus.publish(createTaskCreatedEvent({ priority: "critical" }));
      expect(received).toBe(true);
    });
  });

  // ─── Validation ──────────────────────────────────────────────

  describe("validation", () => {
    it("should reject invalid events when validation is enabled", async () => {
      const validatingBus = createEventBus({ validateOnPublish: true, enableIdempotency: false });

      const invalidEvent = {
        type: "TaskCreated",
        payload: { taskId: "t1" }, // Missing required fields
        metadata: createMetadata("test", "tenant-1", "ws-1"),
      } as any;

      const result = await validatingBus.publish(invalidEvent);
      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.length).toBeGreaterThan(0);

      await validatingBus.shutdown();
    });

    it("should accept valid events", async () => {
      const validatingBus = createEventBus({ validateOnPublish: true, enableIdempotency: false });

      const result = await validatingBus.publish(createTaskCreatedEvent());
      expect(result.success).toBe(true);

      await validatingBus.shutdown();
    });
  });

  // ─── Dead Letter Queue ───────────────────────────────────────

  describe("dead letter queue", () => {
    it("should dead-letter events after max retries", async () => {
      const failingBus = createEventBus({ maxRetries: 0, enableIdempotency: false });

      failingBus.subscribe("TaskCreated", () => {
        throw new Error("Handler failed");
      }, { maxRetries: 0, deadLetterOnFailure: true });

      await failingBus.publish(createTaskCreatedEvent());

      const dlq = failingBus.getDeadLetterQueue();
      expect(dlq.length).toBe(1);
      expect(dlq[0].error).toBe("Handler failed");
      expect(dlq[0].resolved).toBe(false);

      await failingBus.shutdown();
    });

    it("should allow retrying dead-letter entries", async () => {
      const failingBus = createEventBus({ maxRetries: 0, enableIdempotency: false });
      let callCount = 0;

      failingBus.subscribe("TaskCreated", () => {
        callCount++;
        if (callCount === 1) throw new Error("First attempt fails");
        // Second attempt succeeds
      }, { maxRetries: 0, deadLetterOnFailure: true });

      await failingBus.publish(createTaskCreatedEvent());
      expect(failingBus.getDeadLetterQueue().length).toBe(1);

      const retried = await failingBus.retryDeadLetter(0);
      expect(retried).toBe(true);

      await failingBus.shutdown();
    });

    it("should invoke dead-letter callback", async () => {
      const failingBus = createEventBus({ maxRetries: 0, enableIdempotency: false });
      let callbackCalled = false;

      failingBus.onDeadLetterEvent(() => { callbackCalled = true; });
      failingBus.subscribe("TaskCreated", () => {
        throw new Error("fail");
      }, { maxRetries: 0, deadLetterOnFailure: true });

      await failingBus.publish(createTaskCreatedEvent());
      expect(callbackCalled).toBe(true);

      await failingBus.shutdown();
    });
  });

  // ─── Idempotency ────────────────────────────────────────────

  describe("idempotency", () => {
    it("should deduplicate events with the same eventId", async () => {
      const idempotentBus = createEventBus({ enableIdempotency: true });
      let count = 0;
      idempotentBus.subscribe("TaskCreated", () => { count++; });

      const event = createTaskCreatedEvent();
      await idempotentBus.publish(event);
      const result2 = await idempotentBus.publish(event); // Same eventId

      expect(count).toBe(1);
      expect(result2.deduplicated).toBe(true);

      await idempotentBus.shutdown();
    });
  });

  // ─── Event Store & Replay ────────────────────────────────────

  describe("event store and replay", () => {
    it("should persist events to the store", async () => {
      const store = createInMemoryStore();
      bus.setEventStore(store);

      await bus.publish(createTaskCreatedEvent());
      await bus.publish(createAgentStartedEvent());

      expect(store.size).toBe(2);
    });

    it("should replay events from the store", async () => {
      const store = createInMemoryStore();
      bus.setEventStore(store);

      await bus.publish(createTaskCreatedEvent());
      await bus.publish(createAgentStartedEvent());

      // New subscriber added after events were published
      let replayCount = 0;
      bus.subscribe("TaskCreated", () => { replayCount++; });
      bus.subscribe("AgentStarted", () => { replayCount++; });

      const result = await bus.replay();
      expect(result.total).toBe(2);
      expect(result.delivered).toBe(2);
      expect(replayCount).toBe(2);
    });

    it("should replay with filters", async () => {
      const store = createInMemoryStore();
      bus.setEventStore(store);

      await bus.publish(createTaskCreatedEvent());
      await bus.publish(createAgentStartedEvent());
      await bus.publish(createAgentFailedEvent());

      let replayCount = 0;
      bus.subscribe("AgentStarted", () => { replayCount++; });

      const result = await bus.replay({ eventTypes: ["AgentStarted"] });
      expect(result.total).toBe(1);
      expect(result.delivered).toBe(1);
      expect(replayCount).toBe(1);
    });

    it("should throw when replaying without a store", async () => {
      await expect(bus.replay()).rejects.toThrow("No event store configured");
    });
  });

  // ─── Middleware ──────────────────────────────────────────────

  describe("middleware", () => {
    it("should execute middleware in order", async () => {
      const order: string[] = [];

      bus.use(async (_event, next) => {
        order.push("mw1-before");
        await next();
        order.push("mw1-after");
      });

      bus.use(async (_event, next) => {
        order.push("mw2-before");
        await next();
        order.push("mw2-after");
      });

      bus.subscribe("TaskCreated", () => { order.push("handler"); });
      await bus.publish(createTaskCreatedEvent());

      expect(order).toEqual(["mw1-before", "mw2-before", "handler", "mw2-after", "mw1-after"]);
    });

    it("should support audit middleware", async () => {
      const logs: any[] = [];
      bus.use(auditMiddleware((entry) => { logs.push(entry); }));
      bus.subscribe("TaskCreated", () => {});

      await bus.publish(createTaskCreatedEvent());
      expect(logs).toHaveLength(1);
      expect(logs[0].eventType).toBe("TaskCreated");
    });

    it("should support rate limit middleware", async () => {
      const limitedBus = createEventBus({ enableIdempotency: false });
      limitedBus.use(rateLimitMiddleware({ maxPerSecond: 2, perEventType: true }));
      limitedBus.subscribe("TaskCreated", () => {});

      const r1 = await limitedBus.publish(createTaskCreatedEvent());
      const r2 = await limitedBus.publish(createTaskCreatedEvent());
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);

      // Third should be rate limited (throws)
      await expect(limitedBus.publish(createTaskCreatedEvent())).rejects.toThrow("Rate limit exceeded");

      await limitedBus.shutdown();
    });

    it("should support tenant isolation middleware", async () => {
      let delivered = false;
      bus.use(tenantIsolationMiddleware(() => "tenant-2"));
      bus.subscribe("TaskCreated", () => { delivered = true; });

      await bus.publish(createTaskCreatedEvent()); // tenant-1
      expect(delivered).toBe(false);
    });
  });

  // ─── Statistics ──────────────────────────────────────────────

  describe("statistics", () => {
    it("should track publish counts", async () => {
      bus.subscribe("TaskCreated", () => {});
      await bus.publish(createTaskCreatedEvent());
      await bus.publish(createTaskCreatedEvent());

      const stats = bus.getStats();
      expect(stats.totalPublished).toBe(2);
      expect(stats.totalDelivered).toBe(2);
      expect(stats.publishedByType["TaskCreated"]).toBe(2);
    });

    it("should track failure counts", async () => {
      const failBus = createEventBus({ maxRetries: 0, enableIdempotency: false });
      failBus.subscribe("TaskCreated", () => { throw new Error("fail"); }, {
        maxRetries: 0,
      });

      await failBus.publish(createTaskCreatedEvent());
      const stats = failBus.getStats();
      expect(stats.totalFailed).toBe(1);

      await failBus.shutdown();
    });

    it("should report active subscriptions", () => {
      bus.subscribe("TaskCreated", () => {});
      bus.subscribe("AgentStarted", () => {});
      expect(bus.getStats().activeSubscriptions).toBe(2);
    });
  });

  // ─── Lifecycle ───────────────────────────────────────────────

  describe("lifecycle", () => {
    it("should reset cleanly", async () => {
      bus.subscribe("TaskCreated", () => {});
      await bus.publish(createTaskCreatedEvent());

      bus.reset();
      expect(bus.getStats().totalPublished).toBe(0);
      expect(bus.getStats().activeSubscriptions).toBe(0);
    });

    it("should check hasSubscribers", () => {
      expect(bus.hasSubscribers("TaskCreated")).toBe(false);
      bus.subscribe("TaskCreated", () => {});
      expect(bus.hasSubscribers("TaskCreated")).toBe(true);
    });

    it("should unsubscribeAll for a type", () => {
      bus.subscribe("TaskCreated", () => {});
      bus.subscribe("TaskCreated", () => {});
      bus.subscribe("AgentStarted", () => {});

      bus.unsubscribeAll("TaskCreated");
      expect(bus.hasSubscribers("TaskCreated")).toBe(false);
      expect(bus.hasSubscribers("AgentStarted")).toBe(true);
    });
  });

  // ─── Priority Event Flow ────────────────────────────────────

  describe("priority event flow", () => {
    it("should support the full TaskCreated → WorkflowCompleted chain", async () => {
      const store = createInMemoryStore();
      bus.setEventStore(store);
      const flow: EventName[] = [];

      // Subscribe to all events in the chain
      bus.subscribe("TaskCreated", async (event) => {
        flow.push("TaskCreated");
        await bus.publish({
          type: "TaskDelegated",
          payload: {
            taskId: event.payload.taskId,
            delegatedTo: "code-engineer",
            delegatedBy: "hermes",
            confidence: 0.95,
            reasoning: "Best match",
            capabilities: ["code-review"],
          },
          metadata: createMetadata("hermes", "tenant-1", "ws-1", {
            correlationId: event.metadata.correlationId,
            causationId: event.metadata.eventId,
          }),
        });
      });

      bus.subscribe("TaskDelegated", async (event) => {
        flow.push("TaskDelegated");
        await bus.publish({
          type: "AgentStarted",
          payload: {
            agentId: event.payload.delegatedTo,
            taskId: event.payload.taskId,
            capabilities: event.payload.capabilities,
            model: "gpt-4o",
          },
          metadata: createMetadata(event.payload.delegatedTo, "tenant-1", "ws-1", {
            correlationId: event.metadata.correlationId,
            causationId: event.metadata.eventId,
          }),
        });
      });

      bus.subscribe("AgentStarted", async (event) => {
        flow.push("AgentStarted");
        await bus.publish({
          type: "AgentCompleted",
          payload: {
            agentId: event.payload.agentId,
            taskId: event.payload.taskId,
            result: "success",
            outputSummary: "Code review complete",
            durationMs: 5000,
            tokensUsed: 1500,
            toolsUsed: ["code-search", "lint"],
          },
          metadata: createMetadata(event.payload.agentId, "tenant-1", "ws-1", {
            correlationId: event.metadata.correlationId,
            causationId: event.metadata.eventId,
          }),
        });
      });

      bus.subscribe("AgentCompleted", async (event) => {
        flow.push("AgentCompleted");
        await bus.publish({
          type: "WorkflowCompleted",
          payload: {
            workflowId: "wf-001",
            workflowName: "task-orchestration",
            triggeredBy: "TaskCreated",
            stepsCompleted: 4,
            totalSteps: 4,
            result: "success",
            durationMs: 6000,
          },
          metadata: createMetadata("hermes", "tenant-1", "ws-1", {
            correlationId: event.metadata.correlationId,
            causationId: event.metadata.eventId,
          }),
        });
      });

      bus.subscribe("WorkflowCompleted", (event) => {
        flow.push("WorkflowCompleted");
      });

      // Trigger the chain
      await bus.publish(createTaskCreatedEvent());

      expect(flow).toEqual([
        "TaskCreated",
        "TaskDelegated",
        "AgentStarted",
        "AgentCompleted",
        "WorkflowCompleted",
      ]);

      // Verify all events were persisted
      expect(store.size).toBe(5);
    });
  });
});

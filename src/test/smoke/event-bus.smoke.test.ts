/**
 * D3VONN CI Quality Gates — Event Bus Smoke Tests
 *
 * Validates the event bus runtime layer:
 * - Event flow integrity (TaskCreated → ... → WorkflowCompleted)
 * - Dead-letter queue behavior
 * - Replay support
 * - Schema validation
 * - Middleware pipeline
 *
 * @module tests/smoke/event-bus
 * @version 1.0.0
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  D3VONNEventBus,
  createEventBus,
  createMetadata,
  createInMemoryStore,
  InMemoryEventStore,
  TypedEvent,
  AnyEvent,
  EventName,
  PRIORITY_EVENT_FLOW,
  EVENT_NAMES,
} from "../../../shared/events";
import {
  validateEvent,
  validatePayload,
  isValidEventName,
} from "../../../shared/events/event-schema";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function createTaskCreatedEvent(): TypedEvent<"TaskCreated"> {
  return {
    type: "TaskCreated",
    payload: {
      taskId: "smoke-task-001",
      title: "Smoke Test Task",
      description: "Validates event bus flow",
      priority: "high",
      keywords: ["smoke-test", "ci"],
      requestedBy: "ci-pipeline",
    },
    metadata: createMetadata("smoke-test", "tenant-smoke", "ws-smoke"),
  };
}

function createAgentStartedEvent(): TypedEvent<"AgentStarted"> {
  return {
    type: "AgentStarted",
    payload: {
      agentId: "hermes",
      taskId: "smoke-task-001",
      capabilities: ["task-routing"],
      model: "gpt-4o",
    },
    metadata: createMetadata("hermes", "tenant-smoke", "ws-smoke"),
  };
}

function createToolInvokedEvent(): TypedEvent<"ToolInvoked"> {
  return {
    type: "ToolInvoked",
    payload: {
      agentId: "hermes",
      taskId: "smoke-task-001",
      toolName: "web_search",
      toolVersion: "1.0.0",
      input: { query: "test" },
      output: { results: [] },
      durationMs: 150,
      success: true,
    },
    metadata: createMetadata("hermes", "tenant-smoke", "ws-smoke"),
  };
}

function createMemoryUpdatedEvent(): TypedEvent<"MemoryUpdated"> {
  return {
    type: "MemoryUpdated",
    payload: {
      agentId: "hermes",
      memoryType: "episodic",
      operation: "store",
      key: "task_result",
      sizeBytes: 1024,
      ttlSeconds: 3600,
    },
    metadata: createMetadata("hermes", "tenant-smoke", "ws-smoke"),
  };
}

function createWorkflowCompletedEvent(): TypedEvent<"WorkflowCompleted"> {
  return {
    type: "WorkflowCompleted",
    payload: {
      workflowId: "wf-smoke-001",
      workflowName: "Smoke Test Workflow",
      triggeredBy: "TaskCreated",
      stepsCompleted: 5,
      totalSteps: 5,
      result: "success",
      durationMs: 1500,
    },
    metadata: createMetadata("hermes", "tenant-smoke", "ws-smoke"),
  };
}

// ─────────────────────────────────────────────────────────────────
// Priority Event Flow
// ─────────────────────────────────────────────────────────────────

describe("Event Bus Smoke — Priority Flow", () => {
  let bus: D3VONNEventBus;
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = createInMemoryStore();
    bus = createEventBus({ enableIdempotency: false });
    bus.setEventStore(store);
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  it("should execute the full priority event chain", async () => {
    const flow: string[] = [];

    bus.subscribe("TaskCreated", async () => { flow.push("TaskCreated"); });
    bus.subscribe("AgentStarted", async () => { flow.push("AgentStarted"); });
    bus.subscribe("ToolInvoked", async () => { flow.push("ToolInvoked"); });
    bus.subscribe("MemoryUpdated", async () => { flow.push("MemoryUpdated"); });
    bus.subscribe("WorkflowCompleted", async () => { flow.push("WorkflowCompleted"); });

    await bus.publish(createTaskCreatedEvent());
    await bus.publish(createAgentStartedEvent());
    await bus.publish(createToolInvokedEvent());
    await bus.publish(createMemoryUpdatedEvent());
    await bus.publish(createWorkflowCompletedEvent());

    expect(flow).toEqual([
      "TaskCreated",
      "AgentStarted",
      "ToolInvoked",
      "MemoryUpdated",
      "WorkflowCompleted",
    ]);
  });

  it("should persist all events in the store", async () => {
    await bus.publish(createTaskCreatedEvent());
    await bus.publish(createAgentStartedEvent());

    const events = store.getAll();
    expect(events).toHaveLength(2);
    expect(events[0].event.type).toBe("TaskCreated");
    expect(events[1].event.type).toBe("AgentStarted");
  });

  it("should maintain event ordering via sequence numbers", async () => {
    await bus.publish(createTaskCreatedEvent());
    await bus.publish(createAgentStartedEvent());
    await bus.publish(createToolInvokedEvent());

    const events = store.getAll();
    for (let i = 1; i < events.length; i++) {
      expect(events[i].sequenceNumber).toBeGreaterThan(events[i - 1].sequenceNumber);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Dead-Letter Queue
// ─────────────────────────────────────────────────────────────────

describe("Event Bus Smoke — Dead-Letter Queue", () => {
  let bus: D3VONNEventBus;

  beforeEach(() => {
    bus = createEventBus({ maxRetries: 0, enableIdempotency: false });
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  it("should route failed events to DLQ after max retries", async () => {
    bus.subscribe("TaskCreated", async () => {
      throw new Error("Handler failure");
    }, { maxRetries: 0, deadLetterOnFailure: true });

    await bus.publish(createTaskCreatedEvent());

    const dlq = bus.getDeadLetterQueue();
    expect(dlq.length).toBeGreaterThanOrEqual(1);
    expect(dlq[0].error).toContain("Handler failure");
    expect(dlq[0].resolved).toBe(false);
  });

  it("should not route to DLQ when handler succeeds", async () => {
    bus.subscribe("TaskCreated", async () => {
      // Success - no throw
    });

    await bus.publish(createTaskCreatedEvent());

    const dlq = bus.getDeadLetterQueue();
    expect(dlq).toHaveLength(0);
  });

  it("should allow DLQ retry", async () => {
    let shouldFail = true;
    bus.subscribe("TaskCreated", async () => {
      if (shouldFail) throw new Error("Temporary failure");
    }, { maxRetries: 0, deadLetterOnFailure: true });

    await bus.publish(createTaskCreatedEvent());
    expect(bus.getDeadLetterQueue()).toHaveLength(1);

    // Fix the handler and retry
    shouldFail = false;
    const result = await bus.retryDeadLetter(0);
    expect(result).toBe(true);
    expect(bus.getDeadLetterQueue().filter((e) => !e.resolved)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Event Replay
// ─────────────────────────────────────────────────────────────────

describe("Event Bus Smoke — Replay", () => {
  let bus: D3VONNEventBus;
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = createInMemoryStore();
    bus = createEventBus({ enableIdempotency: false });
    bus.setEventStore(store);
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  it("should replay events from store", async () => {
    // Publish events
    await bus.publish(createTaskCreatedEvent());
    await bus.publish(createAgentStartedEvent());

    // Add a new subscriber after events were published
    const replayed: AnyEvent[] = [];
    bus.subscribe("TaskCreated", async (event) => {
      replayed.push(event as AnyEvent);
    });

    // Replay from store
    const result = await bus.replay({ eventTypes: ["TaskCreated"] });
    expect(result.delivered).toBeGreaterThanOrEqual(1);
    expect(replayed.length).toBeGreaterThanOrEqual(1);
  });

  it("should replay events in chronological order", async () => {
    await bus.publish(createTaskCreatedEvent());
    await bus.publish(createAgentStartedEvent());
    await bus.publish(createToolInvokedEvent());

    const replayed: string[] = [];
    bus.subscribe("TaskCreated", async () => { replayed.push("TaskCreated"); });
    bus.subscribe("AgentStarted", async () => { replayed.push("AgentStarted"); });
    bus.subscribe("ToolInvoked", async () => { replayed.push("ToolInvoked"); });

    await bus.replay({});
    expect(replayed).toEqual(["TaskCreated", "AgentStarted", "ToolInvoked"]);
  });
});

// ─────────────────────────────────────────────────────────────────
// Schema Validation
// ─────────────────────────────────────────────────────────────────

describe("Event Bus Smoke — Schema Validation", () => {
  it("should validate all 14 event type names", () => {
    expect(EVENT_NAMES).toHaveLength(14);
    for (const name of EVENT_NAMES) {
      expect(isValidEventName(name)).toBe(true);
    }
  });

  it("should reject invalid event type names", () => {
    expect(isValidEventName("InvalidEvent")).toBe(false);
    expect(isValidEventName("")).toBe(false);
    expect(isValidEventName(null)).toBe(false);
  });

  it("should accept valid TaskCreated event", () => {
    const event = createTaskCreatedEvent();
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject invalid TaskCreated payload", () => {
    const result = validatePayload("TaskCreated", { taskId: "t1" }); // missing required fields
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should accept valid AgentStarted event", () => {
    const event = createAgentStartedEvent();
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("should accept valid WorkflowCompleted event", () => {
    const event = createWorkflowCompletedEvent();
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("should reject event with missing metadata", () => {
    const event = {
      type: "TaskCreated",
      payload: {
        taskId: "t1",
        title: "Test",
        description: "Test",
        priority: "high",
        keywords: [],
        requestedBy: "test",
      },
      // metadata missing
    };
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Priority Flow Definition
// ─────────────────────────────────────────────────────────────────

describe("Event Bus Smoke — Flow Definitions", () => {
  it("should have a defined priority event flow", () => {
    expect(PRIORITY_EVENT_FLOW).toBeDefined();
    expect(PRIORITY_EVENT_FLOW.length).toBeGreaterThanOrEqual(5);
  });

  it("should start with TaskCreated", () => {
    expect(PRIORITY_EVENT_FLOW[0]).toBe("TaskCreated");
  });

  it("should end with WorkflowCompleted", () => {
    expect(PRIORITY_EVENT_FLOW[PRIORITY_EVENT_FLOW.length - 1]).toBe("WorkflowCompleted");
  });

  it("should have all flow events be valid event names", () => {
    for (const name of PRIORITY_EVENT_FLOW) {
      expect(isValidEventName(name)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Event Bus Statistics
// ─────────────────────────────────────────────────────────────────

describe("Event Bus Smoke — Statistics", () => {
  let bus: D3VONNEventBus;

  beforeEach(() => {
    bus = createEventBus({ enableIdempotency: false });
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  it("should track event counts by type", async () => {
    await bus.publish(createTaskCreatedEvent());
    await bus.publish(createTaskCreatedEvent());
    await bus.publish(createAgentStartedEvent());

    const stats = bus.getStats();
    expect(stats.totalPublished).toBe(3);
    expect(stats.publishedByType["TaskCreated"]).toBe(2);
    expect(stats.publishedByType["AgentStarted"]).toBe(1);
  });

  it("should track subscriber counts", () => {
    bus.subscribe("TaskCreated", async () => {});
    bus.subscribe("TaskCreated", async () => {});
    bus.subscribe("AgentStarted", async () => {});

    const stats = bus.getStats();
    expect(stats.activeSubscriptions).toBe(3);
  });

  it("should track DLQ size", async () => {
    bus.subscribe("TaskCreated", async () => {
      throw new Error("fail");
    }, { maxRetries: 0, deadLetterOnFailure: true });

    await bus.publish(createTaskCreatedEvent());

    const stats = bus.getStats();
    expect(stats.deadLetterQueueSize).toBeGreaterThanOrEqual(1);
  });
});

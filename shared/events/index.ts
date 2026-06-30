/**
 * D3VONN Event Bus — Module Entry Point
 *
 * The typed event bus runtime for the D3VONN platform.
 * Provides publish/subscribe, persistence, replay, dead-letter handling,
 * and security audit logging for all 14 platform events.
 *
 * @module shared/events
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import { createEventBus, createMetadata, createInMemoryStore } from "@/shared/events";
 *
 * const bus = createEventBus();
 * bus.setEventStore(createInMemoryStore());
 *
 * // Subscribe
 * bus.subscribe("TaskCreated", async (event) => {
 *   console.log(`New task: ${event.payload.title}`);
 * });
 *
 * // Publish
 * await bus.publish({
 *   type: "TaskCreated",
 *   payload: { taskId: "t1", title: "Review PR", ... },
 *   metadata: createMetadata("hermes", "tenant-1", "ws-1"),
 * });
 * ```
 */

// ─── Types ───────────────────────────────────────────────────────
export type {
  EventId,
  TenantId,
  WorkspaceId,
  AgentId,
  CorrelationId,
  Timestamp,
  EventMetadata,
  BaseEvent,
  EventName,
  TypedEvent,
  AnyEvent,
  EventHandler,
  Subscription,
  EventFilter,
  DeadLetterEntry,
  EventStoreEntry,
  ReplayOptions,
  // Payload types
  TaskCreatedPayload,
  TaskDelegatedPayload,
  TaskCompletedPayload,
  AgentStartedPayload,
  AgentCompletedPayload,
  AgentFailedPayload,
  ToolInvokedPayload,
  MemoryUpdatedPayload,
  KnowledgeIndexedPayload,
  SecurityAlertRaisedPayload,
  GovernanceViolationPayload,
  DeploymentStartedPayload,
  DeploymentFinishedPayload,
  WorkflowCompletedPayload,
  EventPayloadMap,
} from "./event-types";

export { EVENT_NAMES, PRIORITY_EVENT_FLOW, ERROR_EVENT_FLOW } from "./event-types";

// ─── Event Bus ───────────────────────────────────────────────────
export {
  D3VONNEventBus,
  createEventBus,
  createMetadata,
} from "./event-bus";

export type {
  EventBusConfig,
  EventBusStats,
  EventMiddleware,
  EventStoreAdapter,
  PublishResult,
  ReplayResult,
  SubscribeOptions,
} from "./event-bus";

// ─── Schema Validation ──────────────────────────────────────────
export {
  validateEvent,
  validatePayload,
  validateMetadata,
  isValidEventName,
  getPayloadFields,
} from "./event-schema";

export type { ValidationResult, ValidationError } from "./event-schema";

// ─── Event Store ─────────────────────────────────────────────────
export {
  InMemoryEventStore,
  FileEventStore,
  PartitionedEventStore,
  createInMemoryStore,
  createFileStore,
  createPartitionedStore,
} from "./event-store";

// ─── Handlers ────────────────────────────────────────────────────
export {
  EventHandlerRegistry,
  createTaskDelegationHandler,
  createAgentLifecycleHandler,
  createAgentFailureHandler,
  createMemoryPersistenceHandler,
  createSecurityAuditHandler,
  createWorkflowTriggerHandler,
  registerDefaultHandlers,
} from "./event-handlers";

export type {
  HandlerRegistration,
  AgentRouter,
  AgentLifecycle,
  WorkflowEngine,
  MemorySystem,
  AuditLogger,
  AuditEntry,
} from "./event-handlers";

// ─── Convenience: Audit Logging Middleware ───────────────────────

import { EventMiddleware } from "./event-bus";
import { AnyEvent } from "./event-types";

/**
 * Security audit logging middleware.
 * Logs every event that passes through the bus for compliance.
 * Attach with: bus.use(auditMiddleware(logger))
 */
export function auditMiddleware(
  logFn: (entry: {
    timestamp: string;
    eventType: string;
    eventId: string;
    tenantId: string;
    source: string;
    correlationId: string;
  }) => void | Promise<void>
): EventMiddleware {
  return async (event: AnyEvent, next: () => Promise<void>) => {
    // Log before delivery
    await logFn({
      timestamp: event.metadata.timestamp,
      eventType: event.type,
      eventId: event.metadata.eventId,
      tenantId: event.metadata.tenantId,
      source: event.metadata.source,
      correlationId: event.metadata.correlationId,
    });

    // Continue pipeline
    await next();
  };
}

/**
 * Tenant isolation middleware.
 * Ensures events are only delivered to subscribers matching the tenant.
 */
export function tenantIsolationMiddleware(
  getCurrentTenantId: () => string | null
): EventMiddleware {
  return async (event: AnyEvent, next: () => Promise<void>) => {
    const currentTenant = getCurrentTenantId();
    // System events (no tenant) always pass through
    if (!currentTenant || event.metadata.tenantId === currentTenant) {
      await next();
    }
    // Silently drop events for other tenants
  };
}

/**
 * Rate limiting middleware.
 * Prevents event storms by throttling publish rate per event type.
 */
export function rateLimitMiddleware(options: {
  maxPerSecond: number;
  perEventType?: boolean;
}): EventMiddleware {
  const counters: Map<string, { count: number; resetAt: number }> = new Map();

  return async (event: AnyEvent, next: () => Promise<void>) => {
    const key = options.perEventType ? event.type : "__global__";
    const now = Date.now();
    const counter = counters.get(key);

    if (!counter || now >= counter.resetAt) {
      counters.set(key, { count: 1, resetAt: now + 1000 });
      await next();
    } else if (counter.count < options.maxPerSecond) {
      counter.count++;
      await next();
    } else {
      // Rate limited — drop silently or throw
      throw new Error(
        `Rate limit exceeded for ${key}: ${options.maxPerSecond}/s`
      );
    }
  };
}

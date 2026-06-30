/**
 * D3VONN Event Bus — Event Handlers
 *
 * Pre-built handlers for the priority event flow chain.
 * Connects agents, workflows, security audit, and memory systems
 * to the event bus.
 *
 * Priority flow:
 * TaskCreated → TaskDelegated → AgentStarted → ToolInvoked
 *   → MemoryUpdated → AgentCompleted → WorkflowCompleted
 *
 * @module shared/events/event-handlers
 * @version 1.0.0
 */

import {
  EventName,
  TypedEvent,
  EventHandler,
  AnyEvent,
  TaskCreatedPayload,
  TaskDelegatedPayload,
  AgentStartedPayload,
  AgentCompletedPayload,
  AgentFailedPayload,
  ToolInvokedPayload,
  MemoryUpdatedPayload,
  SecurityAlertRaisedPayload,
  GovernanceViolationPayload,
  DeploymentStartedPayload,
  DeploymentFinishedPayload,
  WorkflowCompletedPayload,
} from "./event-types";
import { D3VONNEventBus, createMetadata } from "./event-bus";

// ─────────────────────────────────────────────────────────────────
// Handler Registry
// ─────────────────────────────────────────────────────────────────

export interface HandlerRegistration {
  eventType: EventName;
  handler: EventHandler<any>;
  name: string;
  description: string;
  priority: number;
}

/**
 * Registry of all platform event handlers.
 * Handlers are registered by name and can be enabled/disabled.
 */
export class EventHandlerRegistry {
  private handlers: Map<string, HandlerRegistration> = new Map();
  private bus: D3VONNEventBus;
  private subscriptionIds: Map<string, string> = new Map();

  constructor(bus: D3VONNEventBus) {
    this.bus = bus;
  }

  /** Register a named handler */
  register(registration: HandlerRegistration): void {
    this.handlers.set(registration.name, registration);
  }

  /** Enable a registered handler (subscribe to bus) */
  enable(name: string): boolean {
    const reg = this.handlers.get(name);
    if (!reg) return false;
    if (this.subscriptionIds.has(name)) return true; // Already enabled

    const subId = this.bus.subscribe(reg.eventType, reg.handler, {
      priority: reg.priority,
    });
    this.subscriptionIds.set(name, subId);
    return true;
  }

  /** Disable a handler (unsubscribe from bus) */
  disable(name: string): boolean {
    const subId = this.subscriptionIds.get(name);
    if (!subId) return false;
    this.bus.unsubscribe(subId);
    this.subscriptionIds.delete(name);
    return true;
  }

  /** Enable all registered handlers */
  enableAll(): void {
    for (const name of this.handlers.keys()) {
      this.enable(name);
    }
  }

  /** Disable all handlers */
  disableAll(): void {
    for (const name of this.subscriptionIds.keys()) {
      this.disable(name);
    }
  }

  /** Get all registered handler names */
  getRegistered(): string[] {
    return [...this.handlers.keys()];
  }

  /** Get all enabled handler names */
  getEnabled(): string[] {
    return [...this.subscriptionIds.keys()];
  }
}

// ─────────────────────────────────────────────────────────────────
// Agent Event Handlers
// ─────────────────────────────────────────────────────────────────

export interface AgentRouter {
  /** Route a task to the best agent based on keywords */
  routeTask(taskId: string, keywords: string[]): Promise<{
    agentId: string;
    confidence: number;
    reasoning: string;
    capabilities: string[];
  }>;
}

export interface AgentLifecycle {
  /** Start an agent for a task */
  startAgent(agentId: string, taskId: string): Promise<void>;
  /** Stop an agent */
  stopAgent(agentId: string, taskId: string): Promise<void>;
  /** Get agent status */
  getAgentStatus(agentId: string): Promise<"idle" | "running" | "failed" | "stopped">;
}

/**
 * Creates the Hermes task delegation handler.
 * When a TaskCreated event arrives, Hermes routes it to the best agent.
 */
export function createTaskDelegationHandler(
  bus: D3VONNEventBus,
  router: AgentRouter
): HandlerRegistration {
  const handler: EventHandler<"TaskCreated"> = async (event) => {
    const { taskId, keywords, priority } = event.payload;
    const { tenantId, workspaceId, correlationId } = event.metadata;

    // Route the task
    const routing = await router.routeTask(taskId, keywords);

    // Emit TaskDelegated event
    const delegatedEvent: TypedEvent<"TaskDelegated"> = {
      type: "TaskDelegated",
      payload: {
        taskId,
        delegatedTo: routing.agentId,
        delegatedBy: "hermes",
        confidence: routing.confidence,
        reasoning: routing.reasoning,
        capabilities: routing.capabilities,
      },
      metadata: createMetadata("hermes", tenantId, workspaceId, {
        correlationId,
        causationId: event.metadata.eventId,
      }),
    };

    await bus.publish(delegatedEvent);
  };

  return {
    eventType: "TaskCreated",
    handler,
    name: "hermes.task-delegation",
    description: "Routes new tasks to the best available agent via Hermes",
    priority: 100,
  };
}

/**
 * Creates the agent lifecycle handler.
 * When a TaskDelegated event arrives, starts the assigned agent.
 */
export function createAgentLifecycleHandler(
  bus: D3VONNEventBus,
  lifecycle: AgentLifecycle
): HandlerRegistration {
  const handler: EventHandler<"TaskDelegated"> = async (event) => {
    const { taskId, delegatedTo, capabilities } = event.payload;
    const { tenantId, workspaceId, correlationId } = event.metadata;

    // Start the agent
    await lifecycle.startAgent(delegatedTo, taskId);

    // Emit AgentStarted event
    const startedEvent: TypedEvent<"AgentStarted"> = {
      type: "AgentStarted",
      payload: {
        agentId: delegatedTo,
        taskId,
        capabilities,
        model: "gpt-4o", // Default, would be resolved from agent manifest
        estimatedDurationMs: 30000,
      },
      metadata: createMetadata(delegatedTo, tenantId, workspaceId, {
        correlationId,
        causationId: event.metadata.eventId,
      }),
    };

    await bus.publish(startedEvent);
  };

  return {
    eventType: "TaskDelegated",
    handler,
    name: "agent.lifecycle-start",
    description: "Starts the delegated agent when a task is assigned",
    priority: 90,
  };
}

/**
 * Creates the agent failure handler.
 * When an AgentFailed event arrives, handles retry or escalation.
 */
export function createAgentFailureHandler(
  bus: D3VONNEventBus,
  router: AgentRouter
): HandlerRegistration {
  const handler: EventHandler<"AgentFailed"> = async (event) => {
    const { agentId, taskId, error, retryable } = event.payload;
    const { tenantId, workspaceId, correlationId } = event.metadata;

    if (!retryable) {
      // Raise security alert for non-retryable failures
      const alertEvent: TypedEvent<"SecurityAlertRaised"> = {
        type: "SecurityAlertRaised",
        payload: {
          alertId: `alert_${Date.now()}`,
          severity: "high",
          category: "agent-failure",
          description: `Agent ${agentId} failed non-retryably on task ${taskId}: ${error}`,
          affectedEntity: agentId,
          detectedBy: "event-bus",
          evidence: { taskId, error, agentId },
          mitigationRequired: true,
        },
        metadata: createMetadata("event-bus", tenantId, workspaceId, {
          correlationId,
          causationId: event.metadata.eventId,
        }),
      };

      await bus.publish(alertEvent);
    }
  };

  return {
    eventType: "AgentFailed",
    handler,
    name: "agent.failure-escalation",
    description: "Escalates non-retryable agent failures to security alerts",
    priority: 95,
  };
}

// ─────────────────────────────────────────────────────────────────
// Workflow Trigger Handlers
// ─────────────────────────────────────────────────────────────────

export interface WorkflowEngine {
  /** Trigger a workflow by name */
  trigger(workflowName: string, context: Record<string, unknown>): Promise<string>;
  /** Get workflow status */
  getStatus(workflowId: string): Promise<"running" | "completed" | "failed">;
}

/**
 * Creates workflow trigger handlers that fire workflows based on events.
 */
export function createWorkflowTriggerHandler(
  bus: D3VONNEventBus,
  engine: WorkflowEngine,
  triggers: { eventType: EventName; workflowName: string }[]
): HandlerRegistration[] {
  return triggers.map((trigger) => {
    const handler: EventHandler<any> = async (event: AnyEvent) => {
      const { tenantId, workspaceId, correlationId } = event.metadata;

      const workflowId = await engine.trigger(trigger.workflowName, {
        triggerEvent: event.type,
        payload: event.payload,
        correlationId,
      });

      // Note: WorkflowCompleted will be emitted by the workflow engine
      // when the workflow finishes
    };

    return {
      eventType: trigger.eventType,
      handler,
      name: `workflow.trigger.${trigger.workflowName}`,
      description: `Triggers ${trigger.workflowName} workflow on ${trigger.eventType}`,
      priority: 50,
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// Memory Update Handler
// ─────────────────────────────────────────────────────────────────

export interface MemorySystem {
  /** Store a memory entry */
  store(agentId: string, key: string, value: unknown, type: string): Promise<void>;
  /** Update a memory entry */
  update(agentId: string, key: string, value: unknown): Promise<void>;
}

/**
 * Creates a handler that persists agent tool invocations to memory.
 */
export function createMemoryPersistenceHandler(
  bus: D3VONNEventBus,
  memory: MemorySystem
): HandlerRegistration {
  const handler: EventHandler<"ToolInvoked"> = async (event) => {
    const { agentId, taskId, toolName, output, success } = event.payload;
    const { tenantId, workspaceId, correlationId } = event.metadata;

    if (success && output) {
      await memory.store(agentId, `tool:${toolName}:${taskId}`, output, "episodic");

      // Emit MemoryUpdated
      const memoryEvent: TypedEvent<"MemoryUpdated"> = {
        type: "MemoryUpdated",
        payload: {
          agentId,
          memoryType: "episodic",
          operation: "store",
          key: `tool:${toolName}:${taskId}`,
          sizeBytes: JSON.stringify(output).length,
          ttlSeconds: 86400, // 24h default
        },
        metadata: createMetadata(agentId, tenantId, workspaceId, {
          correlationId,
          causationId: event.metadata.eventId,
        }),
      };

      await bus.publish(memoryEvent);
    }
  };

  return {
    eventType: "ToolInvoked",
    handler,
    name: "memory.tool-persistence",
    description: "Persists successful tool invocation results to agent memory",
    priority: 40,
  };
}

// ─────────────────────────────────────────────────────────────────
// Security Audit Handler
// ─────────────────────────────────────────────────────────────────

export interface AuditLogger {
  /** Log an audit entry */
  log(entry: AuditEntry): Promise<void>;
}

export interface AuditEntry {
  timestamp: string;
  eventType: EventName;
  eventId: string;
  tenantId: string;
  workspaceId: string;
  source: string;
  action: string;
  outcome: "success" | "failure" | "blocked";
  details: Record<string, unknown>;
}

/**
 * Creates a security audit handler that logs all security-relevant events.
 */
export function createSecurityAuditHandler(
  bus: D3VONNEventBus,
  logger: AuditLogger
): HandlerRegistration[] {
  const securityEvents: EventName[] = [
    "SecurityAlertRaised",
    "GovernanceViolation",
    "AgentFailed",
    "DeploymentStarted",
    "DeploymentFinished",
  ];

  return securityEvents.map((eventType) => {
    const handler: EventHandler<any> = async (event: AnyEvent) => {
      const entry: AuditEntry = {
        timestamp: event.metadata.timestamp,
        eventType: event.type,
        eventId: event.metadata.eventId,
        tenantId: event.metadata.tenantId,
        workspaceId: event.metadata.workspaceId,
        source: event.metadata.source,
        action: event.type,
        outcome: determineOutcome(event),
        details: event.payload as Record<string, unknown>,
      };

      await logger.log(entry);
    };

    return {
      eventType,
      handler,
      name: `security.audit.${eventType}`,
      description: `Audit logs ${eventType} events for compliance`,
      priority: 200, // Highest priority — audit always runs first
    };
  });
}

function determineOutcome(event: AnyEvent): "success" | "failure" | "blocked" {
  switch (event.type) {
    case "AgentFailed":
      return "failure";
    case "GovernanceViolation":
      return (event.payload as any).autoRemediated ? "blocked" : "failure";
    case "SecurityAlertRaised":
      return "failure";
    case "DeploymentFinished":
      return (event.payload as any).result === "success" ? "success" : "failure";
    default:
      return "success";
  }
}

// ─────────────────────────────────────────────────────────────────
// Default Handler Setup
// ─────────────────────────────────────────────────────────────────

/**
 * Register all default platform handlers on a bus.
 * This is the standard setup for the D3VONN platform.
 */
export function registerDefaultHandlers(
  bus: D3VONNEventBus,
  dependencies: {
    router: AgentRouter;
    lifecycle: AgentLifecycle;
    memory: MemorySystem;
    auditLogger: AuditLogger;
    workflowEngine?: WorkflowEngine;
  }
): EventHandlerRegistry {
  const registry = new EventHandlerRegistry(bus);

  // Core handlers
  registry.register(createTaskDelegationHandler(bus, dependencies.router));
  registry.register(createAgentLifecycleHandler(bus, dependencies.lifecycle));
  registry.register(createAgentFailureHandler(bus, dependencies.router));
  registry.register(createMemoryPersistenceHandler(bus, dependencies.memory));

  // Security audit
  const auditHandlers = createSecurityAuditHandler(bus, dependencies.auditLogger);
  for (const handler of auditHandlers) {
    registry.register(handler);
  }

  // Workflow triggers (if engine provided)
  if (dependencies.workflowEngine) {
    const workflowHandlers = createWorkflowTriggerHandler(bus, dependencies.workflowEngine, [
      { eventType: "TaskCreated", workflowName: "task-orchestration" },
      { eventType: "SecurityAlertRaised", workflowName: "incident-response" },
      { eventType: "DeploymentStarted", workflowName: "deployment-pipeline" },
      { eventType: "GovernanceViolation", workflowName: "governance-remediation" },
    ]);
    for (const handler of workflowHandlers) {
      registry.register(handler);
    }
  }

  // Enable all by default
  registry.enableAll();

  return registry;
}

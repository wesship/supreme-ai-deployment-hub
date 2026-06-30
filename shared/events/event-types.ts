/**
 * D3VONN Event Bus — Typed Event Definitions
 *
 * All 14 platform events defined in the Knowledge Graph, plus the priority
 * event flow chain. Each event carries a typed payload, metadata envelope,
 * and correlation context for distributed tracing.
 *
 * @module shared/events/event-types
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Core Envelope
// ─────────────────────────────────────────────────────────────────

export type EventId = string;
export type TenantId = string;
export type WorkspaceId = string;
export type AgentId = string;
export type CorrelationId = string;
export type Timestamp = string; // ISO 8601

export interface EventMetadata {
  /** Unique event ID (UUID v4) */
  eventId: EventId;
  /** ISO 8601 timestamp of event creation */
  timestamp: Timestamp;
  /** Correlation ID for distributed tracing */
  correlationId: CorrelationId;
  /** Causation ID — the event that caused this one */
  causationId?: EventId;
  /** Tenant context */
  tenantId: TenantId;
  /** Workspace context */
  workspaceId: WorkspaceId;
  /** Source agent or system component */
  source: string;
  /** Schema version for forward compatibility */
  schemaVersion: string;
  /** Retry count (0 = first attempt) */
  retryCount: number;
  /** Maximum retries before dead-letter */
  maxRetries: number;
}

export interface BaseEvent<T extends EventName = EventName, P = unknown> {
  /** Event type discriminator */
  type: T;
  /** Typed payload */
  payload: P;
  /** Event metadata envelope */
  metadata: EventMetadata;
}

// ─────────────────────────────────────────────────────────────────
// Event Names (from Knowledge Graph)
// ─────────────────────────────────────────────────────────────────

export const EVENT_NAMES = [
  "TaskCreated",
  "TaskDelegated",
  "TaskCompleted",
  "AgentStarted",
  "AgentCompleted",
  "AgentFailed",
  "ToolInvoked",
  "MemoryUpdated",
  "KnowledgeIndexed",
  "SecurityAlertRaised",
  "GovernanceViolation",
  "DeploymentStarted",
  "DeploymentFinished",
  "WorkflowCompleted",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

// ─────────────────────────────────────────────────────────────────
// Event Payloads
// ─────────────────────────────────────────────────────────────────

export interface TaskCreatedPayload {
  taskId: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  keywords: string[];
  requestedBy: string;
  deadline?: Timestamp;
}

export interface TaskDelegatedPayload {
  taskId: string;
  delegatedTo: AgentId;
  delegatedBy: AgentId;
  confidence: number;
  reasoning: string;
  capabilities: string[];
}

export interface TaskCompletedPayload {
  taskId: string;
  completedBy: AgentId;
  result: "success" | "partial" | "failed";
  artifacts: string[];
  durationMs: number;
  tokensUsed?: number;
}

export interface AgentStartedPayload {
  agentId: AgentId;
  taskId: string;
  capabilities: string[];
  model: string;
  estimatedDurationMs?: number;
}

export interface AgentCompletedPayload {
  agentId: AgentId;
  taskId: string;
  result: "success" | "partial";
  outputSummary: string;
  durationMs: number;
  tokensUsed: number;
  toolsUsed: string[];
}

export interface AgentFailedPayload {
  agentId: AgentId;
  taskId: string;
  error: string;
  errorCode: string;
  retryable: boolean;
  failedAt: string;
  stackTrace?: string;
}

export interface ToolInvokedPayload {
  agentId: AgentId;
  taskId: string;
  toolName: string;
  toolVersion: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface MemoryUpdatedPayload {
  agentId: AgentId;
  memoryType: "short-term" | "long-term" | "episodic" | "semantic";
  operation: "store" | "update" | "delete" | "consolidate";
  key: string;
  sizeBytes: number;
  ttlSeconds?: number;
}

export interface KnowledgeIndexedPayload {
  moduleId: string;
  documentId: string;
  title: string;
  source: string;
  chunkCount: number;
  embeddingModel: string;
  indexedBy: AgentId;
}

export interface SecurityAlertRaisedPayload {
  alertId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  description: string;
  affectedEntity: string;
  detectedBy: string;
  evidence: Record<string, unknown>;
  mitigationRequired: boolean;
}

export interface GovernanceViolationPayload {
  violationId: string;
  policyId: string;
  policyName: string;
  violatedBy: AgentId;
  action: string;
  severity: "critical" | "high" | "medium" | "low";
  autoRemediated: boolean;
  details: string;
}

export interface DeploymentStartedPayload {
  deploymentId: string;
  environment: "development" | "staging" | "production";
  service: string;
  version: string;
  initiatedBy: AgentId | string;
  strategy: "rolling" | "blue-green" | "canary";
}

export interface DeploymentFinishedPayload {
  deploymentId: string;
  environment: "development" | "staging" | "production";
  service: string;
  version: string;
  result: "success" | "rolled-back" | "failed";
  durationMs: number;
  healthChecksPassed: boolean;
}

export interface WorkflowCompletedPayload {
  workflowId: string;
  workflowName: string;
  triggeredBy: EventName;
  stepsCompleted: number;
  totalSteps: number;
  result: "success" | "partial" | "failed";
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────
// Typed Event Map
// ─────────────────────────────────────────────────────────────────

export interface EventPayloadMap {
  TaskCreated: TaskCreatedPayload;
  TaskDelegated: TaskDelegatedPayload;
  TaskCompleted: TaskCompletedPayload;
  AgentStarted: AgentStartedPayload;
  AgentCompleted: AgentCompletedPayload;
  AgentFailed: AgentFailedPayload;
  ToolInvoked: ToolInvokedPayload;
  MemoryUpdated: MemoryUpdatedPayload;
  KnowledgeIndexed: KnowledgeIndexedPayload;
  SecurityAlertRaised: SecurityAlertRaisedPayload;
  GovernanceViolation: GovernanceViolationPayload;
  DeploymentStarted: DeploymentStartedPayload;
  DeploymentFinished: DeploymentFinishedPayload;
  WorkflowCompleted: WorkflowCompletedPayload;
}

/** Fully typed event for a given event name */
export type TypedEvent<T extends EventName> = BaseEvent<T, EventPayloadMap[T]>;

/** Union of all possible typed events */
export type AnyEvent = {
  [K in EventName]: TypedEvent<K>;
}[EventName];

// ─────────────────────────────────────────────────────────────────
// Priority Event Flow Chain
// ─────────────────────────────────────────────────────────────────

/**
 * The canonical event flow for task execution:
 *
 * TaskCreated → TaskDelegated → AgentStarted → ToolInvoked
 *   → MemoryUpdated → AgentCompleted → WorkflowCompleted
 *
 * With error branch:
 * AgentStarted → AgentFailed → SecurityAlertRaised (if retryable=false)
 */
export const PRIORITY_EVENT_FLOW: readonly EventName[] = [
  "TaskCreated",
  "TaskDelegated",
  "AgentStarted",
  "ToolInvoked",
  "MemoryUpdated",
  "AgentCompleted",
  "WorkflowCompleted",
] as const;

export const ERROR_EVENT_FLOW: readonly EventName[] = [
  "AgentStarted",
  "AgentFailed",
  "SecurityAlertRaised",
  "GovernanceViolation",
] as const;

// ─────────────────────────────────────────────────────────────────
// Event Subscription Types
// ─────────────────────────────────────────────────────────────────

export type EventHandler<T extends EventName = EventName> = (
  event: TypedEvent<T>
) => Promise<void> | void;

export interface Subscription {
  id: string;
  eventType: EventName;
  handler: EventHandler<any>;
  filter?: EventFilter;
  priority: number;
  maxRetries: number;
  timeoutMs: number;
  deadLetterOnFailure: boolean;
}

export interface EventFilter {
  tenantId?: TenantId;
  workspaceId?: WorkspaceId;
  source?: string;
  /** JSONPath-style payload filter */
  payloadMatch?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────
// Dead Letter
// ─────────────────────────────────────────────────────────────────

export interface DeadLetterEntry {
  event: AnyEvent;
  subscriptionId: string;
  error: string;
  failedAt: Timestamp;
  retryCount: number;
  resolved: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Event Store Types
// ─────────────────────────────────────────────────────────────────

export interface EventStoreEntry {
  sequenceNumber: number;
  event: AnyEvent;
  storedAt: Timestamp;
  partition: string;
}

export interface ReplayOptions {
  fromSequence?: number;
  toSequence?: number;
  fromTimestamp?: Timestamp;
  toTimestamp?: Timestamp;
  eventTypes?: EventName[];
  tenantId?: TenantId;
  correlationId?: CorrelationId;
}

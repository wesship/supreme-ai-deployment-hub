/**
 * D3VONN Event Bus — Runtime Schema Validation
 *
 * Provides runtime validation for event payloads using a lightweight
 * schema system. Ensures type safety at runtime boundaries (API ingress,
 * deserialization, replay).
 *
 * @module shared/events/event-schema
 * @version 1.0.0
 */

import {
  EventName,
  EVENT_NAMES,
  AnyEvent,
  EventMetadata,
  BaseEvent,
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
} from "./event-types";

// ─────────────────────────────────────────────────────────────────
// Validation Result
// ─────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  expected?: string;
  received?: string;
}

// ─────────────────────────────────────────────────────────────────
// Schema Definitions (Lightweight Runtime Validators)
// ─────────────────────────────────────────────────────────────────

type Validator = (value: unknown, path: string) => ValidationError[];

function required(field: string, type: string): Validator {
  return (value: unknown, path: string) => {
    const obj = value as Record<string, unknown>;
    const fieldPath = `${path}.${field}`;
    if (obj[field] === undefined || obj[field] === null) {
      return [{ path: fieldPath, message: `Required field missing`, expected: type }];
    }
    if (type === "string" && typeof obj[field] !== "string") {
      return [{ path: fieldPath, message: `Expected string`, expected: "string", received: typeof obj[field] }];
    }
    if (type === "number" && typeof obj[field] !== "number") {
      return [{ path: fieldPath, message: `Expected number`, expected: "number", received: typeof obj[field] }];
    }
    if (type === "boolean" && typeof obj[field] !== "boolean") {
      return [{ path: fieldPath, message: `Expected boolean`, expected: "boolean", received: typeof obj[field] }];
    }
    if (type === "object" && (typeof obj[field] !== "object" || obj[field] === null)) {
      return [{ path: fieldPath, message: `Expected object`, expected: "object", received: typeof obj[field] }];
    }
    if (type === "array" && !Array.isArray(obj[field])) {
      return [{ path: fieldPath, message: `Expected array`, expected: "array", received: typeof obj[field] }];
    }
    return [];
  };
}

function optional(_field: string, _type: string): Validator {
  return (value: unknown, path: string) => {
    const obj = value as Record<string, unknown>;
    if (obj[_field] === undefined || obj[_field] === null) return [];
    return required(_field, _type)(value, path);
  };
}

function oneOf(field: string, values: readonly string[]): Validator {
  return (value: unknown, path: string) => {
    const obj = value as Record<string, unknown>;
    const fieldPath = `${path}.${field}`;
    if (obj[field] === undefined) {
      return [{ path: fieldPath, message: `Required field missing`, expected: `one of: ${values.join(", ")}` }];
    }
    if (!values.includes(obj[field] as string)) {
      return [{ path: fieldPath, message: `Invalid value`, expected: `one of: ${values.join(", ")}`, received: String(obj[field]) }];
    }
    return [];
  };
}

// ─────────────────────────────────────────────────────────────────
// Payload Schemas
// ─────────────────────────────────────────────────────────────────

const PAYLOAD_SCHEMAS: Record<EventName, Validator[]> = {
  TaskCreated: [
    required("taskId", "string"),
    required("title", "string"),
    required("description", "string"),
    oneOf("priority", ["critical", "high", "medium", "low"]),
    required("keywords", "array"),
    required("requestedBy", "string"),
  ],
  TaskDelegated: [
    required("taskId", "string"),
    required("delegatedTo", "string"),
    required("delegatedBy", "string"),
    required("confidence", "number"),
    required("reasoning", "string"),
    required("capabilities", "array"),
  ],
  TaskCompleted: [
    required("taskId", "string"),
    required("completedBy", "string"),
    oneOf("result", ["success", "partial", "failed"]),
    required("artifacts", "array"),
    required("durationMs", "number"),
  ],
  AgentStarted: [
    required("agentId", "string"),
    required("taskId", "string"),
    required("capabilities", "array"),
    required("model", "string"),
  ],
  AgentCompleted: [
    required("agentId", "string"),
    required("taskId", "string"),
    oneOf("result", ["success", "partial"]),
    required("outputSummary", "string"),
    required("durationMs", "number"),
    required("tokensUsed", "number"),
    required("toolsUsed", "array"),
  ],
  AgentFailed: [
    required("agentId", "string"),
    required("taskId", "string"),
    required("error", "string"),
    required("errorCode", "string"),
    required("retryable", "boolean"),
    required("failedAt", "string"),
  ],
  ToolInvoked: [
    required("agentId", "string"),
    required("taskId", "string"),
    required("toolName", "string"),
    required("toolVersion", "string"),
    required("input", "object"),
    required("durationMs", "number"),
    required("success", "boolean"),
  ],
  MemoryUpdated: [
    required("agentId", "string"),
    oneOf("memoryType", ["short-term", "long-term", "episodic", "semantic"]),
    oneOf("operation", ["store", "update", "delete", "consolidate"]),
    required("key", "string"),
    required("sizeBytes", "number"),
  ],
  KnowledgeIndexed: [
    required("moduleId", "string"),
    required("documentId", "string"),
    required("title", "string"),
    required("source", "string"),
    required("chunkCount", "number"),
    required("embeddingModel", "string"),
    required("indexedBy", "string"),
  ],
  SecurityAlertRaised: [
    required("alertId", "string"),
    oneOf("severity", ["critical", "high", "medium", "low", "info"]),
    required("category", "string"),
    required("description", "string"),
    required("affectedEntity", "string"),
    required("detectedBy", "string"),
    required("evidence", "object"),
    required("mitigationRequired", "boolean"),
  ],
  GovernanceViolation: [
    required("violationId", "string"),
    required("policyId", "string"),
    required("policyName", "string"),
    required("violatedBy", "string"),
    required("action", "string"),
    oneOf("severity", ["critical", "high", "medium", "low"]),
    required("autoRemediated", "boolean"),
    required("details", "string"),
  ],
  DeploymentStarted: [
    required("deploymentId", "string"),
    oneOf("environment", ["development", "staging", "production"]),
    required("service", "string"),
    required("version", "string"),
    required("initiatedBy", "string"),
    oneOf("strategy", ["rolling", "blue-green", "canary"]),
  ],
  DeploymentFinished: [
    required("deploymentId", "string"),
    oneOf("environment", ["development", "staging", "production"]),
    required("service", "string"),
    required("version", "string"),
    oneOf("result", ["success", "rolled-back", "failed"]),
    required("durationMs", "number"),
    required("healthChecksPassed", "boolean"),
  ],
  WorkflowCompleted: [
    required("workflowId", "string"),
    required("workflowName", "string"),
    required("triggeredBy", "string"),
    required("stepsCompleted", "number"),
    required("totalSteps", "number"),
    oneOf("result", ["success", "partial", "failed"]),
    required("durationMs", "number"),
  ],
};

// ─────────────────────────────────────────────────────────────────
// Metadata Schema
// ─────────────────────────────────────────────────────────────────

const METADATA_VALIDATORS: Validator[] = [
  required("eventId", "string"),
  required("timestamp", "string"),
  required("correlationId", "string"),
  required("tenantId", "string"),
  required("workspaceId", "string"),
  required("source", "string"),
  required("schemaVersion", "string"),
  required("retryCount", "number"),
  required("maxRetries", "number"),
];

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Validate an event envelope (type + metadata + payload).
 */
export function validateEvent(event: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!event || typeof event !== "object") {
    return { valid: false, errors: [{ path: "$", message: "Event must be an object" }] };
  }

  const e = event as Record<string, unknown>;

  // Validate type field
  if (!e.type || typeof e.type !== "string") {
    errors.push({ path: "$.type", message: "Event type is required and must be a string" });
    return { valid: false, errors };
  }

  if (!EVENT_NAMES.includes(e.type as EventName)) {
    errors.push({
      path: "$.type",
      message: "Unknown event type",
      expected: `one of: ${EVENT_NAMES.join(", ")}`,
      received: e.type as string,
    });
    return { valid: false, errors };
  }

  // Validate metadata
  if (!e.metadata || typeof e.metadata !== "object") {
    errors.push({ path: "$.metadata", message: "Event metadata is required" });
  } else {
    for (const validator of METADATA_VALIDATORS) {
      errors.push(...validator(e.metadata, "$.metadata"));
    }
  }

  // Validate payload
  if (!e.payload || typeof e.payload !== "object") {
    errors.push({ path: "$.payload", message: "Event payload is required" });
  } else {
    const payloadValidators = PAYLOAD_SCHEMAS[e.type as EventName];
    if (payloadValidators) {
      for (const validator of payloadValidators) {
        errors.push(...validator(e.payload, "$.payload"));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate only the payload for a specific event type.
 */
export function validatePayload(eventType: EventName, payload: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: [{ path: "$.payload", message: "Payload must be an object" }] };
  }

  const validators = PAYLOAD_SCHEMAS[eventType];
  if (!validators) {
    return { valid: false, errors: [{ path: "$.payload", message: `No schema for event type: ${eventType}` }] };
  }

  for (const validator of validators) {
    errors.push(...validator(payload, "$.payload"));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate metadata only.
 */
export function validateMetadata(metadata: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!metadata || typeof metadata !== "object") {
    return { valid: false, errors: [{ path: "$.metadata", message: "Metadata must be an object" }] };
  }

  for (const validator of METADATA_VALIDATORS) {
    errors.push(...validator(metadata, "$.metadata"));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a value is a valid EventName.
 */
export function isValidEventName(name: unknown): name is EventName {
  return typeof name === "string" && EVENT_NAMES.includes(name as EventName);
}

/**
 * Get the schema field list for a given event type (for documentation/introspection).
 */
export function getPayloadFields(eventType: EventName): string[] {
  const validators = PAYLOAD_SCHEMAS[eventType];
  if (!validators) return [];
  // Extract field names from validator toString (simplified introspection)
  return validators
    .map((v) => {
      const match = v.toString().match(/["'](\w+)["']/);
      return match ? match[1] : null;
    })
    .filter((f): f is string => f !== null);
}

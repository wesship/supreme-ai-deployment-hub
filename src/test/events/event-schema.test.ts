/**
 * D3VONN Event Bus — Schema Validation Test Suite
 *
 * Tests for runtime event validation, payload schemas,
 * and metadata validation.
 */

import { describe, it, expect } from "vitest";
import {
  validateEvent,
  validatePayload,
  validateMetadata,
  isValidEventName,
  createMetadata,
  EVENT_NAMES,
  EventName,
} from "../../../shared/events";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function validMetadata() {
  return createMetadata("test-source", "tenant-1", "workspace-1");
}

function validTaskCreatedPayload() {
  return {
    taskId: "task-001",
    title: "Test task",
    description: "A test task for validation",
    priority: "high",
    keywords: ["test", "validation"],
    requestedBy: "user-1",
  };
}

function validAgentStartedPayload() {
  return {
    agentId: "code-engineer",
    taskId: "task-001",
    capabilities: ["code-review"],
    model: "gpt-4o",
  };
}

function validSecurityAlertPayload() {
  return {
    alertId: "alert-001",
    severity: "high",
    category: "unauthorized-access",
    description: "Unauthorized API access detected",
    affectedEntity: "api-gateway",
    detectedBy: "security-sentinel",
    evidence: { ip: "192.168.1.1", attempts: 5 },
    mitigationRequired: true,
  };
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("Event Schema Validation", () => {
  // ─── isValidEventName ────────────────────────────────────────

  describe("isValidEventName", () => {
    it("should accept all 14 defined event names", () => {
      for (const name of EVENT_NAMES) {
        expect(isValidEventName(name)).toBe(true);
      }
    });

    it("should reject invalid event names", () => {
      expect(isValidEventName("InvalidEvent")).toBe(false);
      expect(isValidEventName("")).toBe(false);
      expect(isValidEventName(null)).toBe(false);
      expect(isValidEventName(undefined)).toBe(false);
      expect(isValidEventName(123)).toBe(false);
    });

    it("should have exactly 14 event names", () => {
      expect(EVENT_NAMES.length).toBe(14);
    });
  });

  // ─── validateEvent (full envelope) ──────────────────────────

  describe("validateEvent", () => {
    it("should validate a complete valid event", () => {
      const event = {
        type: "TaskCreated",
        payload: validTaskCreatedPayload(),
        metadata: validMetadata(),
      };

      const result = validateEvent(event);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject non-object events", () => {
      expect(validateEvent(null).valid).toBe(false);
      expect(validateEvent(undefined).valid).toBe(false);
      expect(validateEvent("string").valid).toBe(false);
      expect(validateEvent(42).valid).toBe(false);
    });

    it("should reject events without type", () => {
      const event = {
        payload: validTaskCreatedPayload(),
        metadata: validMetadata(),
      };
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe("$.type");
    });

    it("should reject events with unknown type", () => {
      const event = {
        type: "UnknownEvent",
        payload: {},
        metadata: validMetadata(),
      };
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Unknown event type");
    });

    it("should reject events without metadata", () => {
      const event = {
        type: "TaskCreated",
        payload: validTaskCreatedPayload(),
      };
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
    });

    it("should reject events without payload", () => {
      const event = {
        type: "TaskCreated",
        metadata: validMetadata(),
      };
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
    });

    it("should reject events with incomplete payload", () => {
      const event = {
        type: "TaskCreated",
        payload: { taskId: "t1" }, // Missing required fields
        metadata: validMetadata(),
      };
      const result = validateEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ─── validatePayload ─────────────────────────────────────────

  describe("validatePayload", () => {
    it("should validate TaskCreated payload", () => {
      const result = validatePayload("TaskCreated", validTaskCreatedPayload());
      expect(result.valid).toBe(true);
    });

    it("should reject TaskCreated with invalid priority", () => {
      const payload = { ...validTaskCreatedPayload(), priority: "urgent" };
      const result = validatePayload("TaskCreated", payload);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes("priority"))).toBe(true);
    });

    it("should validate AgentStarted payload", () => {
      const result = validatePayload("AgentStarted", validAgentStartedPayload());
      expect(result.valid).toBe(true);
    });

    it("should reject AgentStarted without model", () => {
      const payload = { agentId: "x", taskId: "t1", capabilities: [] };
      const result = validatePayload("AgentStarted", payload);
      expect(result.valid).toBe(false);
    });

    it("should validate SecurityAlertRaised payload", () => {
      const result = validatePayload("SecurityAlertRaised", validSecurityAlertPayload());
      expect(result.valid).toBe(true);
    });

    it("should reject SecurityAlertRaised with invalid severity", () => {
      const payload = { ...validSecurityAlertPayload(), severity: "extreme" };
      const result = validatePayload("SecurityAlertRaised", payload);
      expect(result.valid).toBe(false);
    });

    it("should validate TaskCompleted payload", () => {
      const payload = {
        taskId: "t1",
        completedBy: "code-engineer",
        result: "success",
        artifacts: ["report.md"],
        durationMs: 5000,
      };
      const result = validatePayload("TaskCompleted", payload);
      expect(result.valid).toBe(true);
    });

    it("should reject TaskCompleted with invalid result", () => {
      const payload = {
        taskId: "t1",
        completedBy: "code-engineer",
        result: "unknown",
        artifacts: [],
        durationMs: 5000,
      };
      const result = validatePayload("TaskCompleted", payload);
      expect(result.valid).toBe(false);
    });

    it("should validate ToolInvoked payload", () => {
      const payload = {
        agentId: "code-engineer",
        taskId: "t1",
        toolName: "code-search",
        toolVersion: "1.0.0",
        input: { query: "security" },
        durationMs: 200,
        success: true,
      };
      const result = validatePayload("ToolInvoked", payload);
      expect(result.valid).toBe(true);
    });

    it("should validate MemoryUpdated payload", () => {
      const payload = {
        agentId: "code-engineer",
        memoryType: "episodic",
        operation: "store",
        key: "tool:search:t1",
        sizeBytes: 1024,
      };
      const result = validatePayload("MemoryUpdated", payload);
      expect(result.valid).toBe(true);
    });

    it("should reject MemoryUpdated with invalid memoryType", () => {
      const payload = {
        agentId: "code-engineer",
        memoryType: "permanent",
        operation: "store",
        key: "k1",
        sizeBytes: 100,
      };
      const result = validatePayload("MemoryUpdated", payload);
      expect(result.valid).toBe(false);
    });

    it("should validate GovernanceViolation payload", () => {
      const payload = {
        violationId: "v-001",
        policyId: "pol-001",
        policyName: "Data Residency",
        violatedBy: "data-analyst",
        action: "cross-region-transfer",
        severity: "high",
        autoRemediated: true,
        details: "Attempted to transfer data to non-approved region",
      };
      const result = validatePayload("GovernanceViolation", payload);
      expect(result.valid).toBe(true);
    });

    it("should validate DeploymentStarted payload", () => {
      const payload = {
        deploymentId: "dep-001",
        environment: "production",
        service: "api-gateway",
        version: "2.1.0",
        initiatedBy: "devops-engineer",
        strategy: "canary",
      };
      const result = validatePayload("DeploymentStarted", payload);
      expect(result.valid).toBe(true);
    });

    it("should reject DeploymentStarted with invalid strategy", () => {
      const payload = {
        deploymentId: "dep-001",
        environment: "production",
        service: "api-gateway",
        version: "2.1.0",
        initiatedBy: "devops-engineer",
        strategy: "yolo",
      };
      const result = validatePayload("DeploymentStarted", payload);
      expect(result.valid).toBe(false);
    });

    it("should validate DeploymentFinished payload", () => {
      const payload = {
        deploymentId: "dep-001",
        environment: "staging",
        service: "api-gateway",
        version: "2.1.0",
        result: "success",
        durationMs: 120000,
        healthChecksPassed: true,
      };
      const result = validatePayload("DeploymentFinished", payload);
      expect(result.valid).toBe(true);
    });

    it("should validate WorkflowCompleted payload", () => {
      const payload = {
        workflowId: "wf-001",
        workflowName: "task-orchestration",
        triggeredBy: "TaskCreated",
        stepsCompleted: 5,
        totalSteps: 5,
        result: "success",
        durationMs: 15000,
      };
      const result = validatePayload("WorkflowCompleted", payload);
      expect(result.valid).toBe(true);
    });

    it("should validate KnowledgeIndexed payload", () => {
      const payload = {
        moduleId: "dkos-core",
        documentId: "doc-001",
        title: "Architecture Guide",
        source: "github",
        chunkCount: 42,
        embeddingModel: "text-embedding-3-large",
        indexedBy: "knowledge-curator",
      };
      const result = validatePayload("KnowledgeIndexed", payload);
      expect(result.valid).toBe(true);
    });

    it("should reject non-object payloads", () => {
      const result = validatePayload("TaskCreated", null);
      expect(result.valid).toBe(false);

      const result2 = validatePayload("TaskCreated", "string");
      expect(result2.valid).toBe(false);
    });
  });

  // ─── validateMetadata ────────────────────────────────────────

  describe("validateMetadata", () => {
    it("should validate correct metadata", () => {
      const result = validateMetadata(validMetadata());
      expect(result.valid).toBe(true);
    });

    it("should reject metadata without eventId", () => {
      const meta = { ...validMetadata() } as any;
      delete meta.eventId;
      const result = validateMetadata(meta);
      expect(result.valid).toBe(false);
    });

    it("should reject metadata without timestamp", () => {
      const meta = { ...validMetadata() } as any;
      delete meta.timestamp;
      const result = validateMetadata(meta);
      expect(result.valid).toBe(false);
    });

    it("should reject metadata without tenantId", () => {
      const meta = { ...validMetadata() } as any;
      delete meta.tenantId;
      const result = validateMetadata(meta);
      expect(result.valid).toBe(false);
    });

    it("should reject metadata with wrong types", () => {
      const meta = { ...validMetadata(), retryCount: "zero" } as any;
      const result = validateMetadata(meta);
      expect(result.valid).toBe(false);
    });

    it("should reject non-object metadata", () => {
      expect(validateMetadata(null).valid).toBe(false);
      expect(validateMetadata("string").valid).toBe(false);
    });
  });

  // ─── All Event Types Coverage ────────────────────────────────

  describe("all event types have schemas", () => {
    const validPayloads: Record<EventName, unknown> = {
      TaskCreated: validTaskCreatedPayload(),
      TaskDelegated: {
        taskId: "t1", delegatedTo: "agent-1", delegatedBy: "hermes",
        confidence: 0.9, reasoning: "Best match", capabilities: ["code"],
      },
      TaskCompleted: {
        taskId: "t1", completedBy: "agent-1", result: "success",
        artifacts: [], durationMs: 1000,
      },
      AgentStarted: validAgentStartedPayload(),
      AgentCompleted: {
        agentId: "a1", taskId: "t1", result: "success",
        outputSummary: "Done", durationMs: 1000, tokensUsed: 500, toolsUsed: [],
      },
      AgentFailed: {
        agentId: "a1", taskId: "t1", error: "err", errorCode: "E001",
        retryable: false, failedAt: new Date().toISOString(),
      },
      ToolInvoked: {
        agentId: "a1", taskId: "t1", toolName: "search", toolVersion: "1.0",
        input: {}, durationMs: 100, success: true,
      },
      MemoryUpdated: {
        agentId: "a1", memoryType: "long-term", operation: "store",
        key: "k1", sizeBytes: 256,
      },
      KnowledgeIndexed: {
        moduleId: "m1", documentId: "d1", title: "Doc", source: "github",
        chunkCount: 10, embeddingModel: "ada-002", indexedBy: "curator",
      },
      SecurityAlertRaised: validSecurityAlertPayload(),
      GovernanceViolation: {
        violationId: "v1", policyId: "p1", policyName: "Policy",
        violatedBy: "agent", action: "act", severity: "medium",
        autoRemediated: false, details: "Details",
      },
      DeploymentStarted: {
        deploymentId: "d1", environment: "staging", service: "svc",
        version: "1.0", initiatedBy: "agent", strategy: "rolling",
      },
      DeploymentFinished: {
        deploymentId: "d1", environment: "staging", service: "svc",
        version: "1.0", result: "success", durationMs: 60000, healthChecksPassed: true,
      },
      WorkflowCompleted: {
        workflowId: "w1", workflowName: "wf", triggeredBy: "TaskCreated",
        stepsCompleted: 3, totalSteps: 3, result: "success", durationMs: 5000,
      },
    };

    for (const eventName of EVENT_NAMES) {
      it(`should validate ${eventName} payload`, () => {
        const result = validatePayload(eventName, validPayloads[eventName]);
        expect(result.valid).toBe(true);
      });

      it(`should validate full ${eventName} event`, () => {
        const event = {
          type: eventName,
          payload: validPayloads[eventName],
          metadata: validMetadata(),
        };
        const result = validateEvent(event);
        expect(result.valid).toBe(true);
      });
    }
  });
});

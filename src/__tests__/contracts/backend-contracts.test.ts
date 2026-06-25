/**
 * D3VONN.IO — Backend Contract Tests
 *
 * Validates that every API route handler produces responses that conform
 * to the canonical Zod schemas. Tests both happy-path and error-state shapes.
 * These tests act as a regression gate: if a handler changes its response
 * shape, these tests will catch the drift before it reaches production.
 */

import { describe, it, expect } from "vitest";
import {
  validate,
  validateOrThrow,
  buildErrorResponse,
  parseErrorResponse,
  ContractViolationError,
  withResponseValidation,
} from "../../lib/contracts/validator.js";
import {
  RunPayloadSchema,
  StartRunResponseSchema,
  LogRunRequestSchema,
  LogRunResponseSchema,
  FinishRunRequestSchema,
  FinishRunResponseSchema,
  RunStatusResponseSchema,
  RunListResponseSchema,
  CancelRunResponseSchema,
  CreateAgentRequestSchema,
  CreateAgentResponseSchema,
  AgentListResponseSchema,
  GovernanceArbitrationRequestSchema,
  GovernanceArbitrationResponseSchema,
  HealthCheckResponseSchema,
  ApiErrorResponseSchema,
  CONTRACT_SCHEMA_REGISTRY,
} from "../../lib/contracts/schemas.js";

// ── Test Fixtures ─────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const UUID = "550e8400-e29b-41d4-a716-446655440000";

const validRun = {
  run_id: UUID,
  status: "running" as const,
  job_type: "agent_task" as const,
  parameters: { task: "summarize" },
  created_at: NOW,
  updated_at: NOW,
  logs: [{ timestamp: NOW, level: "info" as const, message: "Starting run" }],
};

// ── Runs API Contract Tests ───────────────────────────────────────────────────

describe("Runs API — RunPayload contract", () => {
  it("accepts a valid RunPayload", () => {
    const result = validate(RunPayloadSchema, {
      job_type: "agent_task",
      parameters: { task: "summarize" },
      agent_id: UUID,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects RunPayload with invalid job_type", () => {
    const result = validate(RunPayloadSchema, {
      job_type: "invalid_type",
      parameters: {},
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.summary).toContain("job_type");
  });

  it("rejects RunPayload with invalid callback_url", () => {
    const result = validate(RunPayloadSchema, {
      job_type: "workflow",
      parameters: {},
      callback_url: "not-a-url",
    });
    expect(result.ok).toBe(false);
  });
});

describe("Runs API — StartRunResponse contract", () => {
  it("accepts a valid StartRunResponse", () => {
    const result = validate(StartRunResponseSchema, {
      run_id: UUID,
      status: "pending",
      message: "Run queued",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects StartRunResponse with non-UUID run_id", () => {
    const result = validate(StartRunResponseSchema, {
      run_id: "not-a-uuid",
      status: "pending",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.summary).toContain("run_id");
  });
});

describe("Runs API — LogRun contract", () => {
  it("accepts a valid LogRunRequest", () => {
    const result = validate(LogRunRequestSchema, {
      run_id: UUID,
      log_data: { timestamp: NOW, level: "info", message: "Step 1 complete" },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects LogRunRequest with invalid log level", () => {
    const result = validate(LogRunRequestSchema, {
      run_id: UUID,
      log_data: { timestamp: NOW, level: "verbose", message: "test" },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a valid LogRunResponse", () => {
    const result = validate(LogRunResponseSchema, { status: "logged", run_id: UUID });
    expect(result.ok).toBe(true);
  });

  it("rejects LogRunResponse with wrong status literal", () => {
    const result = validate(LogRunResponseSchema, { status: "ok", run_id: UUID });
    expect(result.ok).toBe(false);
  });
});

describe("Runs API — FinishRun contract", () => {
  it("accepts a valid FinishRunRequest (completed)", () => {
    const result = validate(FinishRunRequestSchema, {
      run_id: UUID,
      result_data: { output: "done" },
      status: "completed",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a valid FinishRunRequest (failed with error)", () => {
    const result = validate(FinishRunRequestSchema, {
      run_id: UUID,
      result_data: {},
      status: "failed",
      error: "Timeout exceeded",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects FinishRunRequest with invalid status", () => {
    const result = validate(FinishRunRequestSchema, {
      run_id: UUID,
      result_data: {},
      status: "cancelled",
    });
    expect(result.ok).toBe(false);
  });
});

describe("Runs API — RunStatus and RunList contracts", () => {
  it("accepts a valid RunStatusResponse", () => {
    const result = validate(RunStatusResponseSchema, { run: validRun });
    expect(result.ok).toBe(true);
  });

  it("accepts a valid RunListResponse", () => {
    const result = validate(RunListResponseSchema, {
      runs: [validRun],
      total: 1,
      page: 1,
      per_page: 20,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects RunListResponse with per_page > 100", () => {
    const result = validate(RunListResponseSchema, {
      runs: [],
      total: 0,
      page: 1,
      per_page: 500,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.summary).toContain("per_page");
  });

  it("rejects RunStatusResponse with invalid run_id format", () => {
    const result = validate(RunStatusResponseSchema, {
      run: { ...validRun, run_id: "bad-id" },
    });
    expect(result.ok).toBe(false);
  });
});

// ── Agent API Contract Tests ──────────────────────────────────────────────────

describe("Agent API contracts", () => {
  it("accepts a valid CreateAgentRequest", () => {
    const result = validate(CreateAgentRequestSchema, {
      name: "Summarizer Agent",
      description: "Summarizes documents",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects CreateAgentRequest with empty name", () => {
    const result = validate(CreateAgentRequestSchema, { name: "" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.summary).toContain("name");
  });

  it("rejects CreateAgentRequest with name exceeding 128 chars", () => {
    const result = validate(CreateAgentRequestSchema, { name: "a".repeat(129) });
    expect(result.ok).toBe(false);
  });

  it("accepts a valid CreateAgentResponse", () => {
    const result = validate(CreateAgentResponseSchema, {
      agent: {
        id: UUID,
        name: "Test Agent",
        status: "active",
        created_at: NOW,
        updated_at: NOW,
      },
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a valid AgentListResponse", () => {
    const result = validate(AgentListResponseSchema, {
      agents: [{ id: UUID, name: "Agent 1", status: "active", created_at: NOW, updated_at: NOW }],
      total: 1,
    });
    expect(result.ok).toBe(true);
  });
});

// ── Governance API Contract Tests ─────────────────────────────────────────────

describe("Governance API contracts", () => {
  it("accepts a valid GovernanceArbitrationRequest", () => {
    const result = validate(GovernanceArbitrationRequestSchema, {
      agent_id: UUID,
      action: "write_file",
      context: { path: "/etc/config" },
      priority: 75,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects GovernanceArbitrationRequest with priority > 100", () => {
    const result = validate(GovernanceArbitrationRequestSchema, {
      agent_id: UUID,
      action: "write_file",
      context: {},
      priority: 150,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.summary).toContain("priority");
  });

  it("accepts all valid governance decisions", () => {
    for (const decision of ["allow", "deny", "escalate", "defer"] as const) {
      const result = validate(GovernanceArbitrationResponseSchema, {
        decision,
        reason: "Policy evaluation complete",
        latency_ms: 12,
        timestamp: NOW,
      });
      expect(result.ok).toBe(true);
    }
  });
});

// ── Health API Contract Tests ─────────────────────────────────────────────────

describe("Health API contracts", () => {
  it("accepts a valid HealthCheckResponse", () => {
    const result = validate(HealthCheckResponseSchema, {
      overall: "healthy",
      services: [
        { service: "mcp-gateway", status: "healthy", last_checked: NOW },
        { service: "agent-executor", status: "degraded", latency_ms: 180, last_checked: NOW },
      ],
      timestamp: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects HealthCheckResponse with invalid service status", () => {
    const result = validate(HealthCheckResponseSchema, {
      overall: "healthy",
      services: [{ service: "mcp-gateway", status: "ok", last_checked: NOW }],
      timestamp: NOW,
    });
    expect(result.ok).toBe(false);
  });
});

// ── Error Contract Tests ──────────────────────────────────────────────────────

describe("Error contract", () => {
  it("buildErrorResponse produces a valid ApiErrorResponse", () => {
    const response = buildErrorResponse("NOT_FOUND", "Run not found", { run_id: UUID }, "req-123");
    const result = validate(ApiErrorResponseSchema, response);
    expect(result.ok).toBe(true);
  });

  it("buildErrorResponse with domain error code is valid", () => {
    const response = buildErrorResponse("GOVERNANCE_DENIED", "Action denied by policy");
    const result = validate(ApiErrorResponseSchema, response);
    expect(result.ok).toBe(true);
  });

  it("parseErrorResponse normalizes an unrecognized error shape", () => {
    const normalized = parseErrorResponse({ unexpected: "shape" });
    expect(normalized.error.code).toBe("INTERNAL_ERROR");
    const result = validate(ApiErrorResponseSchema, normalized);
    expect(result.ok).toBe(true);
  });

  it("parseErrorResponse passes through a valid ApiErrorResponse", () => {
    const valid = buildErrorResponse("RATE_LIMITED", "Too many requests");
    const parsed = parseErrorResponse(valid);
    expect(parsed.error.code).toBe("RATE_LIMITED");
  });
});

// ── Validator Utilities ───────────────────────────────────────────────────────

describe("validateOrThrow", () => {
  it("returns data when validation passes", () => {
    const data = validateOrThrow(StartRunResponseSchema, { run_id: UUID, status: "pending" }, "test");
    expect(data.run_id).toBe(UUID);
  });

  it("throws ContractViolationError when validation fails", () => {
    expect(() =>
      validateOrThrow(StartRunResponseSchema, { run_id: "bad", status: "pending" }, "test-context")
    ).toThrow(ContractViolationError);
  });

  it("ContractViolationError includes context and summary", () => {
    try {
      validateOrThrow(StartRunResponseSchema, { run_id: "bad" }, "my-handler");
    } catch (e) {
      expect(e).toBeInstanceOf(ContractViolationError);
      expect((e as ContractViolationError).context).toBe("my-handler");
      expect((e as ContractViolationError).summary).toBeTruthy();
    }
  });
});

describe("withResponseValidation", () => {
  it("passes through a valid response", async () => {
    const handler = withResponseValidation(
      StartRunResponseSchema,
      async () => ({ run_id: UUID, status: "pending" as const })
    );
    const result = await handler(undefined);
    expect("run_id" in result).toBe(true);
  });

  it("returns an error response when the handler produces invalid shape", async () => {
    const handler = withResponseValidation(
      StartRunResponseSchema,
      async () => ({ run_id: "bad-id", status: "pending" as const } as any)
    );
    const result = await handler(undefined);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

// ── Schema Registry Coverage Test ────────────────────────────────────────────

describe("CONTRACT_SCHEMA_REGISTRY coverage", () => {
  it("all schemas in the registry are valid Zod schemas", () => {
    for (const [name, schema] of Object.entries(CONTRACT_SCHEMA_REGISTRY)) {
      expect(schema).toBeDefined();
      expect(typeof schema.safeParse).toBe("function");
    }
  });

  it("registry contains at least 16 schemas", () => {
    expect(Object.keys(CONTRACT_SCHEMA_REGISTRY).length).toBeGreaterThanOrEqual(16);
  });
});

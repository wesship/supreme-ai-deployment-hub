/**
 * D3VONN — Frontend Type Drift Detection Tests
 *
 * These tests verify that the legacy TypeScript interfaces in src/types/
 * have not drifted from the canonical Zod schemas in src/lib/contracts/.
 *
 * If a field is added to the legacy interface but not the schema (or vice
 * versa), the test fails — forcing a deliberate schema update before the
 * change can be merged.
 *
 * This is the primary defence against dashboard/API drift.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  RunSchema,
  RunPayloadSchema,
  RunLogSchema,
  StartRunResponseSchema,
  LogRunRequestSchema,
  LogRunResponseSchema,
  FinishRunRequestSchema,
  FinishRunResponseSchema,
  RunStatusResponseSchema,
  RunListResponseSchema,
  AgentSchema,
  GovernanceArbitrationRequestSchema,
  GovernanceArbitrationResponseSchema,
  HealthCheckResponseSchema,
  ApiErrorResponseSchema,
  ErrorCodeSchema,
  detectSchemaDrift,
} from "../../lib/contracts/index.js";

// ── Drift Detection Helper ────────────────────────────────────────────────────

/**
 * Extract the top-level keys from a Zod object schema.
 */
function zodKeys(schema: z.ZodObject<z.ZodRawShape>): string[] {
  return Object.keys(schema.shape);
}

// ── Legacy Interface Field Declarations ──────────────────────────────────────
// These mirror the fields declared in src/types/run.ts and src/types/api.ts.
// They are the "ground truth" of what the frontend currently expects.

const legacyRunFields = [
  "run_id", "status", "job_type", "parameters",
  "created_at", "updated_at", "started_at", "finished_at",
  "logs", "result", "error", "progress", "current_step",
];

const legacyRunPayloadFields = [
  "job_type", "parameters", "agent_id", "workflow_id",
  "n8n_webhook_url", "callback_url",
];

const legacyRunLogFields = ["timestamp", "level", "message", "metadata"];

const legacyStartRunResponseFields = ["run_id", "status", "message"];

const legacyLogRunRequestFields = ["run_id", "log_data"];

const legacyLogRunResponseFields = ["status", "run_id"];

const legacyFinishRunRequestFields = ["run_id", "result_data", "status", "error"];

const legacyFinishRunResponseFields = ["status", "run_id"];

const legacyRunStatusResponseFields = ["run"];

const legacyRunListResponseFields = ["runs", "total", "page", "per_page"];

// ── Run Schema Drift Tests ────────────────────────────────────────────────────

describe("Run schema drift detection", () => {
  it("Run schema matches legacy Run interface", () => {
    const { drifted, missingInSchema, extraInSchema } = detectSchemaDrift(
      zodKeys(RunSchema),
      legacyRunFields,
    );
    expect(missingInSchema).toEqual([]);
    expect(extraInSchema).toEqual([]);
    expect(drifted).toBe(false);
  });

  it("RunPayload schema matches legacy RunPayload interface", () => {
    const { drifted, missingInSchema, extraInSchema } = detectSchemaDrift(
      zodKeys(RunPayloadSchema),
      legacyRunPayloadFields,
    );
    expect(missingInSchema).toEqual([]);
    expect(extraInSchema).toEqual([]);
    expect(drifted).toBe(false);
  });

  it("RunLog schema matches legacy RunLog interface", () => {
    const { drifted, missingInSchema, extraInSchema } = detectSchemaDrift(
      zodKeys(RunLogSchema),
      legacyRunLogFields,
    );
    expect(missingInSchema).toEqual([]);
    expect(extraInSchema).toEqual([]);
    expect(drifted).toBe(false);
  });

  it("StartRunResponse schema matches legacy interface", () => {
    const { drifted } = detectSchemaDrift(
      zodKeys(StartRunResponseSchema),
      legacyStartRunResponseFields,
    );
    expect(drifted).toBe(false);
  });

  it("LogRunRequest schema matches legacy interface", () => {
    const { drifted } = detectSchemaDrift(
      zodKeys(LogRunRequestSchema),
      legacyLogRunRequestFields,
    );
    expect(drifted).toBe(false);
  });

  it("LogRunResponse schema matches legacy interface", () => {
    const { drifted } = detectSchemaDrift(
      zodKeys(LogRunResponseSchema),
      legacyLogRunResponseFields,
    );
    expect(drifted).toBe(false);
  });

  it("FinishRunRequest schema matches legacy interface", () => {
    const { drifted } = detectSchemaDrift(
      zodKeys(FinishRunRequestSchema),
      legacyFinishRunRequestFields,
    );
    expect(drifted).toBe(false);
  });

  it("FinishRunResponse schema matches legacy interface", () => {
    const { drifted } = detectSchemaDrift(
      zodKeys(FinishRunResponseSchema),
      legacyFinishRunResponseFields,
    );
    expect(drifted).toBe(false);
  });

  it("RunStatusResponse schema matches legacy interface", () => {
    const { drifted } = detectSchemaDrift(
      zodKeys(RunStatusResponseSchema),
      legacyRunStatusResponseFields,
    );
    expect(drifted).toBe(false);
  });

  it("RunListResponse schema matches legacy interface", () => {
    const { drifted } = detectSchemaDrift(
      zodKeys(RunListResponseSchema),
      legacyRunListResponseFields,
    );
    expect(drifted).toBe(false);
  });
});

// ── Drift Detector Logic Tests ────────────────────────────────────────────────

describe("detectSchemaDrift utility", () => {
  it("returns drifted=false when sets are identical", () => {
    const result = detectSchemaDrift(["a", "b", "c"], ["a", "b", "c"]);
    expect(result.drifted).toBe(false);
    expect(result.missingInSchema).toEqual([]);
    expect(result.extraInSchema).toEqual([]);
  });

  it("detects field present in interface but missing from schema", () => {
    const result = detectSchemaDrift(["a", "b"], ["a", "b", "c"]);
    expect(result.drifted).toBe(true);
    expect(result.missingInSchema).toContain("c");
  });

  it("detects field present in schema but missing from interface", () => {
    const result = detectSchemaDrift(["a", "b", "d"], ["a", "b"]);
    expect(result.drifted).toBe(true);
    expect(result.extraInSchema).toContain("d");
  });
});

// ── Type Narrowing Tests ──────────────────────────────────────────────────────
// These tests verify that TypeScript types derived from Zod schemas
// correctly narrow to the expected shapes at runtime.

describe("Zod-derived type narrowing", () => {
  it("RunStatus enum values are exhaustive", () => {
    const validStatuses = ["pending", "started", "running", "completed", "failed", "cancelled"];
    for (const s of validStatuses) {
      expect(RunSchema.shape.status.safeParse(s).success).toBe(true);
    }
    expect(RunSchema.shape.status.safeParse("unknown").success).toBe(false);
  });

  it("JobType enum values are exhaustive", () => {
    const validTypes = ["agent_task", "workflow", "n8n_dispatch", "docker_mcp", "custom"];
    for (const t of validTypes) {
      expect(RunPayloadSchema.shape.job_type.safeParse(t).success).toBe(true);
    }
    expect(RunPayloadSchema.shape.job_type.safeParse("invalid").success).toBe(false);
  });

  it("GovernanceDecision enum values are exhaustive", () => {
    const validDecisions = ["allow", "deny", "escalate", "defer"];
    for (const d of validDecisions) {
      expect(GovernanceArbitrationResponseSchema.shape.decision.safeParse(d).success).toBe(true);
    }
    expect(GovernanceArbitrationResponseSchema.shape.decision.safeParse("bypass").success).toBe(false);
  });

  it("ServiceHealthStatus enum values are exhaustive", () => {
    const validStatuses = ["healthy", "degraded", "unhealthy", "unknown"];
    for (const s of validStatuses) {
      expect(HealthCheckResponseSchema.shape.overall.safeParse(s).success).toBe(true);
    }
  });

  it("ErrorCode enum covers all 17 defined codes", () => {
    const codes = ErrorCodeSchema.options;
    expect(codes.length).toBe(17);
    expect(codes).toContain("GOVERNANCE_DENIED");
    expect(codes).toContain("KILL_SWITCH_ACTIVE");
    expect(codes).toContain("BLAST_RADIUS_EXCEEDED");
    expect(codes).toContain("VALIDATION_ERROR");
  });
});

// ── API Error Shape Consistency ───────────────────────────────────────────────

describe("ApiErrorResponse shape consistency", () => {
  it("error envelope always has code, message, and timestamp", () => {
    const shape = zodKeys(ApiErrorResponseSchema.shape.error as z.ZodObject<z.ZodRawShape>);
    expect(shape).toContain("code");
    expect(shape).toContain("message");
    expect(shape).toContain("timestamp");
  });

  it("optional fields (details, request_id) are present in schema", () => {
    const shape = zodKeys(ApiErrorResponseSchema.shape.error as z.ZodObject<z.ZodRawShape>);
    expect(shape).toContain("details");
    expect(shape).toContain("request_id");
  });
});

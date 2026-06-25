/**
 * D3VONN.IO — Error State Lock Tests
 *
 * Locks the complete error contract surface:
 * - Every defined ErrorCode must be producible via buildErrorResponse
 * - Every error response must conform to ApiErrorResponseSchema
 * - Undocumented error shapes must be rejected or normalized
 * - HTTP status code mapping must be stable and exhaustive
 * - Error boundary conditions (empty message, null details, etc.) are handled
 */

import { describe, it, expect } from "vitest";
import {
  ErrorCodeSchema,
  ApiErrorResponseSchema,
} from "../../lib/contracts/schemas.js";
import {
  buildErrorResponse,
  parseErrorResponse,
  validate,
} from "../../lib/contracts/validator.js";
import type { ErrorCode } from "../../lib/contracts/schemas.js";

// ── HTTP Status Code Map ──────────────────────────────────────────────────────
// This is the canonical mapping from ErrorCode to HTTP status.
// Any change to this map is a breaking API change and must be deliberate.

const ERROR_CODE_HTTP_MAP: Record<ErrorCode, number> = {
  // 4xx Client errors
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  // 5xx Server errors
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  // Domain errors (map to appropriate 4xx/5xx)
  AGENT_NOT_FOUND: 404,
  RUN_NOT_FOUND: 404,
  RUN_ALREADY_FINISHED: 409,
  GOVERNANCE_DENIED: 403,
  BLAST_RADIUS_EXCEEDED: 429,
  KILL_SWITCH_ACTIVE: 503,
};

// ── Error Code Exhaustiveness ─────────────────────────────────────────────────

describe("Error code exhaustiveness", () => {
  it("HTTP status map covers every defined ErrorCode", () => {
    const definedCodes = ErrorCodeSchema.options as ErrorCode[];
    const mappedCodes = Object.keys(ERROR_CODE_HTTP_MAP) as ErrorCode[];
    const missing = definedCodes.filter((c) => !mappedCodes.includes(c));
    expect(missing).toEqual([]);
  });

  it("HTTP status map has no extra codes not in the schema", () => {
    const definedCodes = new Set(ErrorCodeSchema.options as ErrorCode[]);
    const extra = (Object.keys(ERROR_CODE_HTTP_MAP) as ErrorCode[]).filter(
      (c) => !definedCodes.has(c),
    );
    expect(extra).toEqual([]);
  });

  it("every ErrorCode produces a valid ApiErrorResponse", () => {
    const codes = ErrorCodeSchema.options as ErrorCode[];
    for (const code of codes) {
      const response = buildErrorResponse(code, `Test message for ${code}`);
      const result = validate(ApiErrorResponseSchema, response);
      expect(result.ok).toBe(true);
    }
  });
});

// ── HTTP Status Code Stability ────────────────────────────────────────────────

describe("HTTP status code stability", () => {
  it("VALIDATION_ERROR maps to 422", () => {
    expect(ERROR_CODE_HTTP_MAP.VALIDATION_ERROR).toBe(422);
  });

  it("UNAUTHORIZED maps to 401", () => {
    expect(ERROR_CODE_HTTP_MAP.UNAUTHORIZED).toBe(401);
  });

  it("FORBIDDEN maps to 403", () => {
    expect(ERROR_CODE_HTTP_MAP.FORBIDDEN).toBe(403);
  });

  it("NOT_FOUND maps to 404", () => {
    expect(ERROR_CODE_HTTP_MAP.NOT_FOUND).toBe(404);
  });

  it("GOVERNANCE_DENIED maps to 403", () => {
    expect(ERROR_CODE_HTTP_MAP.GOVERNANCE_DENIED).toBe(403);
  });

  it("KILL_SWITCH_ACTIVE maps to 503", () => {
    expect(ERROR_CODE_HTTP_MAP.KILL_SWITCH_ACTIVE).toBe(503);
  });

  it("BLAST_RADIUS_EXCEEDED maps to 429", () => {
    expect(ERROR_CODE_HTTP_MAP.BLAST_RADIUS_EXCEEDED).toBe(429);
  });

  it("INTERNAL_ERROR maps to 500", () => {
    expect(ERROR_CODE_HTTP_MAP.INTERNAL_ERROR).toBe(500);
  });

  it("no error code maps to 200 or 201", () => {
    const successCodes = Object.values(ERROR_CODE_HTTP_MAP).filter(
      (s) => s === 200 || s === 201,
    );
    expect(successCodes).toEqual([]);
  });
});

// ── Error Boundary Conditions ─────────────────────────────────────────────────

describe("Error boundary conditions", () => {
  it("buildErrorResponse with minimal args produces valid response", () => {
    const r = buildErrorResponse("NOT_FOUND", "Resource not found");
    expect(r.error.details).toBeUndefined();
    expect(r.error.request_id).toBeUndefined();
    const result = validate(ApiErrorResponseSchema, r);
    expect(result.ok).toBe(true);
  });

  it("buildErrorResponse with all optional fields produces valid response", () => {
    const r = buildErrorResponse(
      "CONFLICT",
      "Duplicate run",
      { existing_run_id: "abc-123" },
      "req-xyz-789",
    );
    expect(r.error.details).toBeDefined();
    expect(r.error.request_id).toBe("req-xyz-789");
    const result = validate(ApiErrorResponseSchema, r);
    expect(result.ok).toBe(true);
  });

  it("buildErrorResponse timestamp is a valid ISO 8601 datetime", () => {
    const r = buildErrorResponse("TIMEOUT", "Request timed out");
    expect(() => new Date(r.error.timestamp)).not.toThrow();
    expect(new Date(r.error.timestamp).toISOString()).toBe(r.error.timestamp);
  });

  it("rejects error response with unknown error code", () => {
    const malformed = {
      error: {
        code: "UNKNOWN_CODE",
        message: "Something went wrong",
        timestamp: new Date().toISOString(),
      },
    };
    const result = validate(ApiErrorResponseSchema, malformed);
    expect(result.ok).toBe(false);
  });

  it("rejects error response with missing message", () => {
    const malformed = {
      error: {
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      },
    };
    const result = validate(ApiErrorResponseSchema, malformed);
    expect(result.ok).toBe(false);
  });

  it("rejects error response with empty message string", () => {
    const malformed = {
      error: {
        code: "INTERNAL_ERROR",
        message: "",
        timestamp: new Date().toISOString(),
      },
    };
    const result = validate(ApiErrorResponseSchema, malformed);
    expect(result.ok).toBe(false);
  });

  it("rejects error response with missing timestamp", () => {
    const malformed = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Error occurred",
      },
    };
    const result = validate(ApiErrorResponseSchema, malformed);
    expect(result.ok).toBe(false);
  });

  it("rejects error response with invalid timestamp format", () => {
    const malformed = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Error occurred",
        timestamp: "2024-01-01",  // date only, not datetime
      },
    };
    const result = validate(ApiErrorResponseSchema, malformed);
    expect(result.ok).toBe(false);
  });
});

// ── Undocumented Shape Prevention ────────────────────────────────────────────

describe("Undocumented error shape prevention", () => {
  it("parseErrorResponse normalizes a completely unknown shape", () => {
    const normalized = parseErrorResponse({ status: "error", msg: "oops" });
    expect(normalized.error.code).toBe("INTERNAL_ERROR");
    const result = validate(ApiErrorResponseSchema, normalized);
    expect(result.ok).toBe(true);
  });

  it("parseErrorResponse normalizes a null value", () => {
    const normalized = parseErrorResponse(null);
    expect(normalized.error.code).toBe("INTERNAL_ERROR");
  });

  it("parseErrorResponse normalizes an undefined value", () => {
    const normalized = parseErrorResponse(undefined);
    expect(normalized.error.code).toBe("INTERNAL_ERROR");
  });

  it("parseErrorResponse normalizes a plain string error", () => {
    const normalized = parseErrorResponse("something went wrong");
    expect(normalized.error.code).toBe("INTERNAL_ERROR");
  });

  it("parseErrorResponse normalizes an axios-style error object", () => {
    const axiosStyleError = {
      response: { status: 500, data: { detail: "Internal Server Error" } },
      message: "Request failed with status code 500",
    };
    const normalized = parseErrorResponse(axiosStyleError);
    expect(normalized.error.code).toBe("INTERNAL_ERROR");
  });

  it("parseErrorResponse passes through a valid ApiErrorResponse unchanged", () => {
    const valid = buildErrorResponse("RATE_LIMITED", "Slow down");
    const parsed = parseErrorResponse(valid);
    expect(parsed.error.code).toBe("RATE_LIMITED");
    expect(parsed.error.message).toBe("Slow down");
  });
});

// ── Domain Error Semantics ────────────────────────────────────────────────────

describe("Domain error semantics", () => {
  it("GOVERNANCE_DENIED carries policy context in details", () => {
    const r = buildErrorResponse(
      "GOVERNANCE_DENIED",
      "Action denied by governance policy",
      { policy_id: "no-file-write", agent_id: "agent-123" },
    );
    expect(r.error.details?.policy_id).toBe("no-file-write");
    const result = validate(ApiErrorResponseSchema, r);
    expect(result.ok).toBe(true);
  });

  it("KILL_SWITCH_ACTIVE carries switch state in details", () => {
    const r = buildErrorResponse(
      "KILL_SWITCH_ACTIVE",
      "System is in emergency stop mode",
      { activated_at: new Date().toISOString(), activated_by: "operator" },
    );
    expect(r.error.details?.activated_by).toBe("operator");
    const result = validate(ApiErrorResponseSchema, r);
    expect(result.ok).toBe(true);
  });

  it("BLAST_RADIUS_EXCEEDED carries limit context in details", () => {
    const r = buildErrorResponse(
      "BLAST_RADIUS_EXCEEDED",
      "Agent has exceeded its blast radius limit",
      { limit: 5, current: 8, agent_id: "agent-456" },
    );
    expect(r.error.details?.limit).toBe(5);
    const result = validate(ApiErrorResponseSchema, r);
    expect(result.ok).toBe(true);
  });
});

/**
 * D3VONN.IO — Contract Validator
 *
 * Runtime validation utilities for API contracts.
 * Use these at API boundaries to catch schema drift immediately.
 */

import { z, ZodSchema, ZodError } from "zod";
import type { ApiErrorResponse, ErrorCode } from "./schemas.js";
import { ApiErrorResponseSchema } from "./schemas.js";

// ── Validation Result ─────────────────────────────────────────────────────────

export type ValidationSuccess<T> = { ok: true; data: T };
export type ValidationFailure = { ok: false; error: ZodError; summary: string };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate an unknown value against a Zod schema.
 * Returns a typed result — never throws.
 */
export function validate<T>(schema: ZodSchema<T>, value: unknown): ValidationResult<T> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues ?? [];
  const summary = issues
    .map((e) => `${e.path.map(String).join(".")}: ${e.message}`)
    .join("; ");
  return { ok: false, error: result.error, summary };
}

/**
 * Validate and throw a descriptive error if validation fails.
 * Use at API ingress points where a hard failure is appropriate.
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, value: unknown, context: string): T {
  const result = validate(schema, value);
  if (!result.ok) {
    throw new ContractViolationError(context, result.summary, result.error);
  }
  return result.data;
}

// ── Contract Violation Error ──────────────────────────────────────────────────

export class ContractViolationError extends Error {
  constructor(
    public readonly context: string,
    public readonly summary: string,
    public readonly zodError: ZodError,
  ) {
    super(`Contract violation in '${context}': ${summary}`);
    this.name = "ContractViolationError";
  }
}

// ── Response Validator Middleware ─────────────────────────────────────────────

/**
 * Wraps an async API handler to validate its response shape before returning.
 * If the response does not match the schema, logs a warning and returns
 * a VALIDATION_ERROR response rather than leaking malformed data.
 */
export function withResponseValidation<TInput, TOutput>(
  schema: ZodSchema<TOutput>,
  handler: (input: TInput) => Promise<TOutput>,
): (input: TInput) => Promise<TOutput | ApiErrorResponse> {
  return async (input: TInput) => {
    const output = await handler(input);
    const result = validate(schema, output);
    if (!result.ok) {
      console.error(`[contract] Response validation failed: ${result.summary}`);
      return buildErrorResponse("VALIDATION_ERROR", `Response schema violation: ${result.summary}`);
    }
    return result.data;
  };
}

// ── Error Response Builder ────────────────────────────────────────────────────

export function buildErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      details,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Parse an unknown API error response and return a typed ApiErrorResponse.
 * If the shape is unrecognized, returns a normalized INTERNAL_ERROR.
 */
export function parseErrorResponse(raw: unknown): ApiErrorResponse {
  const result = validate(ApiErrorResponseSchema, raw);
  if (result.ok) return result.data;
  return buildErrorResponse("INTERNAL_ERROR", "Unrecognized error response shape from upstream");
}

// ── Drift Detector ────────────────────────────────────────────────────────────

/**
 * Compares a set of TypeScript interface field names against the
 * corresponding Zod schema keys to detect drift.
 *
 * Usage: call this in a test to assert that a legacy interface
 * has not diverged from the canonical Zod schema.
 */
export function detectSchemaDrift(
  schemaKeys: string[],
  interfaceKeys: string[],
): { drifted: boolean; missingInSchema: string[]; extraInSchema: string[] } {
  const schemaSet = new Set(schemaKeys);
  const interfaceSet = new Set(interfaceKeys);
  const missingInSchema = interfaceKeys.filter((k) => !schemaSet.has(k));
  const extraInSchema = schemaKeys.filter((k) => !interfaceSet.has(k));
  return {
    drifted: missingInSchema.length > 0 || extraInSchema.length > 0,
    missingInSchema,
    extraInSchema,
  };
}

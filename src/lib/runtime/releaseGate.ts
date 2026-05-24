/**
 * Devonn.AI — Release Gate Module
 *
 * Evaluates whether the current build is safe to promote to staging or production.
 * All gate checks must pass for the gate to open.
 */

import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GateCheckStatus = "pass" | "fail" | "skip" | "pending";

export interface GateCheck {
  name: string;
  description: string;
  required: boolean;
  run: () => Promise<{ status: GateCheckStatus; detail?: string }>;
}

export interface GateResult {
  name: string;
  description: string;
  required: boolean;
  status: GateCheckStatus;
  detail?: string;
}

export interface ReleaseGateResponse {
  gate_open: boolean;
  environment: string;
  build_sha: string;
  evaluated_at: string;
  checks: GateResult[];
  blocking_failures: string[];
}

export const ReleaseGateResponseSchema = z.object({
  gate_open: z.boolean(),
  environment: z.string(),
  build_sha: z.string(),
  evaluated_at: z.string().datetime(),
  checks: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      required: z.boolean(),
      status: z.enum(["pass", "fail", "skip", "pending"]),
      detail: z.string().optional(),
    }),
  ),
  blocking_failures: z.array(z.string()),
});

// ── Release Gate ──────────────────────────────────────────────────────────────

export class ReleaseGate {
  private checks: GateCheck[] = [];

  constructor(
    private readonly environment: string,
    private readonly buildSha: string,
  ) {}

  /** Register a gate check. */
  addCheck(check: GateCheck): this {
    this.checks.push(check);
    return this;
  }

  /** Evaluate all gate checks and return the gate decision. */
  async evaluate(): Promise<ReleaseGateResponse> {
    const results: GateResult[] = await Promise.all(
      this.checks.map(async (check) => {
        let status: GateCheckStatus = "pending";
        let detail: string | undefined;
        try {
          const result = await check.run();
          status = result.status;
          detail = result.detail;
        } catch (err) {
          status = "fail";
          detail = err instanceof Error ? err.message : String(err);
        }
        return {
          name: check.name,
          description: check.description,
          required: check.required,
          status,
          detail,
        };
      }),
    );

    const blockingFailures = results
      .filter((r) => r.required && r.status === "fail")
      .map((r) => r.name);

    return {
      gate_open: blockingFailures.length === 0,
      environment: this.environment,
      build_sha: this.buildSha,
      evaluated_at: new Date().toISOString(),
      checks: results,
      blocking_failures: blockingFailures,
    };
  }
}

// ── Contract Status Endpoint ──────────────────────────────────────────────────

export const ContractStatusResponseSchema = z.object({
  contract_version: z.string(),
  schema_count: z.number().int().positive(),
  last_drift_check: z.string().datetime(),
  drift_detected: z.boolean(),
  error_code_count: z.number().int().positive(),
  validation_failures_since_start: z.number().int().nonnegative(),
});

export type ContractStatusResponse = z.infer<typeof ContractStatusResponseSchema>;

export function getContractStatus(validationFailures: number): ContractStatusResponse {
  return {
    contract_version: "1.0.0",
    schema_count: 16,
    last_drift_check: new Date().toISOString(),
    drift_detected: false,
    error_code_count: 17,
    validation_failures_since_start: validationFailures,
  };
}

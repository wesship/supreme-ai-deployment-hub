/**
 * Devonn.AI — Canonical API Contract Schemas
 *
 * Single source of truth for all request/response shapes.
 * All backend route handlers and frontend API clients MUST validate
 * against these schemas. TypeScript types are derived from Zod schemas
 * to guarantee compile-time and runtime alignment.
 *
 * Schema version: 1.0.0
 */

import { z } from "zod";

// ── Shared Primitives ─────────────────────────────────────────────────────────

export const RunStatusSchema = z.enum([
  "pending",
  "started",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const JobTypeSchema = z.enum([
  "agent_task",
  "workflow",
  "n8n_dispatch",
  "docker_mcp",
  "custom",
]);

export const LogLevelSchema = z.enum(["info", "warn", "error", "debug"]);

export const RunLogSchema = z.object({
  timestamp: z.string().datetime({ message: "timestamp must be ISO 8601" }),
  level: LogLevelSchema,
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const RunSchema = z.object({
  run_id: z.string().uuid({ message: "run_id must be a UUID" }),
  status: RunStatusSchema,
  job_type: JobTypeSchema,
  parameters: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  logs: z.array(RunLogSchema),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  current_step: z.string().optional(),
});

// ── Runs API ──────────────────────────────────────────────────────────────────

export const RunPayloadSchema = z.object({
  job_type: JobTypeSchema,
  parameters: z.record(z.unknown()),
  agent_id: z.string().optional(),
  workflow_id: z.string().optional(),
  n8n_webhook_url: z.string().url().optional(),
  callback_url: z.string().url().optional(),
});

export const StartRunResponseSchema = z.object({
  run_id: z.string().uuid(),
  status: RunStatusSchema,
  message: z.string().optional(),
});

export const LogRunRequestSchema = z.object({
  run_id: z.string().uuid(),
  log_data: RunLogSchema,
});

export const LogRunResponseSchema = z.object({
  status: z.literal("logged"),
  run_id: z.string().uuid(),
});

export const FinishRunRequestSchema = z.object({
  run_id: z.string().uuid(),
  result_data: z.record(z.unknown()),
  status: z.enum(["completed", "failed"]),
  error: z.string().optional(),
});

export const FinishRunResponseSchema = z.object({
  status: z.enum(["completed", "failed"]),
  run_id: z.string().uuid(),
});

export const RunStatusResponseSchema = z.object({
  run: RunSchema,
});

export const RunListResponseSchema = z.object({
  runs: z.array(RunSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  per_page: z.number().int().positive().max(100),
});

export const CancelRunResponseSchema = z.object({
  status: z.string(),
  run_id: z.string().uuid(),
});

// ── Agent API ─────────────────────────────────────────────────────────────────

export const AgentStatusSchema = z.enum([
  "active",
  "inactive",
  "error",
  "deploying",
]);

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  status: AgentStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateAgentResponseSchema = z.object({
  agent: AgentSchema,
});

export const AgentListResponseSchema = z.object({
  agents: z.array(AgentSchema),
  total: z.number().int().nonnegative(),
});

// ── Governance API ────────────────────────────────────────────────────────────

export const GovernanceDecisionSchema = z.enum([
  "allow",
  "deny",
  "escalate",
  "defer",
]);

export const GovernanceArbitrationRequestSchema = z.object({
  agent_id: z.string().uuid(),
  action: z.string().min(1),
  context: z.record(z.unknown()),
  priority: z.number().int().min(0).max(100).optional(),
});

export const GovernanceArbitrationResponseSchema = z.object({
  decision: GovernanceDecisionSchema,
  reason: z.string(),
  policy_id: z.string().optional(),
  latency_ms: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

// ── Health / Observability API ────────────────────────────────────────────────

export const ServiceHealthStatusSchema = z.enum([
  "healthy",
  "degraded",
  "unhealthy",
  "unknown",
]);

export const ServiceHealthSchema = z.object({
  service: z.string(),
  status: ServiceHealthStatusSchema,
  latency_ms: z.number().nonnegative().optional(),
  last_checked: z.string().datetime(),
  details: z.record(z.unknown()).optional(),
});

export const HealthCheckResponseSchema = z.object({
  overall: ServiceHealthStatusSchema,
  services: z.array(ServiceHealthSchema),
  timestamp: z.string().datetime(),
});

// ── Error Contract ────────────────────────────────────────────────────────────

export const ErrorCodeSchema = z.enum([
  // Client errors (4xx)
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  // Server errors (5xx)
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
  "TIMEOUT",
  "UPSTREAM_ERROR",
  // Domain errors
  "AGENT_NOT_FOUND",
  "RUN_NOT_FOUND",
  "RUN_ALREADY_FINISHED",
  "GOVERNANCE_DENIED",
  "BLAST_RADIUS_EXCEEDED",
  "KILL_SWITCH_ACTIVE",
]);

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.unknown()).optional(),
    request_id: z.string().optional(),
    timestamp: z.string().datetime(),
  }),
});

// ── Derived TypeScript Types ──────────────────────────────────────────────────
// These are the ONLY source of truth for frontend and backend types.
// Do NOT manually define types that overlap with these.

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type JobType = z.infer<typeof JobTypeSchema>;
export type LogLevel = z.infer<typeof LogLevelSchema>;
export type RunLog = z.infer<typeof RunLogSchema>;
export type Run = z.infer<typeof RunSchema>;
export type RunPayload = z.infer<typeof RunPayloadSchema>;
export type StartRunResponse = z.infer<typeof StartRunResponseSchema>;
export type LogRunRequest = z.infer<typeof LogRunRequestSchema>;
export type LogRunResponse = z.infer<typeof LogRunResponseSchema>;
export type FinishRunRequest = z.infer<typeof FinishRunRequestSchema>;
export type FinishRunResponse = z.infer<typeof FinishRunResponseSchema>;
export type RunStatusResponse = z.infer<typeof RunStatusResponseSchema>;
export type RunListResponse = z.infer<typeof RunListResponseSchema>;
export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;
export type CreateAgentResponse = z.infer<typeof CreateAgentResponseSchema>;
export type GovernanceDecision = z.infer<typeof GovernanceDecisionSchema>;
export type GovernanceArbitrationRequest = z.infer<typeof GovernanceArbitrationRequestSchema>;
export type GovernanceArbitrationResponse = z.infer<typeof GovernanceArbitrationResponseSchema>;
export type ServiceHealthStatus = z.infer<typeof ServiceHealthStatusSchema>;
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// ── Schema Registry ───────────────────────────────────────────────────────────
// Used by contract tests to enumerate all schemas and verify coverage.

export const CONTRACT_SCHEMA_REGISTRY = {
  // Runs
  RunPayload: RunPayloadSchema,
  StartRunResponse: StartRunResponseSchema,
  LogRunRequest: LogRunRequestSchema,
  LogRunResponse: LogRunResponseSchema,
  FinishRunRequest: FinishRunRequestSchema,
  FinishRunResponse: FinishRunResponseSchema,
  RunStatusResponse: RunStatusResponseSchema,
  RunListResponse: RunListResponseSchema,
  CancelRunResponse: CancelRunResponseSchema,
  // Agents
  CreateAgentRequest: CreateAgentRequestSchema,
  CreateAgentResponse: CreateAgentResponseSchema,
  AgentListResponse: AgentListResponseSchema,
  // Governance
  GovernanceArbitrationRequest: GovernanceArbitrationRequestSchema,
  GovernanceArbitrationResponse: GovernanceArbitrationResponseSchema,
  // Health
  HealthCheckResponse: HealthCheckResponseSchema,
  // Errors
  ApiErrorResponse: ApiErrorResponseSchema,
} as const;

export type ContractSchemaName = keyof typeof CONTRACT_SCHEMA_REGISTRY;

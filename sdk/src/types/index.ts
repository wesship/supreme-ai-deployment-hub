/**
 * D3VONN.IO Runtime SDK — Type Definitions
 * Generated from docs/api/runtime-openapi.yaml v1.0.0
 */

// ---------------------------------------------------------------------------
// Execution Types
// ---------------------------------------------------------------------------

export type RunStatus = "queued" | "running" | "completed" | "failed" | "blocked";

export interface StartRunRequest {
  /** ID of the agent template to execute */
  agentId: string;
  /** Natural language goal for the agent */
  goal: string;
  /** Initial context or payload data */
  context?: Record<string, unknown>;
  /** Specific MCP tools to enable for this run */
  mcpTools?: string[];
  /** Client-provided key for safe retries */
  idempotencyKey?: string;
}

export interface RunResponse {
  id: string;
  status: RunStatus;
  createdAt: string;
}

export interface RunStep {
  stepId: string;
  action: string;
  timestamp: string;
  content?: string;
  toolName?: string;
  toolResult?: unknown;
}

export interface RunDetailsResponse extends RunResponse {
  completedAt?: string;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  trace?: RunStep[];
}

export interface RunListResponse {
  items: RunResponse[];
  total: number;
}

// ---------------------------------------------------------------------------
// Governance Types
// ---------------------------------------------------------------------------

export type GovernanceResolution = "allow" | "deny" | "escalate" | "mitigate";

export interface DecisionTraceResponse {
  conflictId: string;
  resolution: GovernanceResolution;
  policyGraph: Record<string, unknown>;
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class DevonnApiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(statusCode: number, error: ApiError) {
    super(error.message);
    this.name = "DevonnApiError";
    this.code = error.code;
    this.statusCode = statusCode;
    this.details = error.details;
  }
}

// ---------------------------------------------------------------------------
// SDK Configuration
// ---------------------------------------------------------------------------

export interface DevonnClientConfig {
  /** Base URL of the Runtime Gateway (default: https://api.d3vonn.io/v1/runtime) */
  baseUrl?: string;
  /** Bearer token for authentication */
  apiKey: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Maximum number of retry attempts for transient failures (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in milliseconds for exponential backoff (default: 500) */
  retryBaseDelayMs?: number;
}

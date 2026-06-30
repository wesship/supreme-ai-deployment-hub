/**
 * Multi-Tenant API Layer — Types
 *
 * Defines the core data structures for tenant isolation, API key management,
 * and usage metering across the D3VONN platform.
 */

// ── Tenant ──────────────────────────────────────────────────────────────────

export type TenantTier = "free" | "pro" | "enterprise";
export type TenantStatus = "active" | "suspended" | "deleted";

export interface Tenant {
  id: string;
  name: string;
  tier: TenantTier;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
  settings: TenantSettings;
  quotas: TenantQuotas;
}

export interface TenantSettings {
  allowedModels: string[];
  maxConcurrentAgents: number;
  dataRetentionDays: number;
  webhookUrl?: string;
  customDomain?: string;
}

export interface TenantQuotas {
  requestsPerDay: number;
  requestsPerMinute: number;
  maxTokensPerRequest: number;
  maxAgentsPerExecution: number;
  storageGb: number;
}

// ── API Keys ─────────────────────────────────────────────────────────────────

export type ApiKeyStatus = "active" | "revoked" | "expired";
export type ApiKeyScope = "read" | "write" | "admin" | "execute";

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;          // SHA-256 of the raw key — never store raw
  prefix: string;           // First 8 chars for display (e.g. "dvn_live_")
  scopes: ApiKeyScope[];
  status: ApiKeyStatus;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
}

export interface ApiKeyCreateRequest {
  tenantId: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresInDays?: number;
}

export interface ApiKeyCreateResponse {
  apiKey: ApiKey;
  rawKey: string;           // Shown ONCE at creation — never stored
}

// ── Usage Metering ───────────────────────────────────────────────────────────

export type UsageEventType =
  | "agent_execution"
  | "prediction_request"
  | "governance_decision"
  | "memory_read"
  | "memory_write"
  | "tool_call";

export interface UsageEvent {
  id: string;
  tenantId: string;
  apiKeyId: string;
  eventType: UsageEventType;
  timestamp: Date;
  durationMs: number;
  tokensConsumed: number;
  metadata: Record<string, unknown>;
}

export interface UsageSummary {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  totalRequests: number;
  totalTokens: number;
  totalDurationMs: number;
  byEventType: Record<UsageEventType, number>;
  quotaUtilization: {
    requestsPerDay: number;    // 0-1 fraction
    requestsPerMinute: number; // 0-1 fraction
    storageGb: number;         // 0-1 fraction
  };
}

// ── Rate Limiting ────────────────────────────────────────────────────────────

export interface RateLimitState {
  tenantId: string;
  windowStart: Date;
  requestCount: number;
  tokenCount: number;
  isThrottled: boolean;
  retryAfterMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

// ── Tenant Context ───────────────────────────────────────────────────────────

export interface TenantContext {
  tenant: Tenant;
  apiKey: ApiKey;
  requestId: string;
  timestamp: Date;
}

/**
 * Multi-Tenant API Layer — Tenant Isolation Middleware
 *
 * Validates API keys, enforces rate limits, and attaches TenantContext
 * to every request. Acts as the enforcement boundary for all tenant isolation.
 */

import { TenantRegistry } from "./tenantRegistry.js";
import { RateLimiter, UsageMeter } from "./usageMeter.js";
import { TenantContext, ApiKeyScope, UsageEventType } from "./types.js";

export interface MiddlewareRequest {
  headers: Record<string, string | undefined>;
  path: string;
  method: string;
}

export interface MiddlewareResult {
  allowed: boolean;
  context?: TenantContext;
  statusCode: number;
  error?: string;
  headers?: Record<string, string>;
}

export class TenantMiddleware {
  constructor(
    private readonly registry: TenantRegistry,
    private readonly rateLimiter: RateLimiter,
    private readonly usageMeter: UsageMeter
  ) {}

  async authenticate(request: MiddlewareRequest): Promise<MiddlewareResult> {
    // Extract API key from Authorization header
    const authHeader = request.headers["authorization"] ?? request.headers["Authorization"];
    if (!authHeader) {
      return { allowed: false, statusCode: 401, error: "Missing Authorization header" };
    }

    const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (!rawKey || rawKey.length < 10) {
      return { allowed: false, statusCode: 401, error: "Invalid API key format" };
    }

    // Validate key
    const apiKey = await this.registry.validateApiKey(rawKey);
    if (!apiKey) {
      return { allowed: false, statusCode: 401, error: "Invalid or expired API key" };
    }

    // Load tenant
    const tenant = this.registry.getTenant(apiKey.tenantId);
    if (!tenant) {
      return { allowed: false, statusCode: 401, error: "Tenant not found" };
    }

    if (tenant.status !== "active") {
      return {
        allowed: false,
        statusCode: 403,
        error: `Tenant account is ${tenant.status}`,
      };
    }

    // Check rate limits
    const rateLimitResult = this.rateLimiter.checkAndConsume(tenant);
    if (!rateLimitResult.allowed) {
      return {
        allowed: false,
        statusCode: 429,
        error: "Rate limit exceeded",
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetAt.toISOString(),
          "Retry-After": String(Math.ceil((rateLimitResult.retryAfterMs ?? 0) / 1000)),
        },
      };
    }

    const context: TenantContext = {
      tenant,
      apiKey,
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };

    return {
      allowed: true,
      context,
      statusCode: 200,
      headers: {
        "X-Tenant-Id": tenant.id,
        "X-Request-Id": context.requestId,
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        "X-RateLimit-Reset": rateLimitResult.resetAt.toISOString(),
      },
    };
  }

  checkScope(context: TenantContext, requiredScope: ApiKeyScope): boolean {
    return this.registry.hasScope(context.apiKey, requiredScope);
  }

  recordUsage(
    context: TenantContext,
    eventType: UsageEventType,
    durationMs: number,
    tokensConsumed = 0,
    metadata: Record<string, unknown> = {}
  ): void {
    this.usageMeter.record({
      tenantId: context.tenant.id,
      apiKeyId: context.apiKey.id,
      eventType,
      timestamp: new Date(),
      durationMs,
      tokensConsumed,
      metadata,
    });
  }

  checkModelAccess(context: TenantContext, modelId: string): boolean {
    const allowed = context.tenant.settings.allowedModels;
    if (allowed.includes("*")) return true;
    return allowed.includes(modelId);
  }
}

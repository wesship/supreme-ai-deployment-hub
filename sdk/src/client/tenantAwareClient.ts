/**
 * Multi-Tenant API Layer — Tenant-Aware SDK Client
 *
 * Wraps the base HTTP client to provide automatic rate limit handling,
 * tenant context injection, and API key management.
 */

import { DevonnClient, DevonnClientConfig } from "./devonnClient.js";

export interface TenantAwareConfig extends DevonnClientConfig {
  /**
   * The API key for the tenant.
   * Format: dvn_{tier}_{secret}
   */
  apiKey: string;
  
  /**
   * Whether to automatically wait and retry when encountering 429 Rate Limit responses.
   * @default true
   */
  autoRetryRateLimits?: boolean;
  
  /**
   * Maximum time to wait for a rate limit reset before failing (in milliseconds).
   * @default 60000 (1 minute)
   */
  maxRateLimitWaitMs?: number;
}

export class TenantAwareClient extends DevonnClient {
  private readonly autoRetryRateLimits: boolean;
  private readonly maxRateLimitWaitMs: number;

  constructor(config: TenantAwareConfig) {
    super({
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
    this.autoRetryRateLimits = config.autoRetryRateLimits ?? true;
    this.maxRateLimitWaitMs = config.maxRateLimitWaitMs ?? 60000;
  }

  /**
   * Override the base request method to handle 429 Rate Limit responses
   * by reading the Retry-After header and waiting.
   */
  protected async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options?: { body?: unknown; headers?: Record<string, string>; params?: Record<string, string | number> }
  ): Promise<T> {
    try {
      return await super.request<T>(method, path, options);
    } catch (error: any) {
      if (error.status === 429 && this.autoRetryRateLimits) {
        const retryAfterSec = parseInt(error.headers?.["retry-after"] || "1", 10);
        const retryAfterMs = retryAfterSec * 1000;

        if (retryAfterMs <= this.maxRateLimitWaitMs) {
          console.warn(`[Devonn SDK] Rate limit exceeded. Waiting ${retryAfterSec}s before retrying...`);
          await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
          
          // Retry the request exactly once after waiting
          return super.request<T>(method, path, options);
        }
      }
      throw error;
    }
  }

  /**
   * Helper method to get the current tenant's rate limit status
   * from the most recent response headers.
   */
  getRateLimitStatus(): { remaining: number; resetAt: Date } | null {
    const headers = this.getLastResponseHeaders();
    if (!headers) return null;

    const remainingStr = headers["x-ratelimit-remaining"];
    const resetStr = headers["x-ratelimit-reset"];

    if (!remainingStr || !resetStr) return null;

    return {
      remaining: parseInt(remainingStr, 10),
      resetAt: new Date(resetStr),
    };
  }
}
